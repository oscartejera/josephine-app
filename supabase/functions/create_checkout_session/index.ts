/**
 * create_checkout_session — Stripe Checkout for subscription upgrades
 * 
 * IMPORTANT: Always returns HTTP 200 with JSON body.
 * supabase.functions.invoke discards the body on non-2xx responses,
 * so we put errors in { error: "..." } within a 200 response.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Always return 200 so supabase.functions.invoke can read the body */
const respond = (body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Stripe key
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeSecretKey) {
            return respond({ error: 'Stripe no configurado. Contacta soporte.' });
        }

        // 2. Parse body
        let body: { priceId?: string; successUrl?: string; cancelUrl?: string };
        try {
            body = await req.json();
        } catch {
            return respond({ error: 'Request body invalido' });
        }

        const { priceId, successUrl, cancelUrl } = body;
        if (!priceId) {
            return respond({ error: 'priceId es requerido' });
        }

        // 3. Auth
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return respond({ error: 'No autorizado — inicia sesion de nuevo' });
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const token = authHeader.replace('Bearer ', '');

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return respond({ error: `Sesion expirada — cierra e inicia sesion de nuevo` });
        }

        // 4. Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('group_id, full_name')
            .eq('id', user.id)
            .single();

        // 5. Stripe
        const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

        // 6. Customer
        let customerId: string;
        const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
        if (customers.data.length > 0) {
            customerId = customers.data[0].id;
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
        }

        // 7. Checkout session
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

        return respond({ url: session.url, sessionId: session.id });
    } catch (error: any) {
        console.error('[checkout] Error:', error.message);
        return respond({ error: error.message || 'Error inesperado' });
    }
});
