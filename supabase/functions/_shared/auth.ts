// Verifies the caller's identity + admin.html-level permissions for edge functions
// that do privileged (service-role) writes on their behalf. Those functions bypass
// RLS entirely by using the service role, so — unlike a direct sb.from() call from
// the browser — they must re-check the same permission the RLS policy would have
// enforced, or any logged-in user could call them regardless of role.
//
// sb.functions.invoke() sends the caller's own session JWT (not the anon key) in
// the Authorization header when a user is logged in, which is what this reads.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

export type CallerCheck =
  | { ok: true; id: string; isAdmin: boolean; canApproveRepLeads: boolean }
  | { ok: false };

// serviceClient must be a service-role client (reads public.users, which has no
// SELECT policy letting a user read someone else's row — this needs to bypass RLS
// the same way is_admin()/can_approve_rep_leads() do internally).
export async function getCaller(req: Request, serviceClient: ReturnType<typeof createClient>): Promise<CallerCheck> {
  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return { ok: false };

  const sbAnon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authData, error: authError } = await sbAnon.auth.getUser(jwt);
  if (authError || !authData.user) return { ok: false };

  const { data: profile } = await serviceClient
    .from('users')
    .select('is_admin,can_approve_rep_leads')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (!profile) return { ok: false };

  return { ok: true, id: authData.user.id, isAdmin: !!profile.is_admin, canApproveRepLeads: !!profile.can_approve_rep_leads };
}
