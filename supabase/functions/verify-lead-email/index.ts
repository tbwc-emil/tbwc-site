// Landing point for the "verify your email" link submit-rep-lead sends right
// after a public inquiry is submitted. Confirms the applicant controls the
// address before an admin ever sees the lead: flips rep_leads.email_verified,
// then — only now — notifies the admin (send-mail's lead-notify), so admin.html
// only ever surfaces inquiries from a real, reachable inbox.
//
// A browser navigates here directly (it's a mailto link target, not a fetch
// call), so this function must run with JWT verification OFF:
//   supabase functions deploy verify-lead-email --no-verify-jwt
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FALLBACK_REDIRECT = 'https://tbwctechnology.com/newrep-request.html';

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const redirectTo = url.searchParams.get('redirect_to') || FALLBACK_REDIRECT;

  if (!token) return Response.redirect(redirectTo + '?verify=invalid', 302);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: lead, error: fetchError } = await sb
    .from('rep_leads')
    .select('id,first_name,last_name,email,phone,about,email_verified')
    .eq('verify_token', token)
    .maybeSingle();

  if (fetchError || !lead) return Response.redirect(redirectTo + '?verify=invalid', 302);

  if (!lead.email_verified) {
    await sb.from('rep_leads').update({ email_verified: true, verified_at: new Date().toISOString() }).eq('id', lead.id);

    // Best-effort and awaited — the lead is verified either way, so a failed
    // notify shouldn't block the applicant from seeing success (admin still
    // sees it in admin.html) — but it must be awaited, not fired-and-forgotten,
    // since an edge function's background work isn't guaranteed to run once a
    // response has been returned.
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-mail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
        body: JSON.stringify({
          type: 'lead-notify',
          firstName: lead.first_name,
          lastName: lead.last_name,
          email: lead.email,
          phone: lead.phone,
          about: lead.about,
        }),
      });
    } catch {
      // ignored — see comment above
    }
  }

  return Response.redirect(redirectTo + '?verify=ok', 302);
});
