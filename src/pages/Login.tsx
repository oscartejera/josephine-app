import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChefHat, Loader2, ArrowLeft, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BackendHealthIndicator } from '@/components/auth/BackendHealthIndicator';
import { useBackendHealth } from '@/hooks/useBackendHealth';

const DEMO_ACCOUNTS = [
  { label: 'Owner', email: 'owner@demo.com', description: 'Acceso completo' },
  { label: 'Ops Manager', email: 'ops@demo.com', description: 'Multi-local' },
  { label: 'Manager Centro', email: 'manager.centro@demo.com', description: 'Solo Centro' },
  { label: 'Employee Centro', email: 'employee.centro@demo.com', description: 'Vista limitada' },
  { label: 'Manager Salamanca', email: 'manager.salamanca@demo.com', description: 'Solo Salamanca' },
];

const DEMO_PASSWORD = 'Demo1234!';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { health } = useBackendHealth();

  const isRetryableAuthError = (err: unknown) => {
    const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
    return (
      msg.includes('504') ||
      msg.includes('timeout') ||
      msg.includes('upstream request timeout') ||
      msg.includes('failed to fetch')
    );
  };

  const isUserNotFoundError = (err: unknown) => {
    const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
    return msg.includes('invalid login credentials') || msg.includes('user not found');
  };

  const signInWithRetry = async (emailToUse: string, passwordToUse: string, maxAttempts = 3) => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { error } = await signIn(emailToUse, passwordToUse);
      if (!error) return { error: null };

      lastError = error;

      if (!isRetryableAuthError(error) || attempt === maxAttempts) {
        return { error };
      }

      const waitMs = 600 * attempt;
      await new Promise((r) => setTimeout(r, waitMs));
    }

    return { error: lastError };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signInWithRetry(email, password);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Error al iniciar sesión",
        description: error.message
      });
    } else {
      navigate('/dashboard');
    }
    
    setLoading(false);
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setDemoLoading(demoEmail);
    console.log('[demo-login] started', { demoEmail, backendStatus: health.status });

    // Check backend health first
    if (health.status === 'offline') {
      toast({
        variant: "destructive",
        title: "Backend no disponible",
        description: "El servidor no responde. Inténtalo en 30 segundos."
      });
      setDemoLoading(null);
      return;
    }

    toast({
      title: 'Iniciando sesión…',
      description: `Entrando como ${demoEmail}`,
    });

    try {
      // STEP 1: Try login FIRST (users already exist in production)
      const { error: loginError } = await signInWithRetry(demoEmail, DEMO_PASSWORD, 3);

      if (!loginError) {
        // Login succeeded! Fire-and-forget seed to refresh demo data
        console.log('[demo-login] login succeeded, seeding in background');
        supabase.functions.invoke('seed_demo_users').catch(() => {});
        
        toast({
          title: "¡Bienvenido al modo demo!",
          description: "Explora Josephine con datos de ejemplo"
        });
        navigate('/dashboard');
        setDemoLoading(null);
        return;
      }

      console.log('[demo-login] login failed, checking error type', loginError.message);

      // STEP 2: If "user not found", try seeding (max 3 attempts, 5s each)
      if (isUserNotFoundError(loginError)) {
        toast({
          title: 'Preparando demo…',
          description: 'Creando usuarios demo por primera vez.',
        });

        let seedSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { error: seedError } = await supabase.functions.invoke('seed_demo_users');
          if (!seedError) {
            seedSuccess = true;
            break;
          }
          console.warn(`[demo-login] seed attempt ${attempt} failed`, seedError);
          if (attempt < 3) await new Promise((r) => setTimeout(r, 1500));
        }

        if (seedSuccess) {
          // Wait briefly for propagation, then retry login
          await new Promise((r) => setTimeout(r, 500));
          const { error: retryError } = await signInWithRetry(demoEmail, DEMO_PASSWORD, 2);
          
          if (!retryError) {
            toast({
              title: "¡Bienvenido al modo demo!",
              description: "Explora Josephine con datos de ejemplo"
            });
            navigate('/dashboard');
            setDemoLoading(null);
            return;
          }
        }
      }

      // STEP 3: Handle persistent errors with clear feedback
      if (isRetryableAuthError(loginError) || health.status === 'degraded') {
        toast({
          variant: "destructive",
          title: "Backend lento",
          description: "El servidor está tardando. Inténtalo en 30 segundos."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error al iniciar sesión demo",
          description: loginError.message
        });
      }
    } catch (err) {
      console.error('[demo-login] unexpected error:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo iniciar sesión. Inténtalo de nuevo."
      });
    }
    
    setDemoLoading(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor ingresa tu email"
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    } else {
      setResetEmailSent(true);
    }

    setLoading(false);
  };

  // Forgot password view
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
                <ChefHat className="w-6 h-6 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-display">
                {resetEmailSent ? "Email enviado" : "Recuperar contraseña"}
              </CardTitle>
              <CardDescription>
                {resetEmailSent 
                  ? "Revisa tu bandeja de entrada para continuar" 
                  : "Te enviaremos un enlace para restablecer tu contraseña"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetEmailSent ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Hemos enviado un email a <strong>{email}</strong> con instrucciones para restablecer tu contraseña.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmailSent(false);
                    }}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al inicio de sesión
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar enlace de recuperación
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost" 
                    className="w-full"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Backend Health Indicator */}
        <BackendHealthIndicator />
        
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
              <ChefHat className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-display">Bienvenido a Josephine</CardTitle>
            <CardDescription>Gestión inteligente para tu restaurante</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar sesión
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{' '}
              <Link to="/signup" className="text-primary hover:underline">
                Regístrate
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Demo Mode Section */}
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Modo Demo
            </CardTitle>
            <CardDescription>
              Prueba Josephine con diferentes roles y permisos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                variant="outline"
                className="w-full justify-between h-auto py-3"
                onClick={() => handleDemoLogin(account.email)}
                disabled={demoLoading !== null}
              >
                <div className="text-left">
                  <div className="font-medium">{account.label}</div>
                  <div className="text-xs text-muted-foreground">{account.description}</div>
                </div>
                {demoLoading === account.email && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
