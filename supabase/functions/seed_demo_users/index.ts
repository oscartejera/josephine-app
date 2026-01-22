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

    // 5. Seed employees for timesheets/labour data
    const employeeRoles = ['Jefe de Cocina', 'Cocinero', 'Camarero', 'Camarera', 'Ayudante Cocina'];
    const createdEmployees: { id: string; locationId: string }[] = [];
    
    for (const [locName, locId] of Object.entries(locationMap)) {
      // Check if employees exist for this location
      const { data: existingEmployees } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('location_id', locId)
        .limit(1);
      
      if (!existingEmployees || existingEmployees.length === 0) {
        // Create 5 employees per location
        for (let i = 0; i < 5; i++) {
          const { data: emp, error: empError } = await supabaseAdmin
            .from('employees')
            .insert({
              location_id: locId,
              full_name: `${employeeRoles[i]} ${locName.split(' ')[0]}`,
              role_name: employeeRoles[i],
              hourly_cost: 12 + Math.random() * 8, // €12-20/hour
              active: true
            })
            .select('id')
            .single();
          
          if (!empError && emp) {
            createdEmployees.push({ id: emp.id, locationId: locId });
          }
        }
      }
    }
    results.push({ step: 'employees', status: 'ready', details: { count: createdEmployees.length } });

    // 6. Seed timesheets for the last 30 days
    const now = new Date();
    for (const [, locId] of Object.entries(locationMap)) {
      const { data: locEmployees } = await supabaseAdmin
        .from('employees')
        .select('id, hourly_cost')
        .eq('location_id', locId);
      
      if (locEmployees && locEmployees.length > 0) {
        // Check if timesheets exist
        const { data: existingTs } = await supabaseAdmin
          .from('timesheets')
          .select('id')
          .eq('location_id', locId)
          .limit(1);
        
        if (!existingTs || existingTs.length === 0) {
          const timesheetInserts = [];
          
          for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
            const date = new Date(now);
            date.setDate(date.getDate() - dayOffset);
            const dateStr = date.toISOString().split('T')[0];
            
            for (const emp of locEmployees) {
              // Random shift (some days off)
              if (Math.random() > 0.2) {
                const shiftStart = 9 + Math.floor(Math.random() * 4); // 9-12
                const shiftLength = 6 + Math.floor(Math.random() * 4); // 6-9 hours
                const minutes = shiftLength * 60;
                const laborCost = (emp.hourly_cost || 15) * shiftLength;
                
                timesheetInserts.push({
                  employee_id: emp.id,
                  location_id: locId,
                  clock_in: `${dateStr}T${String(shiftStart).padStart(2, '0')}:00:00`,
                  clock_out: `${dateStr}T${String(shiftStart + shiftLength).padStart(2, '0')}:00:00`,
                  minutes,
                  labor_cost: laborCost,
                  approved: true
                });
              }
            }
          }
          
          if (timesheetInserts.length > 0) {
            await supabaseAdmin.from('timesheets').insert(timesheetInserts);
          }
        }
      }
    }
    results.push({ step: 'timesheets', status: 'seeded' });

    // 7. Seed tickets for the last 30 days
    for (const [, locId] of Object.entries(locationMap)) {
      const { data: existingTickets } = await supabaseAdmin
        .from('tickets')
        .select('id')
        .eq('location_id', locId)
        .limit(1);
      
      if (!existingTickets || existingTickets.length === 0) {
        const ticketInserts = [];
        
        for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
          const date = new Date(now);
          date.setDate(date.getDate() - dayOffset);
          const dateStr = date.toISOString().split('T')[0];
          
          // Create 30-60 tickets per day per location
          const ticketCount = 30 + Math.floor(Math.random() * 30);
          for (let t = 0; t < ticketCount; t++) {
            const hour = 11 + Math.floor(Math.random() * 12); // 11:00 - 22:00
            const grossTotal = 15 + Math.random() * 85; // €15-100
            const covers = 1 + Math.floor(Math.random() * 4);
            
            ticketInserts.push({
              location_id: locId,
              opened_at: `${dateStr}T${String(hour).padStart(2, '0')}:00:00`,
              closed_at: `${dateStr}T${String(hour).padStart(2, '0')}:45:00`,
              gross_total: grossTotal,
              net_total: grossTotal * 0.9,
              tax_total: grossTotal * 0.1,
              covers,
              status: 'closed',
              channel: ['dinein', 'takeaway', 'delivery'][Math.floor(Math.random() * 3)]
            });
          }
        }
        
        if (ticketInserts.length > 0) {
          await supabaseAdmin.from('tickets').insert(ticketInserts);
        }
      }
    }
    results.push({ step: 'tickets', status: 'seeded' });

    // 8. Seed inventory items for the group
    const { data: existingInv } = await supabaseAdmin
      .from('inventory_items')
      .select('id')
      .eq('group_id', groupId)
      .limit(1);
    
    if (!existingInv || existingInv.length === 0) {
      const inventoryItems = [
        { name: 'Tomate', category: 'Verduras', current_stock: 15, par_level: 25, unit: 'kg', last_cost: 2.5 },
        { name: 'Cebolla', category: 'Verduras', current_stock: 8, par_level: 15, unit: 'kg', last_cost: 1.8 },
        { name: 'Aceite de Oliva', category: 'Aceites', current_stock: 5, par_level: 12, unit: 'L', last_cost: 8.5 },
        { name: 'Solomillo', category: 'Carnes', current_stock: 3, par_level: 10, unit: 'kg', last_cost: 28 },
        { name: 'Gambas', category: 'Mariscos', current_stock: 2, par_level: 8, unit: 'kg', last_cost: 22 },
        { name: 'Vino Rioja', category: 'Bebidas', current_stock: 12, par_level: 24, unit: 'botellas', last_cost: 9.5 },
        { name: 'Jamón Ibérico', category: 'Embutidos', current_stock: 1.5, par_level: 5, unit: 'kg', last_cost: 85 },
        { name: 'Queso Manchego', category: 'Lácteos', current_stock: 3, par_level: 8, unit: 'kg', last_cost: 18 },
        { name: 'Patatas', category: 'Verduras', current_stock: 20, par_level: 30, unit: 'kg', last_cost: 1.2 },
        { name: 'Pimiento Rojo', category: 'Verduras', current_stock: 4, par_level: 10, unit: 'kg', last_cost: 3.5 },
      ];
      
      await supabaseAdmin.from('inventory_items').insert(
        inventoryItems.map(item => ({ ...item, group_id: groupId }))
      );
    }
    results.push({ step: 'inventory', status: 'seeded' });

    // 9. Seed planned_shifts for variance analysis
    for (const [, locId] of Object.entries(locationMap)) {
      const { data: locEmployees } = await supabaseAdmin
        .from('employees')
        .select('id, role_name')
        .eq('location_id', locId);
      
      const { data: existingShifts } = await supabaseAdmin
        .from('planned_shifts')
        .select('id')
        .eq('location_id', locId)
        .limit(1);
      
      if (locEmployees && locEmployees.length > 0 && (!existingShifts || existingShifts.length === 0)) {
        const shiftInserts = [];
        
        for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
          const date = new Date(now);
          date.setDate(date.getDate() - dayOffset);
          const dateStr = date.toISOString().split('T')[0];
          
          for (const emp of locEmployees) {
            if (Math.random() > 0.15) {
              const shiftStart = 9 + Math.floor(Math.random() * 3);
              const plannedHours = 7 + Math.floor(Math.random() * 2);
              
              shiftInserts.push({
                employee_id: emp.id,
                location_id: locId,
                shift_date: dateStr,
                start_time: `${String(shiftStart).padStart(2, '0')}:00`,
                end_time: `${String(shiftStart + plannedHours).padStart(2, '0')}:00`,
                planned_hours: plannedHours,
                planned_cost: plannedHours * 15,
                role: emp.role_name,
                status: 'published'
              });
            }
          }
        }
        
        if (shiftInserts.length > 0) {
          await supabaseAdmin.from('planned_shifts').insert(shiftInserts);
        }
      }
    }
    results.push({ step: 'planned_shifts', status: 'seeded' });

    // 10. Trigger forecast generation via generate_forecast edge function
    // The LR+SI v3 model generates daily forecasts stored in forecast_daily_metrics
    // Hourly distribution is handled client-side using HOURLY_WEIGHTS
    try {
      // Call generate_forecast for each location
      for (const [locName, locId] of Object.entries(locationMap)) {
        const forecastResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate_forecast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ location_id: locId, horizon_days: 365 })
        });
        
        if (!forecastResp.ok) {
          console.warn(`Forecast generation for ${locName} returned ${forecastResp.status}`);
        }
      }
      results.push({ step: 'forecasts', status: 'generated via LR+SI v3' });
    } catch (e) {
      results.push({ step: 'forecasts', status: 'skipped', details: String(e) });
    }

    // Legacy seeds
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
