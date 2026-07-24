/* Supabase client + auth helpers for the Rep Portal.
   Loaded on every page that includes nav.js (see each page's <head>).
   Requires window.supabase (the @supabase/supabase-js UMD bundle) to already be loaded. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://detwkqhqekaiyuajixhs.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldHdrcWhxZWthaXl1YWppeGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTI4ODIsImV4cCI6MjEwMDM4ODg4Mn0.OUE2KsTclMTqbPZ97_MXXVG4Nqq1ZOIIujdVJWCEx88';

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Sign in, then confirm the rep profile exists and is approved.
  // Rejects (and signs back out) if not — approval gate lives here, not just at signup.
  async function signIn(email, password) {
    var res = await sb.auth.signInWithPassword({ email: email, password: password });
    if (res.error) return { error: res.error };

    var repRes = await sb.from('reps').select('approved').eq('id', res.data.user.id).single();
    if (repRes.error || !repRes.data) {
      await sb.auth.signOut();
      return { error: { message: 'No rep profile found for this account. Contact support.' } };
    }
    if (!repRes.data.approved) {
      await sb.auth.signOut();
      return { error: { message: 'Your registration is still pending approval.' } };
    }
    return { data: res.data };
  }

  // fields: { email, password, firstName, lastName, agencyName, title, workPhone, ext, mobile, addr1, addr2, city, state, postal, about, turnstileToken }
  // The reps profile row is created by the on_auth_user_created DB trigger from this
  // metadata — no client insert (works with email confirmation on, no post-signup session needed).
  // turnstileToken is verified server-side (verify-turnstile edge function) before any
  // account is created — a client-side-only check would be trivial for a bot to skip.
  async function signUp(fields) {
    if (!fields.turnstileToken) return { error: { message: 'Please complete the verification challenge.' } };
    var captchaRes = await sb.functions.invoke('verify-turnstile', { body: { token: fields.turnstileToken } });
    if (captchaRes.error || !captchaRes.data || !captchaRes.data.success) {
      return { error: { message: 'Verification failed — please try again.' } };
    }

    var signUpRes = await sb.auth.signUp({
      email: fields.email,
      password: fields.password,
      options: {
        data: {
          first_name: fields.firstName || null,
          last_name: fields.lastName || null,
          agency_name: fields.agencyName || null,
          title: fields.title || null,
          work_phone: fields.workPhone || null,
          ext: fields.ext || null,
          mobile: fields.mobile || null,
          addr1: fields.addr1 || null,
          addr2: fields.addr2 || null,
          city: fields.city || null,
          state: fields.state || null,
          postal: fields.postal || null,
          about: fields.about || null
        }
      }
    });
    if (signUpRes.error) return { error: signUpRes.error };
    if (!signUpRes.data.user) return { error: { message: 'Sign-up failed — try again.' } };
    return { data: signUpRes.data };
  }

  function sendPasswordReset(email) {
    var redirectTo = new URL('reset-password.html', window.location.href).href;
    return sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
  }

  function updatePassword(newPassword) {
    return sb.auth.updateUser({ password: newPassword });
  }

  function signOut() {
    return sb.auth.signOut();
  }

  function getSession() {
    return sb.auth.getSession();
  }

  // Walk the rep-docs bucket into a 2-level tree: category / subcategory / files.
  // Folders exist implicitly (a prefix with objects under it); Supabase returns
  // them as rows with no id. Files carry an id + metadata.size.
  async function listDocsTree(bucket) {
    async function walk(prefix) {
      var res = await sb.storage.from(bucket).list(prefix, {
        limit: 1000, sortBy: { column: 'name', order: 'asc' }
      });
      if (res.error) throw res.error;
      var files = [], folders = [];
      (res.data || []).forEach(function (e) {
        if (e.id) {
          if (e.name === '.emptyFolderPlaceholder') return;
          files.push({ name: e.name, path: prefix ? prefix + '/' + e.name : e.name, size: e.metadata && e.metadata.size });
        } else {
          folders.push(e.name);
        }
      });
      return { files: files, folders: folders };
    }

    var root = await walk('');
    var categories = [];
    for (var i = 0; i < root.folders.length; i++) {
      var cat = root.folders[i];
      var lvl1 = await walk(cat);
      var subs = [];
      for (var j = 0; j < lvl1.folders.length; j++) {
        var sub = lvl1.folders[j];
        var lvl2 = await walk(cat + '/' + sub);
        subs.push({ name: sub, files: lvl2.files });
      }
      categories.push({ name: cat, files: lvl1.files, subs: subs });
    }
    return { rootFiles: root.files, categories: categories };
  }

  function signedDownloadUrl(bucket, path, expiresIn) {
    return sb.storage.from(bucket).createSignedUrl(path, expiresIn || 60, { download: true });
  }

  window.TBWCAuth = {
    sb: sb,
    signIn: signIn,
    signUp: signUp,
    sendPasswordReset: sendPasswordReset,
    updatePassword: updatePassword,
    signOut: signOut,
    getSession: getSession,
    listDocsTree: listDocsTree,
    signedDownloadUrl: signedDownloadUrl,
    DOCS_BUCKET: 'rep-docs'
  };
})();
