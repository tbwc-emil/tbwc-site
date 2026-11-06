/* Supabase client + auth helpers for the Rep Portal.
   Loaded on every page that includes nav.js (see each page's <head>).
   Requires window.supabase (the @supabase/supabase-js UMD bundle) to already be loaded. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://ihnezwvduwimprqascsf.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlobmV6d3ZkdXdpbXBycWFzY3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODk0MTYsImV4cCI6MjEwNjI2NTQxNn0.1SY0f4b61Pa09TU8c8OpPekEHJoJFpRI6T2IMf9YVYY';

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Base URL for emailed links — verify-lead-email's redirect back to
  // register.html, and password reset (send-password-reset's redirectTo).
  // Hardcoded to the prod domain (not window.location.href) so testing
  // against the prod DB from localhost never mails a real user a dead
  // localhost link.
  var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  var baseUrl = isLocal ? window.location.href : 'https://tbwctechnology.com/';

  function linkUrl(page) {
    return new URL(page, baseUrl).href;
  }

  // The portal's API (TBWC Worker) — same base as contact-form.js.
  var API_BASE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? 'http://localhost:8788/api'
    : 'https://tbwc-api-production.emilguirguis.workers.dev/api';

  // Sign in, then confirm the user profile exists and is approved.
  // Rejects (and signs back out) if not — approval gate lives here, not just at signup.
  // The profile check goes through the portal API's /auth/me (which answers
  // 403 for a missing or unapproved profile), not a direct read of the users
  // table — the database holds no access rules of its own.
  async function signIn(email, password) {
    var res = await sb.auth.signInWithPassword({ email: email, password: password });
    if (res.error) return { error: res.error };

    var me;
    try {
      me = await fetch(API_BASE + '/auth/me', {
        headers: { Authorization: 'Bearer ' + res.data.session.access_token },
      });
    } catch (e) {
      await sb.auth.signOut();
      return { error: { message: 'Could not reach the portal — please try again.' } };
    }
    if (!me.ok) {
      var body = await me.json().catch(function () { return {}; });
      await sb.auth.signOut();
      if (body.message === 'Account pending approval') {
        return { error: { message: 'Your registration is still pending approval.' } };
      }
      if (body.message === 'No user profile found') {
        return { error: { message: 'No user profile found for this account. Contact support.' } };
      }
      return { error: { message: body.message || 'Sign-in failed — please try again.' } };
    }
    // No isAdmin here any more: admin rights are role grants in the portal's
    // own API (public.role_permission), not a column on this row, and the
    // legacy admin.html that used to branch on it is retired.
    return { data: res.data };
  }

  // The rep-application flow (inquiry, invite lookup, signup) runs in the portal
  // API's public routes (/api/public/rep/*, no login) — the Supabase edge
  // functions it used to call are retired. Returns { data } or
  // { error: { message, code } } with the API's own message, so callers can show
  // it as-is. The Turnstile check is part of the inquiry submit itself now.
  async function publicApi(path, body) {
    var res;
    try {
      res = await fetch(API_BASE + '/public/rep' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return { error: { message: 'Could not reach the portal — please try again.' } };
    }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      return { error: { message: data.error || data.message || 'Something went wrong — please try again.', code: data.code } };
    }
    return { data: data };
  }

  // Rep inquiry (register.html): turnstileToken rides along and is verified server-side.
  function submitLead(fields) {
    return publicApi('/leads', fields);
  }

  // Invite prefill (rep-signup.html).
  function getInvite(token) {
    return publicApi('/invite', { token: token });
  }

  // fields: { email, password, firstName, lastName, agencyName, url, title, workPhone, ext, mobile, addr1, addr2, city, state, postal, about, inviteToken }
  // Goes through the portal API's /public/rep/signup (service role + admin create user)
  // instead of sb.auth.signUp() — creates an already-confirmed account directly,
  // no confirmation email at this step. The applicant already proved they control
  // the address back at the inquiry stage (verify-lead-email); this is just the
  // detail form behind an unguessable invite link mailed to that same address.
  // The users profile row is created in the same call — no client insert needed.
  // Caller should sign in right after a successful result (see signIn above) —
  // this only creates the account, it doesn't establish a session.
  // Only reachable via an emailed invite link (rep-signup.html) — the API requires
  // a valid approved invite whose email matches, so the invite token is the gate.
  function signUp(fields) {
    return publicApi('/signup', {
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
      inviteToken: fields.inviteToken || null
    });
  }

  // Goes through the portal API (/public/rep/password-reset), which mails the
  // link itself — not sb.auth.resetPasswordForEmail(), whose built-in mailer
  // only delivers to the project's team members, so reps never got the email.
  // Returns { data } or { error: { message } } like the other helpers.
  function sendPasswordReset(email) {
    return publicApi('/password-reset', { email: email, redirectTo: linkUrl('reset-password.html') });
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
    submitLead: submitLead,
    getInvite: getInvite,
    linkUrl: linkUrl,
    sendPasswordReset: sendPasswordReset,
    updatePassword: updatePassword,
    signOut: signOut,
    getSession: getSession,
    listDocsTree: listDocsTree,
    signedDownloadUrl: signedDownloadUrl,
    DOCS_BUCKET: 'rep-docs'
  };
})();
