/**
 * create_checkout_session — Stripe Checkout for subscription upgrades
 * Called from frontend Pricing page to create a Stripe Checkout session.
 * 
 * Production-hardened with comprehensive error handling and logging.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const respond = (body: Record<string, unknown>, status = 200) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    try {
        console.log('[checkout] Request received');

        // 1. Check Stripe key
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeSecretKey) {
            console.error('[checkout] STRIPE_SECRET_KEY not set');
            return respond({ error: 'Stripe no configurado. Contacta soporte.' }, 500);
        }
        console.log('[checkout] Stripe key found, length:', stripeSecretKey.length);

        // 2. Parse request body
        let body: { priceId?: string; successUrl?: string; cancelUrl?: string };
        try {
            body = await req.json();
        } catch {
            return respond({ error: 'Invalid request body' }, 400);
        }

        const { priceId, successUrl, cancelUrl } = body;
        if (!priceId) {
            return respond({ error: 'priceId es requerido' }, 400);
        }
        console.log('[checkout] Price ID:', priceId);

        // 3. Auth check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return respond({ error: 'No autorizado — falta token de autenticacion' }, 401);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.error('[checkout] Auth error:', authError?.message);
            return respond({ error: `No autorizado: ${authError?.message || 'token invalido'}` }, 401);
        }
        console.log('[checkout] User authenticated:', user.email);

        // 4. Get org info
        const { data: profile } = await supabase
            .from('profiles')
            .select('group_id, full_name')
            .eq('id', user.id)
            .single();

        // 5. Init Stripe
        let stripe: Stripe;
        try {
            stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
        } catch (e: any) {
            console.error('[checkout] Stripe init error:', e.message);
            return respond({ error: `Error inicializando Stripe: ${e.message}` }, 500);
        }

        // 6. Find or create customer
        let customerId: string;
        try {
            const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
            if (customers.data.length > 0) {
                customerId = customers.data[0].id;
                console.log('[checkout] Existing customer:', customerId);
            } else {
                const customer = await stripe.customers.create({
                    email: user.email!,
                    name: profile?.full_name || undefined,
                    metadata: {
                        supabase_user_id: user.id,
                        group_id: profile?.group_id || '',
                    },
                });
                customerId = customer.id;
                console.log('[checkout] New customer created:', customerId);
            }
        } catch (e: any) {
            console.error('[checkout] Customer error:', e.message);
            return respond({ error: `Error con cliente Stripe: ${e.message}` }, 500);
        }

        // 7. Create checkout session
        try {
            const origin = req.headers.get('origin') || 'https://josephine-ai.com';
            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                mode: 'subscription',
                line_items: [{ price: priceId, quantity: 1 }],
                success_url: successUrl || `${origin}/settings/billing?success=true`,
                cancel_url: cancelUrl || `${origin}/settings/billing?canceled=true`,
                subscription_data: {
                    trial_period_days: 14,
                    metadata: {
                        supabase_user_id: user.id,
                        group_id: profile?.group_id || '',
                    },
                },
                allow_promotion_codes: true,
            });

            console.log('[checkout] Session created:', session.id, 'URL:', session.url);
            return respond({ url: session.url, sessionId: session.id });
        } catch (e: any) {
            console.error('[checkout] Session creation error:', e.message, e.type, e.code);
            return respond({
                error: `Error creando sesion de pago: ${e.message}`,
                type: e.type,
                code: e.code,
            }, 400);
        }
    } catch (error: any) {
        console.error('[checkout] Unexpected error:', error.message, error.stack);
        return respond({ error: `Error inesperado: ${error.message}` }, 500);
    }
});
