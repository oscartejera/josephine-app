/**
 * Support — Contact and help page.
 * Route: /support
 */

import { ArrowLeft, Mail, Clock, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Support() {
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
            <MessageCircle className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Soporte</h1>
            <p className="text-sm text-gray-500">Estamos aquí para ayudarte</p>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border bg-white p-6">
            <div className="flex items-start gap-4">
              <Mail className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Contacto por email</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Para cualquier consulta, problema técnico o sugerencia, escríbenos a:
                </p>
                <a
                  href="mailto:soporte@josephine.app"
                  className="mt-2 inline-block text-emerald-600 font-medium hover:underline"
                >
                  soporte@josephine.app
                </a>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <div className="flex items-start gap-4">
              <Clock className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Horario de atención</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Nuestro equipo responde de lunes a viernes, de 9:00 a 18:00 (CET).
                  Intentamos responder en menos de 24 horas laborables.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Preguntas frecuentes</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">¿Cómo ficho entrada/salida?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Desde la app móvil, pulsa el botón "Fichar entrada" en la pestaña Reloj.
                  Para fichar salida, pulsa "Fichar salida" cuando hayas terminado.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">¿Cómo solicito un cambio de turno?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Ve a la pestaña Horario, selecciona el turno que quieres cambiar y pulsa
                  "Solicitar intercambio". Elige el compañero con quien quieres intercambiar.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">¿Dónde veo mi nómina?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Accede a la pestaña Nómina desde la app. Ahí verás todos tus períodos
                  de pago con los detalles de horas trabajadas y salario.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">¿Cómo contacto con mi manager?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Tu manager puede contactarte a través de las noticias del equipo
                  o directamente por los canales habituales del restaurante.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Privacidad</h2>
            <p className="text-sm text-gray-600">
              Consulta nuestra{' '}
              <a
                href="/legal/privacy"
                className="text-emerald-600 hover:underline"
              >
                Política de Privacidad
              </a>{' '}
              para conocer cómo tratamos tus datos personales.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
