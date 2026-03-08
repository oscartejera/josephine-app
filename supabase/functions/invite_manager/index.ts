import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generatePassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
    let pass = '';
    for (let i = 0; i < 12; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
}

function sanitizeName(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-z0-9]/g, '');     // only alphanumeric
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Verify caller is authenticated
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Verify caller is an owner
        const callerToken = authHeader.replace('Bearer ', '');
        const { data: { user: caller } } = await supabaseAdmin.auth.getUser(callerToken);
        if (!caller) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Check caller has owner role
        const { data: callerRoles } = await supabaseAdmin
            .from('user_roles')
            .select('role_id')
            .eq('user_id', caller.id);

        const ownerRoleId = '00000000-0000-0000-0000-000000000001';
        const isOwner = callerRoles?.some(r => r.role_id === ownerRoleId);
        if (!isOwner) {
            return new Response(JSON.stringify({ error: 'Only owners can invite managers' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Get caller's group
        const { data: callerProfile } = await supabaseAdmin
            .from('profiles')
            .select('group_id')
            .eq('id', caller.id)
            .single();

        if (!callerProfile?.group_id) {
            return new Response(JSON.stringify({ error: 'Owner has no group' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { firstName, lastName, locationId } = await req.json();

        if (!firstName || !lastName || !locationId) {
            return new Response(JSON.stringify({ error: 'firstName, lastName, locationId required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Generate credentials
        const email = `${sanitizeName(firstName)}.${sanitizeName(lastName)}@josephine.com`;
        const password = generatePassword();
        const fullName = `${firstName} ${lastName}`;

        // Create auth user (auto-confirmed)
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
        });

        if (createError) {
            return new Response(JSON.stringify({ error: createError.message }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const userId = newUser.user.id;

        // Set profile group_id
        await supabaseAdmin
            .from('profiles')
            .update({ group_id: callerProfile.group_id, full_name: fullName })
            .eq('id', userId);

        // Assign manager role with location scope
        const managerRoleId = '00000000-0000-0000-0000-000000000002';
        await supabaseAdmin
            .from('user_roles')
            .insert({
                user_id: userId,
                role_id: managerRoleId,
                location_id: locationId,
            });

        // Send invitation email
        if (RESEND_API_KEY) {
            // Get location name
            const { data: location } = await supabaseAdmin
                .from('locations')
                .select('name')
                .eq('id', locationId)
                .single();

            const locationName = location?.name || 'tu local';

            const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
          <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;margin:0 auto 16px;line-height:48px;">
            <span style="color:#ffffff;font-size:24px;font-weight:bold;">J</span>
          </div>
          <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">Bienvenido a Josephine</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">Hola ${fullName},</p>
          <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 24px;">
            Has sido invitado como <strong>Manager</strong> de <strong>${locationName}</strong> en Josephine.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="padding:16px;background:#f1f5f9;border-radius:8px;">
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Tus credenciales</p>
              <p style="margin:0 0 4px;font-size:15px;color:#1e293b;"><strong>Email:</strong> ${email}</p>
              <p style="margin:0;font-size:15px;color:#1e293b;"><strong>Contrasena:</strong> ${password}</p>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="https://josephine-ai.com/login" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                Iniciar sesion
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="font-size:12px;color:#94a3b8;margin:0;">Te recomendamos cambiar tu contrasena tras el primer inicio de sesion.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: 'Josephine <josephine@josephine-ai.com>',
                    to: [email],
                    subject: `Tu acceso a Josephine - Manager de ${locationName}`,
                    html: htmlContent,
                }),
            });
        }

        return new Response(JSON.stringify({
            success: true,
            email,
            userId,
            locationId,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('Invite manager error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
