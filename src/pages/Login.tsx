import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChefHat, Loader2, ArrowLeft, Users, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';



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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error al iniciar sesión",
        description: error.message
      });
    } else {
      navigate('/');
    }

    setLoading(false);
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setDemoLoading(demoEmail);
    console.log('[demo-login] clicked', { demoEmail });
    toast({
      title: 'Iniciando demo…',
      description: `Entrando como ${demoEmail}`,
    });

    try {
      // First, try to seed demo users if they don't exist
      const { error: seedError } = await supabase.functions.invoke('seed_demo_users');

      if (seedError) {
        console.warn('Could not seed demo users:', seedError);
      }

      // Wait a moment for data to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now try to login
      const { error } = await signIn(demoEmail, DEMO_PASSWORD);

      if (error) {
        toast({
          variant: "destructive",
          title: "Error al iniciar sesión demo",
          description: error.message
        });
      } else {
        toast({
          title: "¡Bienvenido al modo demo!",
          description: "Explora Josephine con datos de ejemplo"
        });
        navigate('/');
      }
    } catch (err) {
      console.error('Demo login error:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo iniciar sesión en modo demo"
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

        {/* Demo Access */}
        <button
          onClick={() => handleDemoLogin('owner@demo.com')}
          disabled={demoLoading !== null}
          className="w-full group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 p-4 text-left transition-all hover:shadow-lg hover:border-primary/40 hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">Probar Josephine</p>
                <p className="text-xs text-muted-foreground">Accede al modo demo con datos de ejemplo</p>
              </div>
            </div>
            {demoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
