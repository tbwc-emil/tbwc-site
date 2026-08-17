// Deletes a rep/customer/employee — both sides of it. admin.html used to call
// sb.from('users').delete() directly, which only removes the public.users row;
// the underlying auth.users account (email/password/session) has no client-side
// delete path (that's an Admin API operation, service-role only), so every
// deletion left a permanent orphaned login behind. That's what caused
// rep-signup to wrongly refuse re-registration for emil@tbwcinc.com et al.
//
// Deletes auth.users instead — public.users cascades automatically
// (id references auth.users(id) on delete cascade), so one call removes both.
// Deploy: supabase functions deploy delete-rep
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCaller } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { id } = body;
  if (!id) return json({ error: 'Missing id' }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Matches users_delete_admin's RLS predicate (public.is_admin()) — this function
  // bypasses RLS via the service role, so it has to re-check that itself.
  const caller = await getCaller(req, sb);
  if (!caller.ok || !caller.isAdmin) return json({ error: 'Admins only' }, 403);

  const { error } = await sb.auth.admin.deleteUser(id);
  if (error) return json({ error: error.message || 'Delete failed — try again.' }, 500);

  return json({ success: true }, 200);
});
