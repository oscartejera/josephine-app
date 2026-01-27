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

type RetryablePostgrestError = {
  code?: string;
  message?: string;
  details?: unknown;
  hint?: unknown;
};

function isRetryableDbError(err: unknown): boolean {
  const e = err as RetryablePostgrestError | undefined;
  // PGRST002: schema cache unavailable / db temporarily unreachable
  return e?.code === 'PGRST002' || (typeof e?.message === 'string' && e.message.includes('schema cache'));
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  {
    retries = 8,
    initialDelayMs = 400,
    maxDelayMs = 4000,
  }: { retries?: number; initialDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  let delay = initialDelayMs;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableDbError(err) || attempt === retries) break;
      console.log(`[seed_demo_users] retry ${attempt + 1}/${retries} in ${delay}ms`);
      await sleep(delay);
      delay = Math.min(maxDelayMs, delay * 2);
    }
  }

  throw lastErr;
}

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
    const demoGroupRes = await withRetry(async () => {
      const res = await supabaseAdmin
        .from('groups')
        .select('id')
        .eq('name', 'Demo Group')
        .maybeSingle();

      if (res.error) throw res.error;
      return res;
    });

    const demoGroup = demoGroupRes.data;

    let groupId: string;
    
    if (!demoGroup) {
      // Create group if it doesn't exist
      const newGroupRes = await withRetry(async () => {
        const res = await supabaseAdmin
          .from('groups')
          .insert({ name: 'Demo Group' })
          .select('id')
          .single();
        if (res.error) throw res.error;
        return res;
      });
      
      groupId = newGroupRes.data.id;
    } else {
      groupId = demoGroup.id;
    }

    // 2. Get locations
    const locationsRes = await withRetry(async () => {
      const res = await supabaseAdmin
        .from('locations')
        .select('id, name')
        .eq('group_id', groupId);
      if (res.error) throw res.error;
      return res;
    });

    const locationMap: Record<string, string> = {};
    if (locationsRes.data) {
      for (const loc of locationsRes.data) {
        locationMap[loc.name] = loc.id;
      }
    }

    // 3. Get roles
    const rolesRes = await withRetry(async () => {
      const res = await supabaseAdmin
        .from('roles')
        .select('id, name');
      if (res.error) throw res.error;
      return res;
    });

    const roleMap: Record<string, string> = {};
    if (rolesRes.data) {
      for (const role of rolesRes.data) {
        roleMap[role.name] = role.id;
      }
    }

    // 4. Create demo users if they don't exist
    const results: { email: string; status: string }[] = [];

    // List users once (cheap) instead of once per demo user
    const existingUsersRes = await supabaseAdmin.auth.admin.listUsers();
    const existingUsers = existingUsersRes.data?.users ?? [];

    for (const demoUser of DEMO_USERS) {
      try {
        // Check if user already exists
        const existingUser = existingUsers.find((u) => u.email === demoUser.email);

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
        await withRetry(async () => {
          const res = await supabaseAdmin
            .from('profiles')
            .upsert(
              {
                id: userId,
                full_name: demoUser.full_name,
                group_id: groupId,
              },
              { onConflict: 'id' }
            );
          if (res.error) throw res.error;
          return res;
        });

        // Check and assign role
        const roleId = roleMap[demoUser.role];
        if (roleId) {
          const locationId = demoUser.location ? locationMap[demoUser.location] : null;
          
          const existingRoleRes = await withRetry(async () => {
            const res = await supabaseAdmin
              .from('user_roles')
              .select('id')
              .eq('user_id', userId)
              .eq('role_id', roleId)
              .maybeSingle();
            if (res.error) throw res.error;
            return res;
          });

          if (!existingRoleRes.data) {
            await withRetry(async () => {
              const res = await supabaseAdmin
                .from('user_roles')
                .insert({
                  user_id: userId,
                  role_id: roleId,
                  location_id: locationId,
                });
              if (res.error) throw res.error;
              return res;
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
    // If the DB is temporarily unavailable (PGRST002), don't hard-fail the demo login.
    // Return 200 with a retryable payload so the frontend doesn't treat it as an exception.
    const retryable = isRetryableDbError(error);
    console.error('Error seeding demo data:', error);

    return new Response(
      JSON.stringify({
        success: false,
        retryable,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: retryable ? 200 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...(retryable ? { 'Retry-After': '3' } : {}),
        },
      }
    );
  }
});
