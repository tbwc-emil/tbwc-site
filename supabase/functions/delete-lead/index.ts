// Deletes a rep_leads row and, if it left behind an orphaned auth.users account
// for that email (an abandoned earlier signup attempt, or a lead resubmitted
// after one), deletes that too — same reasoning as delete-rep: only the Admin
// API (service role) can remove an auth.users row, so a plain client-side lead
// delete could never have cleaned one up on its own.
//
// Never touches an auth account that has a real public.users profile — that
// would mean an active rep, not an orphan, and submit-rep-lead already refuses
// to create a lead for an email that has one anyway.
// Deploy: supabase functions deploy delete-lead
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

  // Matches rep_leads_delete_admin's RLS predicate (can_approve_rep_leads() —
  // is_admin does NOT imply this) — this function bypasses RLS via the service
  // role, so it has to re-check that itself.
  const caller = await getCaller(req, sb);
  if (!caller.ok || !caller.canApproveRepLeads) return json({ error: 'Not authorized' }, 403);

  const { data: lead, error: fetchError } = await sb.from('rep_leads').select('email').eq('id', id).maybeSingle();
  if (fetchError) return json({ error: fetchError.message || 'Delete failed — try again.' }, 500);
  if (!lead) return json({ success: true }, 200); // already gone — nothing to do

  const { error: deleteError } = await sb.from('rep_leads').delete().eq('id', id);
  if (deleteError) return json({ error: deleteError.message || 'Delete failed — try again.' }, 500);

  // Look up any auth account for this email — generateLink(type: 'recovery')
  // only succeeds for an existing user, same trick rep-signup uses for this.
  const { data: recoveryData } = await sb.auth.admin.generateLink({ type: 'recovery', email: lead.email });
  const orphanId = recoveryData?.user?.id;
  if (orphanId) {
    const { data: profile } = await sb.from('users').select('id').eq('id', orphanId).maybeSingle();
    if (!profile) await sb.auth.admin.deleteUser(orphanId);
  }

  return json({ success: true }, 200);
});
