/**
 * PrivacyPolicy — GDPR-compliant privacy policy page.
 * Route: /privacidad
 */

import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2 text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-full bg-emerald-50 p-3">
            <Shield className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Política de Privacidad</h1>
            <p className="text-sm text-gray-500">Última actualización: Marzo 2025</p>
          </div>
        </div>

        <div className="prose prose-sm prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">1. Responsable del tratamiento</h2>
            <p>
              Josephine (en adelante, "nosotros") es el responsable del tratamiento de tus datos
              personales. Puedes contactarnos en{' '}
              <a href="mailto:privacy@josephine.app" className="text-emerald-600 hover:underline">
                privacy@josephine.app
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">2. Datos que recopilamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Datos de cuenta:</strong> nombre, email, contraseña (hash).</li>
              <li><strong>Datos del negocio:</strong> recetas, inventario, ventas, horarios de personal.</li>
              <li><strong>Datos de uso:</strong> páginas visitadas, acciones realizadas (solo con consentimiento).</li>
              <li><strong>Datos técnicos:</strong> dirección IP, navegador, dispositivo.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">3. Base legal del tratamiento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Ejecución del contrato:</strong> para proporcionar el servicio que contratas.</li>
              <li><strong>Consentimiento:</strong> para cookies analíticas y de marketing.</li>
              <li><strong>Interés legítimo:</strong> para mejorar la seguridad y prevenir fraude.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">4. Cookies</h2>
            <p>Utilizamos los siguientes tipos de cookies:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Esenciales:</strong> necesarias para la autenticación y funcionamiento. No requieren consentimiento.</li>
              <li><strong>Analíticas:</strong> miden el uso de la aplicación para mejorarla. Requieren consentimiento.</li>
              <li><strong>Marketing:</strong> permiten comunicaciones personalizadas. Requieren consentimiento.</li>
            </ul>
            <p>
              Puedes gestionar tus preferencias en cualquier momento desde{' '}
              <strong>Ajustes → Privacidad</strong> o haciendo clic en el enlace de cookies del pie de página.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">5. Tus derechos (RGPD)</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Acceso:</strong> solicitar una copia de tus datos personales.</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos.</li>
              <li><strong>Supresión:</strong> solicitar la eliminación de tus datos ("derecho al olvido").</li>
              <li><strong>Portabilidad:</strong> recibir tus datos en formato JSON.</li>
              <li><strong>Oposición:</strong> oponerte al tratamiento en determinadas circunstancias.</li>
              <li><strong>Limitación:</strong> restringir el uso de tus datos.</li>
            </ul>
            <p>
              Puedes ejercer estos derechos desde <strong>Ajustes → Privacidad</strong> o
              contactando a{' '}
              <a href="mailto:privacy@josephine.app" className="text-emerald-600 hover:underline">
                privacy@josephine.app
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">6. Retención de datos</h2>
            <p>
              Conservamos tus datos mientras tu cuenta esté activa. Si solicitas la eliminación,
              aplicamos un periodo de gracia de 30 días tras el cual los datos se eliminan
              permanentemente. Los datos agregados y anonimizados pueden conservarse indefinidamente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">7. Seguridad</h2>
            <p>
              Tus datos se almacenan en servidores seguros con cifrado en tránsito (TLS 1.3) y en
              reposo (AES-256). Las contraseñas se almacenan con hash bcrypt. Utilizamos Row Level
              Security (RLS) para garantizar que solo accedes a tus propios datos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">8. Contacto</h2>
            <p>
              Para cualquier consulta sobre privacidad:{' '}
              <a href="mailto:privacy@josephine.app" className="text-emerald-600 hover:underline">
                privacy@josephine.app
              </a>
            </p>
            <p>
              Autoridad de control: Agencia Española de Protección de Datos (AEPD) —{' '}
              <a href="https://www.aepd.es" className="text-emerald-600 hover:underline" target="_blank" rel="noopener">
                www.aepd.es
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
