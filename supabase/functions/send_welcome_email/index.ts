import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { email, fullName, restaurantName } = await req.json();

        if (!email) {
            return new Response(JSON.stringify({ error: 'Email is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const name = fullName || 'there';
        const restaurant = restaurantName || 'tu restaurante';

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
              <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;margin:0 auto 16px;line-height:48px;">
                <span style="color:#ffffff;font-size:24px;font-weight:bold;">J</span>
              </div>
              <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">Bienvenido a Josephine</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">Hola ${name},</p>
              <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 24px;">
                Tu cuenta para <strong>${restaurant}</strong> ya está activa en Josephine. Aquí tienes lo esencial para empezar:
              </p>

              <!-- Tips -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 16px;background:#f1f5f9;border-radius:8px;margin-bottom:8px;">
                    <p style="margin:0;font-size:14px;color:#334155;"><strong>1. Conecta tu POS</strong> — Square o Lightspeed para importar ventas automáticamente.</p>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px;background:#f1f5f9;border-radius:8px;">
                    <p style="margin:0;font-size:14px;color:#334155;"><strong>2. Configura tu equipo</strong> — Añade empleados desde Workforce para gestionar turnos.</p>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px;background:#f1f5f9;border-radius:8px;">
                    <p style="margin:0;font-size:14px;color:#334155;"><strong>3. Tu primera previsión</strong> — En 24h tendrás tu primer forecast de ventas y demanda.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://josephine-ai.com/dashboard" 
                       style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                      Abrir Josephine
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="font-size:12px;color:#94a3b8;margin:0;">
                Josephine — Gestión inteligente para tu restaurante
              </p>
              <p style="font-size:12px;color:#94a3b8;margin:4px 0 0;">
                ¿Necesitas ayuda? Responde a este email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: 'Josephine <josephine@josephine-ai.com>',
                to: [email],
                subject: `Bienvenido a Josephine, ${name}`,
                html: htmlContent,
            }),
        });

        const result = await res.json();

        return new Response(JSON.stringify({ success: true, id: result.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Welcome email error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
