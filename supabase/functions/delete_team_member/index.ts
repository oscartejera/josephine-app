/**
 * delete_team_member — Edge function to remove a team member.
 *
 * POST /functions/v1/delete_team_member
 * Body: { user_id: string }
 * Auth: Bearer token (Supabase JWT) — validated internally
 *
 * Deletes the user from auth.users which cascades to:
 *   - user_roles (ON DELETE CASCADE)
 *   - gdpr_consent_records (ON DELETE CASCADE)
 *   - gdpr_export_requests (ON DELETE CASCADE)
 *   - profiles (Supabase trigger)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface DeleteRequest {
  user_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate caller ──────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);

    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerId = claimsData.user.id;

    // ── 2. Check permission ─────────────────────────────────────
    const { data: hasPermission } = await userClient.rpc('has_permission', {
      _user_id: callerId,
      _permission_key: 'settings.users.manage',
      _location_id: null
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'No tienes permisos para eliminar usuarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Parse & validate body ────────────────────────────────
    const { user_id: targetUserId }: DeleteRequest = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Falta el campo user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cannot delete yourself
    if (targetUserId === callerId) {
      return new Response(
        JSON.stringify({ error: 'No puedes eliminarte a ti mismo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 4. Admin client ─────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // ── 5. Block deletion of owners ─────────────────────────────
    const { data: targetRoles } = await supabaseAdmin
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', targetUserId);

    const isOwner = targetRoles?.some(
      (ur: { roles?: { name: string } | null }) => ur.roles?.name === 'owner'
    );

    if (isOwner) {
      return new Response(
        JSON.stringify({ error: 'No se puede eliminar al propietario (owner) del grupo' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 6. Get target name for response ─────────────────────────
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', targetUserId)
      .single();

    const targetName = targetProfile?.full_name || 'Usuario';

    // ── 7. Delete from auth (cascades to user_roles, profiles…) ─
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return new Response(
        JSON.stringify({ error: `Error al eliminar usuario: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[delete_team_member] User ${targetUserId} (${targetName}) deleted by ${callerId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${targetName} ha sido eliminado del equipo.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete_team_member:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
