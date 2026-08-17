// Landing point for the link mailed by rep-signup. Replaces what the
// handle_rep_email_confirmed() DB trigger used to do (dropped from schema.sql) —
// that logic now lives here instead of in Postgres, so the database stays limited
// to storage/RLS and doesn't own app-specific automation the DB host can't be
// assumed to keep if the database itself ever moves off Supabase.
//
// A browser navigates here directly (it's a mailto link target, not a fetch call),
// so this function must run with JWT verification OFF:
//   supabase functions deploy confirm-signup --no-verify-jwt
//
// Flow: verifyOtp() confirms the email (same effect the old auth.users trigger
// fired on), then a service-role client creates the public.users profile row and
// consumes the invite lead — the two things the trigger used to do — then redirects
// to redirect_to with the session tokens in the URL hash, exactly like Supabase's
// own hosted /verify endpoint used to, so the client picks it up unchanged
// (supabase-js's default detectSessionInUrl reads that hash on page load).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FALLBACK_REDIRECT = 'https://tbwctechnology.com/index.html';

function errorRedirect(redirectTo: string, message: string): Response {
  var hash = 'error=access_denied&error_code=otp_expired&error_description=' + encodeURIComponent(message);
  return Response.redirect(redirectTo + '#' + hash, 302);
}

serve(async (req) => {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get('token_hash');
  const redirectTo = url.searchParams.get('redirect_to') || FALLBACK_REDIRECT;

  if (!tokenHash) return errorRedirect(redirectTo, 'Missing confirmation token.');

  const sbAnon = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await sbAnon.auth.verifyOtp({ token_hash: tokenHash, type: 'signup' });

  if (error || !data.session || !data.user) {
    return errorRedirect(redirectTo, (error && error.message) || 'Email link is invalid or has expired.');
  }

  const user = data.user;
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);

  const sbService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Mirrors the old trigger's insert ... on conflict (id) do update set approved = true.
  await sbService.from('users').upsert(
    {
      id: user.id,
      email: user.email,
      first_name: str(meta.first_name),
      last_name: str(meta.last_name),
      agency_name: str(meta.agency_name),
      url: str(meta.url),
      title: str(meta.title),
      work_phone: str(meta.work_phone),
      ext: str(meta.ext),
      mobile: str(meta.mobile),
      addr1: str(meta.addr1),
      addr2: str(meta.addr2),
      city: str(meta.city),
      state: str(meta.state),
      postal: str(meta.postal),
      about: str(meta.about),
      approved: true,
    },
    { onConflict: 'id' }
  );

  const inviteToken = str(meta.invite_token);
  if (inviteToken) {
    await sbService.from('rep_leads').delete().eq('invite_token', inviteToken);
  }

  const session = data.session;
  const hash =
    'access_token=' + encodeURIComponent(session.access_token) +
    '&expires_in=' + session.expires_in +
    '&refresh_token=' + encodeURIComponent(session.refresh_token) +
    '&token_type=' + session.token_type +
    '&type=signup';

  return Response.redirect(redirectTo + '#' + hash, 302);
});
