import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qixipveebfhurbarksib.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpeGlwdmVlYmZodXJiYXJrc2liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA4OTg5MywiZXhwIjoyMDg2NjY1ODkzfQ.12A4ocHkOX86VnVA2nRm4oxZVL6jEHYE02-rJlVj9Qg'
);

const DEMO_USER_ID = '97de0d62-b79f-45f4-801b-d4d6ba0f2caf';

async function main() {
  console.log('🔍 Checking existing demo employee...');
  
  // Check if employee exists
  const { data: existingEmp } = await supabase
    .from('employees')
    .select('id, email, org_id, location_id')
    .eq('profile_user_id', DEMO_USER_ID)
    .maybeSingle();

  if (existingEmp) {
    console.log('✅ Employee exists:', existingEmp.email, existingEmp.id);
    await seedDataForEmployee(existingEmp.id, existingEmp.org_id, existingEmp.location_id);
    process.exit(0);
  }

  // Find location with org
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, group_id')
    .limit(1);

  if (!locations || locations.length === 0) {
    console.error('❌ No locations found.');
    process.exit(1);
  }

  const loc = locations[0];
  const orgId = loc.group_id;
  console.log(`Using location: ${loc.name} (${loc.id}), org: ${orgId}`);

  // Create employee
  console.log('👤 Creating demo employee...');
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .insert({
      profile_user_id: DEMO_USER_ID,
      full_name: 'Demo Reviewer',
      email: 'demo@josephine.app',
      phone: '+34600000000',
      role_name: 'Waiter',
      status: 'active',
      location_id: loc.id,
      org_id: orgId,
      hourly_rate: 12.50
    })
    .select()
    .single();

  if (empErr) {
    console.error('❌ Employee creation failed:', empErr.message);
    // Try without org_id if not needed
    console.log('Trying without org_id...');
    const { data: emp2, error: empErr2 } = await supabase
      .from('employees')
      .insert({
        profile_user_id: DEMO_USER_ID,
        full_name: 'Demo Reviewer',
        email: 'demo@josephine.app',
        phone: '+34600000000',
        role_name: 'Waiter',
        status: 'active',
        location_id: loc.id,
        hourly_rate: 12.50
      })
      .select()
      .single();

    if (empErr2) {
      console.error('❌ 2nd attempt failed:', empErr2.message);
      process.exit(1);
    }
    console.log('✅ Employee created:', emp2.id);
    await seedDataForEmployee(emp2.id, orgId, loc.id);
  } else {
    console.log('✅ Employee created:', emp.id);
    await seedDataForEmployee(emp.id, orgId, loc.id);
  }

  process.exit(0);
}

async function seedDataForEmployee(empId, orgId, locationId) {
  const today = new Date();

  // SHIFTS (planned_shifts)
  console.log('📅 Seeding shifts...');
  const shifts = [];
  for (let i = -7; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0) continue; // skip Sunday
    shifts.push({
      employee_id: empId,
      location_id: locationId,
      shift_date: d.toISOString().split('T')[0],
      start_time: i < 0 ? '09:00' : '10:00',
      end_time: i < 0 ? '17:00' : '18:00',
      break_minutes: 30,
      status: i < 0 ? 'completed' : 'scheduled'
    });
  }
  const { error: shiftErr } = await supabase.from('planned_shifts').insert(shifts);
  if (shiftErr) console.error('⚠️ Shifts:', shiftErr.message);
  else console.log(`✅ ${shifts.length} shifts`);

  // CLOCK RECORDS (employee_clock_records)
  console.log('⏰ Seeding clock records...');
  const clocks = [];
  for (let i = 1; i <= 5; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const ci = new Date(d); ci.setHours(9, Math.floor(Math.random() * 10), 0, 0);
    const co = new Date(d); co.setHours(17, Math.floor(Math.random() * 15), 0, 0);
    clocks.push({
      employee_id: empId,
      location_id: locationId,
      clock_in: ci.toISOString(),
      clock_out: co.toISOString(),
      source: 'manual'
    });
  }
  const { error: clockErr } = await supabase.from('employee_clock_records').insert(clocks);
  if (clockErr) console.error('⚠️ Clocks:', clockErr.message);
  else console.log(`✅ ${clocks.length} clock records`);

  // ANNOUNCEMENT
  console.log('📢 Seeding announcement...');
  const { error: annErr } = await supabase.from('announcements').insert({
    org_id: orgId,
    location_id: locationId,
    title: 'Bienvenido al equipo',
    body: 'Esta es una cuenta de demostración con datos de ejemplo para revisión de App Store.',
    type: 'news',
    is_pinned: false,
    author_name: 'Sistema'
  });
  if (annErr) console.error('⚠️ Announcement:', annErr.message);
  else console.log('✅ Announcement');

  console.log('\n🎉 Demo account ready!');
  console.log('   Email: demo@josephine.app');
  console.log('   Password: AppleReview2025!');
}

main().catch(e => { console.error(e); process.exit(1); });
