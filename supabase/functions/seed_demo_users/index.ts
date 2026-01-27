import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const DEMO_PASSWORD = 'Demo1234!';

const DEMO_USERS = [
  { email: 'owner@demo.com', full_name: 'Demo Owner', role: 'owner', location: null },
  { email: 'ops@demo.com', full_name: 'Demo Ops Manager', role: 'ops_manager', location: null },
  { email: 'manager.centro@demo.com', full_name: 'Manager Centro', role: 'store_manager', location: 'La Taberna Centro' },
  { email: 'employee.centro@demo.com', full_name: 'Employee Centro', role: 'employee', location: 'La Taberna Centro' },
  { email: 'manager.salamanca@demo.com', full_name: 'Manager Salamanca', role: 'store_manager', location: 'Salamanca' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    // 1. Get Demo Group (should already exist)
    const { data: demoGroup, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('name', 'Demo Group')
      .maybeSingle();

    if (groupError) {
      console.error('Error fetching demo group:', groupError);
      throw new Error(`Database error: ${groupError.message}`);
    }

    let groupId: string;
    
    if (!demoGroup) {
      // Create group if it doesn't exist
      const { data: newGroup, error: createError } = await supabaseAdmin
        .from('groups')
        .insert({ name: 'Demo Group' })
        .select('id')
        .single();
      
      if (createError) throw new Error(`Failed to create group: ${createError.message}`);
      groupId = newGroup.id;
    } else {
      groupId = demoGroup.id;
    }

    // 2. Get locations
    const { data: locations } = await supabaseAdmin
      .from('locations')
      .select('id, name')
      .eq('group_id', groupId);

    const locationMap: Record<string, string> = {};
    if (locations) {
      for (const loc of locations) {
        locationMap[loc.name] = loc.id;
      }
    }

    // 3. Get roles
    const { data: roles } = await supabaseAdmin
      .from('roles')
      .select('id, name');

    const roleMap: Record<string, string> = {};
    if (roles) {
      for (const role of roles) {
        roleMap[role.name] = role.id;
      }
    }

    // 4. Create demo users if they don't exist
    const results: { email: string; status: string }[] = [];

    for (const demoUser of DEMO_USERS) {
      try {
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users.find(u => u.email === demoUser.email);

        let userId: string;

        if (existingUser) {
          userId = existingUser.id;
          results.push({ email: demoUser.email, status: 'exists' });
        } else {
          // Create user
          const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: demoUser.email,
            password: DEMO_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: demoUser.full_name }
          });

          if (userError) {
            results.push({ email: demoUser.email, status: `error: ${userError.message}` });
            continue;
          }
          userId = newUser.user.id;
          results.push({ email: demoUser.email, status: 'created' });
        }

        // Ensure profile exists
        await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            full_name: demoUser.full_name,
            group_id: groupId
          }, { onConflict: 'id' });

        // Check and assign role
        const roleId = roleMap[demoUser.role];
        if (roleId) {
          const locationId = demoUser.location ? locationMap[demoUser.location] : null;
          
          const { data: existingRole } = await supabaseAdmin
            .from('user_roles')
            .select('id')
            .eq('user_id', userId)
            .eq('role_id', roleId)
            .maybeSingle();

          if (!existingRole) {
            await supabaseAdmin
              .from('user_roles')
              .insert({
                user_id: userId,
                role_id: roleId,
                location_id: locationId
              });
          }
        }
      } catch (userErr) {
        console.error(`Error processing user ${demoUser.email}:`, userErr);
        results.push({ email: demoUser.email, status: 'error' });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error seeding demo data:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
