/**
 * stripe_webhook — Handle Stripe webhook events
 * Processes subscription lifecycle events and updates org plan in Supabase.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

serve(async (req) => {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!stripeSecretKey || !webhookSecret) {
        return new Response('Stripe not configured', { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, sig!, webhookSecret);
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const groupId = subscription.metadata?.group_id;
                if (!groupId) break;

                const status = subscription.status;
                const priceId = subscription.items.data[0]?.price?.id;

                // Determine plan from price
                let plan = 'free';
                if (priceId?.includes('pro')) plan = 'pro';
                if (priceId?.includes('enterprise')) plan = 'enterprise';

                // Update org plan
                await supabase
                    .from('groups')
                    .update({
                        plan,
                        stripe_subscription_id: subscription.id,
                        stripe_customer_id: subscription.customer as string,
                        subscription_status: status,
                    } as any)
                    .eq('id', groupId);

                console.log(`Updated group ${groupId} to plan=${plan}, status=${status}`);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const groupId = subscription.metadata?.group_id;
                if (!groupId) break;

                await supabase
                    .from('groups')
                    .update({
                        plan: 'free',
                        subscription_status: 'canceled',
                    } as any)
                    .eq('id', groupId);

                console.log(`Downgraded group ${groupId} to free`);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                console.error(`Payment failed for invoice ${invoice.id}`);
                // TODO: Send email notification to customer
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
    } catch (err: any) {
        console.error('Webhook processing error:', err);
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
    });
});
