import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChefHat, Loader2, ArrowLeft, Users, ChevronRight, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';


const DEMO_PASSWORD = 'Demo1234!';
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockdownSeconds, setLockdownSeconds] = useState(0);
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Lockdown countdown timer
  useEffect(() => {
    if (lockedUntil && lockedUntil > Date.now()) {
      const tick = () => {
        const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
        setLockdownSeconds(remaining);
        if (remaining <= 0) {
          setLockedUntil(null);
          setFailedAttempts(0);
          if (lockTimerRef.current) clearInterval(lockTimerRef.current);
        }
      };
      tick();
      lockTimerRef.current = setInterval(tick, 1000);
      return () => { if (lockTimerRef.current) clearInterval(lockTimerRef.current); };
    }
  }, [lockedUntil]);

  const isLockedOut = lockedUntil !== null && lockedUntil > Date.now();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut) {
      toast({
        variant: "destructive",
        title: t('auth.loginError'),
        description: t('auth.tooManyAttempts', { seconds: lockdownSeconds }),
      });
      return;
    }

    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
        toast({
          variant: "destructive",
          title: t('auth.loginError'),
          description: t('auth.tooManyAttempts', { seconds: LOCKOUT_SECONDS }),
        });
      } else {
        toast({
          variant: "destructive",
          title: t('auth.loginError'),
          description: `${error.message}\n${t('auth.remainingAttempts', { count: MAX_ATTEMPTS - newAttempts })}`,
        });
      }
    } else {
      setFailedAttempts(0);
      setLockedUntil(null);
      navigate('/');
    }

    setLoading(false);
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setDemoLoading(demoEmail);
    console.log('[demo-login] clicked', { demoEmail });
    toast({
      title: t('auth.startingDemo'),
      description: t('auth.enteringAs', { email: demoEmail }),
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
          title: t('auth.demoLoginError'),
          description: error.message
        });
      } else {
        toast({
          title: t('auth.welcomeDemo'),
          description: t('auth.exploreJosephine')
        });
        navigate('/');
      }
    } catch (err) {
      console.error('Demo login error:', err);
      toast({
        variant: "destructive",
        title: t('auth.demoLoginError'),
        description: t('auth.demoLoginFailed')
      });
    }

    setDemoLoading(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        variant: "destructive",
        title: t('auth.loginError'),
        description: t('auth.enterEmail')
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
                {resetEmailSent ? t('auth.emailSent') : t('auth.recoverPassword')}
              </CardTitle>
              <CardDescription>
                {resetEmailSent
                  ? t('auth.checkInbox')
                  : t('auth.sendResetEmail')
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetEmailSent ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center"
                    dangerouslySetInnerHTML={{ __html: t('auth.resetEmailSentMsg', { email }) }}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmailSent(false);
                    }}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('auth.backToLogin')}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">{t('auth.email')}</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('auth.sendResetLink')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('auth.goBack')}
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
            <CardTitle className="text-2xl font-display">{t('auth.welcomeJosephine')}</CardTitle>
            <CardDescription>{t('auth.smartManagement')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    {t('auth.forgotPassword')}
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
              {isLockedOut && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
                  <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                  <span>{t('auth.tooManyAttempts', { seconds: lockdownSeconds })}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || isLockedOut}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('auth.login')}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t('auth.or')}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={signInWithGoogle}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {t('auth.continueWithGoogle')}
            </Button>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {t('auth.noAccount')}{' '}
              <Link to="/signup" className="text-primary hover:underline">
                {t('auth.registerNow')}
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
                <p className="font-semibold text-sm">{t('auth.tryJosephine')}</p>
                <p className="text-xs text-muted-foreground">{t('auth.accessDemoMode')}</p>
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
