/**
 * PrivacyPolicy — GDPR-compliant privacy policy page.
 * Route: /privacidad
 */

import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function PrivacyPolicy() {
  const { t } = useTranslation();
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
          {t('privacyPolicy.volver')}
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-full bg-emerald-50 p-3">
            <Shield className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('gdpr.privacyPolicy')}</h1>
            <p className="text-sm text-gray-500">{t('privacypolicy.ultima_actualizacion_marzo_2025')}</p>
          </div>
        </div>

        <div className="prose prose-sm prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">{t('privacyPolicy.1ResponsableDelTratamiento')}</h2>
            <p>
              Josephine (en adelante, "nosotros") es el responsable del tratamiento de tus datos
              personales. Puedes contactarnos en{' '}
              <a href="mailto:privacy@josephine.app" className="text-emerald-600 hover:underline">
                {t('privacyPolicy.privacyjosephineapp')}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{t('privacyPolicy.2DatosQueRecopilamos')}</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>{t('privacyPolicy.datosDeCuenta')}</strong>{t('privacypolicy.nombre_email_contrasena_hash')}</li>
              <li><strong>{t('privacyPolicy.datosDelNegocio')}</strong> {t('privacyPolicy.recetasInventarioVentasHorariosDe')}</li>
              <li><strong>{t('privacyPolicy.datosDeUso')}</strong>{t('privacypolicy.paginas_visitadas_acciones_realizadas_solo_con_con')}</li>
              <li><strong>{t('privacypolicy.datos_tecnicos')}</strong> {t('privacyPolicy.direccionIpNavegadorDispositivo')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{t('privacyPolicy.3BaseLegalDelTratamiento')}</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>{t('privacypolicy.ejecucion_del_contrato')}</strong> {t('privacyPolicy.paraProporcionarElServicioQue')}</li>
              <li><strong>{t('privacyPolicy.consentimiento')}</strong>{t('privacypolicy.para_cookies_analiticas_y_de_marketing')}</li>
              <li><strong>{t('privacypolicy.interes_legitimo')}</strong> {t('privacyPolicy.paraMejorarLaSeguridadY')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{t('privacyPolicy.4Cookies')}</h2>
            <p>{t('privacyPolicy.utilizamosLosSiguientesTiposDe')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>{t('privacyPolicy.esenciales')}</strong>{t('privacypolicy.necesarias_para_la_autenticacion_y_funcionamiento_')}</li>
              <li><strong>{t('privacypolicy.analiticas')}</strong> {t('privacyPolicy.midenElUsoDeLa')}</li>
              <li><strong>{t('privacyPolicy.marketing')}</strong> {t('privacyPolicy.permitenComunicacionesPersonalizadasRequ')}</li>
            </ul>
            <p>
              Puedes gestionar tus preferencias en cualquier momento desde{' '}
              <strong>{t('privacyPolicy.ajustesPrivacidad')}</strong> {t('privacyPolicy.oHaciendoClicEnEl')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{t('privacyPolicy.5TusDerechosRgpd')}</h2>
            <p>{t('privacyPolicy.tienesDerechoA')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>{t('privacyPolicy.acceso')}</strong> {t('privacyPolicy.solicitarUnaCopiaDeTus')}</li>
              <li><strong>{t('privacypolicy.rectificacion')}</strong> {t('privacyPolicy.corregirDatosInexactos')}</li>
              <li><strong>{t('privacypolicy.supresion')}</strong> {t('privacyPolicy.solicitarLaEliminacionDeTus')}</li>
              <li><strong>{t('privacyPolicy.portabilidad')}</strong> {t('privacyPolicy.recibirTusDatosEnFormato')}</li>
              <li><strong>{t('privacypolicy.oposicion')}</strong> {t('privacyPolicy.oponerteAlTratamientoEnDeterminadas')}</li>
              <li><strong>{t('privacypolicy.limitacion')}</strong> {t('privacyPolicy.restringirElUsoDeTus')}</li>
            </ul>
            <p>
              {t('privacyPolicy.puedesEjercerEstosDerechosDesde')} <strong>{t('privacyPolicy.ajustesPrivacidad1')}</strong> o
              contactando a{' '}
              <a href="mailto:privacy@josephine.app" className="text-emerald-600 hover:underline">
                {t('privacyPolicy.privacyjosephineapp1')}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{t('privacypolicy.6_retencion_de_datos')}</h2>
            <p>
              {t('privacyPolicy.conservamosTusDatosMientrasTu')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{t('privacyPolicy.7Seguridad')}</h2>
            <p>
              {t('privacyPolicy.tusDatosSeAlmacenanEn')}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{t('privacyPolicy.8Contacto')}</h2>
            <p>
              Para cualquier consulta sobre privacidad:{' '}
              <a href="mailto:privacy@josephine.app" className="text-emerald-600 hover:underline">
                {t('privacyPolicy.privacyjosephineapp2')}
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
