import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface InviteUserRequest {
  email: string;
  full_name: string;
  role_id: string;
  location_id: string | null;
  group_id: string;
}

// Generate a secure random password
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  for (let i = 0; i < 12; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the request is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify permissions
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const inviterId = claimsData.user.id;

    // Check if user has permission to invite (is owner or has settings.users.manage)
    const { data: hasPermission } = await userClient.rpc('has_permission', {
      _user_id: inviterId,
      _permission_key: 'settings.users.manage',
      _location_id: null
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'No tienes permisos para invitar usuarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, full_name, role_id, location_id, group_id }: InviteUserRequest = await req.json();

    // Validate required fields
    if (!email || !full_name || !role_id || !group_id) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with service role key
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

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === email);

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Ya existe un usuario con este email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get role info to validate
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id, name')
      .eq('id', role_id)
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Rol no encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate location requirement for certain roles
    const locationRequiredRoles = ['employee', 'store_manager'];
    if (locationRequiredRoles.includes(roleData.name) && !location_id) {
      return new Response(
        JSON.stringify({ error: `El rol "${roleData.name}" requiere una ubicación específica` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get location name if provided
    let locationName = 'Todas las ubicaciones';
    if (location_id) {
      const { data: locationData } = await supabaseAdmin
        .from('locations')
        .select('name')
        .eq('id', location_id)
        .single();
      
      if (locationData) {
        locationName = locationData.name;
      }
    }

    // Generate password
    const password = generatePassword();

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: `Error al crear usuario: ${createError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = newUser.user.id;

    // Update profile with group_id and full_name
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name,
        group_id
      });

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Assign role with location scope
    const { error: roleAssignError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id,
        location_id
      });

    if (roleAssignError) {
      console.error('Error assigning role:', roleAssignError);
      // Clean up: delete the user if role assignment fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Error al asignar rol: ${roleAssignError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get inviter's name for the email
    const { data: inviterProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', inviterId)
      .single();

    const inviterName = inviterProfile?.full_name || 'El administrador';

    // Get group name
    const { data: groupData } = await supabaseAdmin
      .from('groups')
      .select('name')
      .eq('id', group_id)
      .single();

    const groupName = groupData?.name || 'Josephine';

    // Send welcome email with credentials using Resend API directly
    const appUrl = req.headers.get('origin') || 'https://josephine.lovable.app';
    
    try {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7c3aed; margin-bottom: 10px;">🍽️ Josephine</h1>
            <p style="color: #666; font-size: 14px;">Gestión inteligente para restaurantes</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0;">¡Hola, ${full_name}!</h2>
            <p style="margin: 0; opacity: 0.9;">Te han invitado a unirte al equipo de <strong>${groupName}</strong></p>
          </div>
          
          <div style="background: #f8fafc; padding: 25px; border-radius: 12px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #475569;">Tus credenciales de acceso:</h3>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #e2e8f0;">
              <p style="margin: 5px 0; font-size: 14px;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 5px 0; font-size: 14px;"><strong>Contraseña:</strong> <code style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
            </div>
            
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <p style="margin: 5px 0; font-size: 14px;"><strong>Rol:</strong> ${roleData.name}</p>
              <p style="margin: 5px 0; font-size: 14px;"><strong>Ubicación:</strong> ${locationName}</p>
            </div>
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${appUrl}/login" style="display: inline-block; background: #7c3aed; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Acceder a Josephine
            </a>
          </div>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 13px; color: #92400e;">
              ⚠️ <strong>Importante:</strong> Te recomendamos cambiar tu contraseña después de iniciar sesión por primera vez.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          
          <p style="font-size: 13px; color: #64748b; text-align: center;">
            Invitación enviada por ${inviterName}
          </p>
        </body>
        </html>
      `;

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Josephine <onboarding@resend.dev>',
          to: [email],
          subject: `¡Bienvenido a ${groupName}! - Tus credenciales de acceso`,
          html: emailHtml
        })
      });

      const emailResult = await emailResponse.json();
      console.log('Welcome email sent:', emailResult);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the whole request if email fails - user was created successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Usuario ${full_name} creado exitosamente. Se ha enviado un email con las credenciales.`,
        user_id: userId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in invite_team_member:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
