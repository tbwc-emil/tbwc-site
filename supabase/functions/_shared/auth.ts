// Verifies the caller's identity + permissions for edge functions that do
// privileged (service-role) writes on their behalf. Those functions bypass RLS
// entirely by using the service role, so — unlike a direct sb.from() call from
// the browser — they must re-check the permission a policy would have enforced,
// or any logged-in user could call them regardless of role.
//
// Permissions are role grants (public.role_permission), the same rows the
// portal's API Worker resolves — not users.is_admin / users.can_* columns,
// which are gone (the flags could never express a custom role, and a role edit
// in Settings > Roles had no effect on these functions). A permission name is
// only meaningful if something enforces it; the names used here are the ones
// the Worker's catalog already defines (worker/permissions.ts).
//
// sb.functions.invoke() sends the caller's own session JWT (not the anon key) in
// the Authorization header when a user is logged in, which is what this reads.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

export type CallerCheck =
  | { ok: true; id: string; has: (permission: string) => boolean }
  | { ok: false };

// serviceClient must be a service-role client: it reads public.users and
// public.role_permission, neither of which a user may read for anyone but
// themselves, so this has to bypass RLS.
export async function getCaller(req: Request, serviceClient: ReturnType<typeof createClient>): Promise<CallerCheck> {
  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return { ok: false };

  const sbAnon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authData, error: authError } = await sbAnon.auth.getUser(jwt);
  if (authError || !authData.user) return { ok: false };

  const { data: profile } = await serviceClient
    .from('users')
    .select('role_id,permission_overrides')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (!profile) return { ok: false };

  // No role = no permissions, i.e. denied — same as the Worker.
  const held = new Set<string>();
  if (profile.role_id != null) {
    const { data: grants } = await serviceClient
      .from('role_permission')
      .select('permission')
      .eq('role_id', profile.role_id);
    for (const g of grants ?? []) held.add(g.permission as string);
  }
  // Per-user overrides: 'all'/'own' grants it, false revokes it (the scope
  // itself doesn't matter to these functions — they are all-or-nothing).
  for (const [permission, value] of Object.entries(profile.permission_overrides ?? {})) {
    if (value === false) held.delete(permission);
    else if (value === 'all' || value === 'own') held.add(permission);
  }

  return { ok: true, id: authData.user.id, has: (permission: string) => held.has(permission) };
}
