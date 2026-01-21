import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const DEMO_PASSWORD = 'Demo1234!';

const DEMO_LOCATIONS = [
  { name: 'La Taberna Centro', city: 'Madrid' },
  { name: 'Salamanca', city: 'Madrid' },
  { name: 'Chamberí', city: 'Madrid' },
  { name: 'Malasaña', city: 'Madrid' },
];

const DEMO_USERS = [
  { email: 'owner@demo.com', full_name: 'Demo Owner', role: 'owner', location: null },
  { email: 'ops@demo.com', full_name: 'Demo Ops Manager', role: 'ops_manager', location: null },
  { email: 'manager.centro@demo.com', full_name: 'Manager Centro', role: 'store_manager', location: 'La Taberna Centro' },
  { email: 'employee.centro@demo.com', full_name: 'Employee Centro', role: 'employee', location: 'La Taberna Centro' },
  { email: 'manager.salamanca@demo.com', full_name: 'Manager Salamanca', role: 'store_manager', location: 'Salamanca' },
];

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    const results: { step: string; status: string; details?: unknown }[] = [];

    // 1. Get or create demo group
    let groupId: string;
    const { data: existingGroup } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('name', 'Demo Group')
      .single();

    if (existingGroup) {
      groupId = existingGroup.id;
      results.push({ step: 'group', status: 'exists', details: { id: groupId } });
    } else {
      const { data: newGroup, error: groupError } = await supabaseAdmin
        .from('groups')
        .insert({ name: 'Demo Group' })
        .select('id')
        .single();

      if (groupError) throw new Error(`Failed to create group: ${groupError.message}`);
      groupId = newGroup.id;
      results.push({ step: 'group', status: 'created', details: { id: groupId } });
    }

    // 2. Create or get demo locations
    const locationMap: Record<string, string> = {};
    
    for (const loc of DEMO_LOCATIONS) {
      const { data: existing } = await supabaseAdmin
        .from('locations')
        .select('id')
        .eq('name', loc.name)
        .eq('group_id', groupId)
        .single();

      if (existing) {
        locationMap[loc.name] = existing.id;
      } else {
        const { data: newLoc, error: locError } = await supabaseAdmin
          .from('locations')
          .insert({ name: loc.name, city: loc.city, group_id: groupId })
          .select('id')
          .single();

        if (locError) throw new Error(`Failed to create location ${loc.name}: ${locError.message}`);
        locationMap[loc.name] = newLoc.id;
      }
    }
    results.push({ step: 'locations', status: 'ready', details: locationMap });

    // 3. Get role IDs
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('id, name');

    if (rolesError || !roles) throw new Error(`Failed to fetch roles: ${rolesError?.message}`);
    
    const roleMap: Record<string, string> = {};
    for (const role of roles) {
      roleMap[role.name] = role.id;
    }
    results.push({ step: 'roles', status: 'fetched', details: roleMap });

    // 4. Create demo users and assign roles
    for (const demoUser of DEMO_USERS) {
      // Check if user exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find(u => u.email === demoUser.email);

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        results.push({ step: `user_${demoUser.email}`, status: 'exists', details: { id: userId } });
      } else {
        // Create new user
        const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
          email: demoUser.email,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: demoUser.full_name }
        });

        if (userError) throw new Error(`Failed to create user ${demoUser.email}: ${userError.message}`);
        userId = newUser.user.id;
        results.push({ step: `user_${demoUser.email}`, status: 'created', details: { id: userId } });
      }

      // Update profile with group_id
      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          full_name: demoUser.full_name,
          group_id: groupId
        });

      // Get role ID
      const roleId = roleMap[demoUser.role];
      if (!roleId) throw new Error(`Role ${demoUser.role} not found`);

      // Get location ID if applicable
      const locationId = demoUser.location ? locationMap[demoUser.location] : null;

      // Check if role assignment exists
      const { data: existingRoleAssignment } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_id', roleId)
        .maybeSingle();

      if (!existingRoleAssignment) {
        // Assign role
        const { error: roleAssignError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userId,
            role_id: roleId,
            location_id: locationId
          });

        if (roleAssignError) {
          results.push({ 
            step: `role_assign_${demoUser.email}`, 
            status: 'error', 
            details: roleAssignError.message 
          });
        } else {
          results.push({ 
            step: `role_assign_${demoUser.email}`, 
            status: 'assigned',
            details: { role: demoUser.role, location: demoUser.location }
          });
        }
      } else {
        results.push({ 
          step: `role_assign_${demoUser.email}`, 
          status: 'exists',
          details: { role: demoUser.role, location: demoUser.location }
        });
      }
    }

    // 5. Seed demo data (products, sales, etc.) if not already done
    try {
      await supabaseAdmin.rpc('seed_roles_and_permissions');
      results.push({ step: 'seed_permissions', status: 'done' });
    } catch (e) {
      results.push({ step: 'seed_permissions', status: 'skipped', details: String(e) });
    }

    try {
      await supabaseAdmin.rpc('seed_demo_products_and_sales', { p_group_id: groupId });
      results.push({ step: 'seed_products', status: 'done' });
    } catch (e) {
      results.push({ step: 'seed_products', status: 'skipped', details: String(e) });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Demo users and data seeded successfully',
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error seeding demo data:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
