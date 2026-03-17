/**
 * Square OAuth Callback Page
 * Receives the authorization code from Square's redirect,
 * exchanges it for tokens via Edge Function, then redirects to the integration page.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function SquareOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      setError(searchParams.get('error_description') || oauthError);
      return;
    }

    if (!code || !state) {
      setError('Missing authorization code or state parameter');
      return;
    }

    // Exchange the code for tokens via the Edge Function
    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/square-oauth-exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ code, state }),
        });

        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.error || `Exchange failed (${resp.status})`);
        }

        // Redirect to integration page with success flag
        navigate('/integrations/square?connected=true', { replace: true });
      } catch (err: any) {
        console.error('OAuth exchange error:', err);
        setError(err.message);
      }
    })();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-md p-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Error conectando Square</h2>
          <p className="text-muted-foreground">{error}</p>
          <button
            className="text-primary underline"
            onClick={() => navigate('/integrations/square')}
          >
            Volver a intentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h2 className="text-xl font-semibold">Conectando con Square...</h2>
        <p className="text-muted-foreground">Intercambiando credenciales. No cierres esta ventana.</p>
      </div>
    </div>
  );
}
