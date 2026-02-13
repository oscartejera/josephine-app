import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ChefHat, Loader2, Mail, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface EmailOTPVerificationProps {
  email: string;
  fullName: string;
  password: string;
  onVerified: () => void;
  onBack: () => void;
}

export function EmailOTPVerification({ 
  email, 
  fullName, 
  password, 
  onVerified, 
  onBack 
}: EmailOTPVerificationProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Send OTP on mount
    sendOTP();
  }, []);

  useEffect(() => {
    if (countdown > 0 && !canResend) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCanResend(true);
    }
  }, [countdown, canResend]);

  const sendOTP = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send_email_otp', {
        body: { email, fullName },
      });

      if (error) throw error;

      toast({
        title: "Código enviado",
        description: `Hemos enviado un código de 6 dígitos a ${email}`
      });
    } catch (error: unknown) {
      console.error('Error sending OTP:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo enviar el código. Intenta de nuevo."
      });
    }
  };

  const handleResend = async () => {
    setResending(true);
    setCode('');
    await sendOTP();
    setCountdown(60);
    setCanResend(false);
    setResending(false);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast({
        variant: "destructive",
        title: "Código incompleto",
        description: "Por favor ingresa el código de 6 dígitos"
      });
      return;
    }

    setLoading(true);

    try {
      // Verify OTP
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('send_email_otp', {
        body: { email, code },
        headers: { 'x-action': 'verify' }
      });

      // Check response for verification
      const response = await supabase.functions.invoke('send_email_otp?action=verify', {
        body: { email, code }
      });

      if (response.error || !response.data?.valid) {
        toast({
          variant: "destructive",
          title: "Código inválido",
          description: "El código es incorrecto o ha expirado"
        });
        setLoading(false);
        return;
      }

      // OTP verified, now create the user account
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin
        }
      });

      if (signUpError) {
        toast({
          variant: "destructive",
          title: "Error al crear cuenta",
          description: signUpError.message
        });
        setLoading(false);
        return;
      }

      toast({
        title: "¡Cuenta creada!",
        description: "Tu cuenta ha sido verificada y creada exitosamente."
      });
      
      onVerified();
    } catch (error: unknown) {
      console.error('Verification error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error al verificar. Intenta de nuevo."
      });
    }

    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
          <Mail className="w-6 h-6 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl font-display">Verifica tu email</CardTitle>
        <CardDescription>
          Ingresa el código de 6 dígitos que enviamos a{' '}
          <span className="font-medium text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            disabled={loading}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button 
          onClick={handleVerify} 
          className="w-full" 
          disabled={loading || code.length !== 6}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verificar código
        </Button>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            ¿No recibiste el código?
          </p>
          {canResend ? (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Reenviar código
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Reenviar en {countdown}s
            </p>
          )}
        </div>

        <Button 
          variant="outline" 
          className="w-full"
          onClick={onBack}
          disabled={loading}
        >
          Volver
        </Button>
      </CardContent>
    </Card>
  );
}
