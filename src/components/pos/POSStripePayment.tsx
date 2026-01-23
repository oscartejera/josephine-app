import { useState, useEffect } from 'react';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { CreditCard, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Initialize Stripe with live publishable key
const stripePromise = loadStripe('pk_live_51SsXizC46WZ7nQ8jQMm0oKqU4Dg3MXzakAT1jE6vqqHn3aJ8Zsa1OrKpoDvgay7ew4LDc73yVZhBVFiYcKSNJhxi00rb2FXHT7');

interface POSStripePaymentProps {
  amount: number; // in euros
  ticketId: string;
  locationId: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
}

interface PaymentFormProps {
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
}

// Inner component that uses Stripe hooks
function PaymentForm({ amount, onSuccess, onError, onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;

    setLoading(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href, // Not used since we handle inline
        },
        redirect: 'if_required',
      });

      if (error) {
        console.error('[STRIPE] Payment error:', error);
        onError(error.message || 'Error al procesar el pago');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('[STRIPE] Payment succeeded:', paymentIntent.id);
        onSuccess(paymentIntent.id);
      } else {
        onError('El pago no se completó correctamente');
      }
    } catch (err) {
      console.error('[STRIPE] Unexpected error:', err);
      onError('Error inesperado al procesar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-lg p-4">
        <PaymentElement 
          onReady={() => setReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!stripe || !elements || !ready || loading}
          className="flex-1 h-12 text-lg"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <CreditCard className="h-5 w-5 mr-2" />
              Pagar €{amount.toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Main component that wraps with Stripe Elements
export function POSStripePayment({
  amount,
  ticketId,
  locationId,
  onSuccess,
  onError,
  onCancel,
}: POSStripePaymentProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        setLoading(true);
        setError(null);

        // Convert euros to cents
        const amountInCents = Math.round(amount * 100);

        const { data, error: fnError } = await supabase.functions.invoke('process_stripe_payment', {
          body: {
            amount: amountInCents,
            currency: 'eur',
            ticket_id: ticketId,
            location_id: locationId,
          },
        });

        if (fnError) {
          throw new Error(fnError.message || 'Error al crear la intención de pago');
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (!data?.client_secret) {
          throw new Error('No se recibió el secreto del cliente');
        }

        setClientSecret(data.client_secret);
      } catch (err) {
        console.error('[STRIPE] Error creating payment intent:', err);
        const message = err instanceof Error ? err.message : 'Error al inicializar el pago';
        setError(message);
        onError(message);
      } finally {
        setLoading(false);
      }
    };

    if (amount >= 0.50) {
      createPaymentIntent();
    } else {
      setError('El monto mínimo es €0.50');
      setLoading(false);
    }
  }, [amount, ticketId, locationId, onError]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparando pago seguro...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-6 space-y-3">
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <p className="text-sm text-destructive text-center">{error}</p>
        <Button variant="outline" onClick={onCancel}>
          Volver
        </Button>
      </div>
    );
  }

  if (!clientSecret) {
    return null;
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: 'hsl(var(--primary))',
            colorBackground: 'hsl(var(--card))',
            colorText: 'hsl(var(--foreground))',
            colorDanger: 'hsl(var(--destructive))',
            borderRadius: '8px',
          },
        },
        locale: 'es',
      }}
    >
      <PaymentForm
        amount={amount}
        onSuccess={onSuccess}
        onError={onError}
        onCancel={onCancel}
      />
    </Elements>
  );
}
