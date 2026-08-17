/* Supabase client + auth helpers for the Rep Portal.
   Loaded on every page that includes nav.js (see each page's <head>).
   Requires window.supabase (the @supabase/supabase-js UMD bundle) to already be loaded. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://detwkqhqekaiyuajixhs.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldHdrcWhxZWthaXl1YWppeGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTI4ODIsImV4cCI6MjEwMDM4ODg4Mn0.OUE2KsTclMTqbPZ97_MXXVG4Nqq1ZOIIujdVJWCEx88';

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Base URL for emailed links — signup confirm (sent by rep-signup, below) and
  // password reset (still sent by Supabase's own mailer). Hardcoded to the prod
  // domain (not window.location.href) so testing against the prod DB from
  // localhost never mails a real user a dead localhost link.
  var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  var baseUrl = isLocal ? window.location.href : 'https://tbwctechnology.com/';

  // Sign in, then confirm the user profile exists and is approved.
  // Rejects (and signs back out) if not — approval gate lives here, not just at signup.
  async function signIn(email, password) {
    var res = await sb.auth.signInWithPassword({ email: email, password: password });
    if (res.error) return { error: res.error };

    var userRes = await sb.from('users').select('approved,is_admin').eq('id', res.data.user.id).single();
    if (userRes.error || !userRes.data) {
      await sb.auth.signOut();
      return { error: { message: 'No user profile found for this account. Contact support.' } };
    }
    if (!userRes.data.approved) {
      await sb.auth.signOut();
      return { error: { message: 'Your registration is still pending approval.' } };
    }
    return { data: res.data, isAdmin: !!userRes.data.is_admin };
  }

  // Verifies a Cloudflare Turnstile token server-side (verify-turnstile edge function)
  // before letting the caller proceed with a public write — a client-side-only check
  // would be trivial for a bot to skip. Shared by the rep-inquiry form and (formerly)
  // signUp(); rep-signup.html doesn't call this — the emailed invite token is its gate.
  async function verifyTurnstile(token) {
    if (!token) return { error: { message: 'Please complete the verification challenge.' } };
    var res = await sb.functions.invoke('verify-turnstile', { body: { token: token } });
    if (res.error || !res.data || !res.data.success) {
      return { error: { message: 'Verification failed — please try again.' } };
    }
    return { data: true };
  }

  // Calls an edge function and, on failure, extracts the real {error, code} JSON
  // body — sb.functions.invoke() only gives a generic "non-2xx status" error by
  // default, with the actual body sitting unread on error.context. Business logic
  // that used to live in DB triggers/functions (auto-approve on email confirm,
  // dup-lead guard, etc.) now runs in these functions instead, so callers need the
  // real message back the way they'd have gotten one from Postgres before.
  async function invokeFn(name, body) {
    var res = await sb.functions.invoke(name, { body: body });
    if (res.error) {
      var message = 'Something went wrong — please try again.';
      var code;
      if (res.error.context && typeof res.error.context.json === 'function') {
        try {
          var errBody = await res.error.context.json();
          if (errBody && errBody.error) message = errBody.error;
          if (errBody && errBody.code) code = errBody.code;
        } catch (e) { /* non-JSON error body — fall back to generic message */ }
      }
      return { error: { message: message, code: code } };
    }
    return { data: res.data };
  }

  // fields: { email, password, firstName, lastName, agencyName, url, title, workPhone, ext, mobile, addr1, addr2, city, state, postal, about, inviteToken }
  // Goes through the rep-signup edge function (service role + admin.generateLink)
  // instead of sb.auth.signUp() — that call would hand dispatch of the confirmation
  // email to Supabase's own built-in mailer, a black box the app can't see into or
  // get a real error back from. Routing through our own function keeps this on the
  // same SMTP codepath as the invite/lead-notify emails, with real success/failure
  // signal instead of a blind "check your email".
  // The users profile row is created by confirm-signup once the emailed link is
  // clicked (app code, not a DB trigger) — no client insert needed here.
  // Only reachable today via an emailed invite link (rep-signup.html), so there's no
  // separate Turnstile check here — the unguessable invite token is the gate.
  function signUp(fields) {
    return invokeFn('rep-signup', {
      email: fields.email,
      password: fields.password,
      firstName: fields.firstName || null,
      lastName: fields.lastName || null,
      agencyName: fields.agencyName || null,
      url: fields.url || null,
      title: fields.title || null,
      workPhone: fields.workPhone || null,
      ext: fields.ext || null,
      mobile: fields.mobile || null,
      addr1: fields.addr1 || null,
      addr2: fields.addr2 || null,
      city: fields.city || null,
      state: fields.state || null,
      postal: fields.postal || null,
      about: fields.about || null,
      inviteToken: fields.inviteToken || null,
      redirectTo: new URL('index.html', baseUrl).href
    });
  }

  function sendPasswordReset(email) {
    var redirectTo = new URL('reset-password.html', baseUrl).href;
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
    verifyTurnstile: verifyTurnstile,
    invokeFn: invokeFn,
    sendPasswordReset: sendPasswordReset,
    updatePassword: updatePassword,
    signOut: signOut,
    getSession: getSession,
    listDocsTree: listDocsTree,
    signedDownloadUrl: signedDownloadUrl,
    DOCS_BUCKET: 'rep-docs'
  };
})();
