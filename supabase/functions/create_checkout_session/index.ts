/**
 * create_checkout_session — Stripe Checkout for subscription upgrades
 * Called from frontend Pricing page to create a Stripe Checkout session.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Auth check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('No authorization header');

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

        if (!stripeSecretKey) {
            return new Response(
                JSON.stringify({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY in Supabase secrets.' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Verify user
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error('Unauthorized');

        // Get org info
        const { data: profile } = await supabase
            .from('profiles')
            .select('group_id, full_name')
            .eq('id', user.id)
            .single();

        const { priceId, successUrl, cancelUrl } = await req.json();
        if (!priceId) throw new Error('priceId is required');

        // Init Stripe
        const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

        // Check if customer exists
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        let customerId: string;

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

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: successUrl || `${req.headers.get('origin')}/settings/billing?success=true`,
            cancel_url: cancelUrl || `${req.headers.get('origin')}/settings/billing?canceled=true`,
            subscription_data: {
                trial_period_days: 14,
                metadata: {
                    supabase_user_id: user.id,
                    group_id: profile?.group_id || '',
                },
            },
            allow_promotion_codes: true,
        });

        return new Response(
            JSON.stringify({ url: session.url, sessionId: session.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('Checkout error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
