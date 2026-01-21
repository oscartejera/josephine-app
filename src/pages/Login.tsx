import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChefHat, Loader2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Demo mode flag - set to true to show demo logins
const DEMO_MODE = true;

const DEMO_USERS = [
  { label: 'Owner', email: 'owner@demo.com', description: 'Acceso completo' },
  { label: 'Ops Manager', email: 'ops@demo.com', description: 'Operaciones globales' },
  { label: 'Manager Centro', email: 'manager.centro@demo.com', description: 'Solo La Taberna Centro' },
  { label: 'Employee Centro', email: 'employee.centro@demo.com', description: 'Empleado Centro' },
  { label: 'Manager Salamanca', email: 'manager.salamanca@demo.com', description: 'Solo Salamanca' },
];

const DEMO_PASSWORD = 'Demo1234!';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const seedDemoUsers = async () => {
    setSeedingDemo(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed_demo_users');
      
      if (error) {
        console.error('Error seeding demo users:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudieron crear los usuarios demo. Intenta de nuevo."
        });
        return false;
      }

      console.log('Demo seed result:', data);
      return true;
    } catch (err) {
      console.error('Error calling seed function:', err);
      return false;
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      // If login fails and it's a demo email, try seeding first
      if (DEMO_MODE && DEMO_USERS.some(u => u.email === email)) {
        toast({
          title: "Creando usuarios demo...",
          description: "Por favor espera mientras se configuran los datos."
        });
        
        const seeded = await seedDemoUsers();
        if (seeded) {
          // Retry login after seeding
          const { error: retryError } = await signIn(email, password);
          if (retryError) {
            toast({
              variant: "destructive",
              title: "Error al iniciar sesión",
              description: retryError.message
            });
          } else {
            navigate('/dashboard');
          }
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error al iniciar sesión",
          description: error.message
        });
      }
    } else {
      navigate('/dashboard');
    }
    
    setLoading(false);
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setLoading(true);

    // Try login first
    let { error } = await signIn(demoEmail, DEMO_PASSWORD);
    
    if (error) {
      // If login fails, seed demo users and retry
      toast({
        title: "Preparando demo...",
        description: "Creando usuarios y datos de ejemplo."
      });
      
      const seeded = await seedDemoUsers();
      if (seeded) {
        // Wait a moment for the seed to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Retry login
        const retryResult = await signIn(demoEmail, DEMO_PASSWORD);
        error = retryResult.error;
      }
    }
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo iniciar sesión demo. Intenta de nuevo."
      });
    } else {
      navigate('/dashboard');
    }
    
    setLoading(false);
  };

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
                  disabled={loading || seedingDemo}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || seedingDemo}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || seedingDemo}>
                {(loading || seedingDemo) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

        {/* Demo Logins Section */}
        {DEMO_MODE && (
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-base">Demo Logins</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Prueba diferentes roles con un clic. Contraseña: {DEMO_PASSWORD}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-2">
                {DEMO_USERS.map((user) => (
                  <Button
                    key={user.email}
                    variant="outline"
                    size="sm"
                    className="w-full justify-between h-auto py-2"
                    onClick={() => handleDemoLogin(user.email)}
                    disabled={loading || seedingDemo}
                  >
                    <div className="text-left">
                      <div className="font-medium">{user.label}</div>
                      <div className="text-xs text-muted-foreground">{user.description}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
