/**
 * Batch 2: Remaining toasts + strings for SquareIntegration, Lightspeed,
 * Availability, ClockInPanel, ScheduleSettings, LocationWizard,
 * EventCalendar, TrainingTracker, EmployeeReviews, EmploymentContracts,
 * AdminTools, PaymentHistoryManager
 */
import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.join('src', 'i18n', 'locales');
const esPath = path.join(LOCALES_DIR, 'es.json');
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));

// ─── Add missing locale keys ───────────────────────────────────
const extraKeys = {
  square: {
    ...es.square,
    toastConnected: "Square conectado correctamente",
    toastImported: "Datos importados correctamente",
    toastSyncInitialError: "Error en la sincronización inicial",
    toastDataAvailable: "Datos disponibles. Puedes sincronizar manualmente si necesitas actualizar.",
    toastConnectError: "Error conectando Square",
    toastOrgNotFound: "No se encontró la organización. Recarga la página.",
    toastStartError: "Error iniciando conexión",
    toastSyncing: "Sincronización en curso",
    toastSyncComplete: "Sincronización completada",
    toastSyncFailed: "Error sincronizando",
    toastDisconnected: "Square desconectado. Mostrando datos de demostración.",
    toastDisconnectError: "Error al desconectar"
  },
  lightspeed: {
    toastConnected: "¡Lightspeed conectado correctamente!",
    toastConnectError: "Error al iniciar conexión",
    toastSyncComplete: "Sincronización completada",
    toastSyncError: "Error en sincronización",
    toastDisconnected: "Lightspeed desconectado"
  },
  availability: {
    toastSaved: "Disponibilidad guardada correctamente",
    toastSaveError: "Error al guardar disponibilidad",
    toastTimeOffSubmitted: "Solicitud de ausencia enviada",
    toastApproved: "Solicitud aprobada",
    toastRejected: "Solicitud rechazada",
    toastCancelled: "Solicitud cancelada"
  },
  scheduleSettings: {
    toastSaveError: "Error guardando",
    toastSaved: "Ajustes de horario guardados"
  },
  clockIn: {
    toastNotFound: "No se encontró tu registro de empleado",
    toastClockInOk: "Entrada registrada correctamente",
    toastClockInError: "Error al registrar entrada",
    toastClockOutOk: "Salida registrada correctamente",
    toastClockOutError: "Error al registrar salida"
  },
  eventCalendar: {
    toastAdded: "Evento añadido",
    toastError: "Error",
    toastDeleted: "Evento eliminado"
  },
  locationWizard: {
    toastSessionExpired: "Tu sesión ha expirado. Por favor, inicia sesión de nuevo.",
    toastPermissionsError: "Error de permisos. Recarga la página e intenta de nuevo.",
    toastNoPermissions: "No tienes permisos para crear locales. Verifica que tienes rol de propietario.",
    toastCreated: "Local creado correctamente",
    toastCreateError: "Error creando el local"
  },
  trainingTracker: {
    toastCertAdded: "Certificado añadido",
    toastError: "Error"
  },
  employeeReviews: {
    ...es.employeeReviews,
    toastSaved: "Evaluación guardada",
    toastSaveError: "Error al guardar"
  },
  contracts: {
    ...es.contracts,
    toastSelectEmployee: "Selecciona un empleado",
    toastUpdateError: "Error al actualizar contrato",
    toastUpdated: "Contrato actualizado",
    toastCreateError: "Error al crear contrato",
    toastCreated: "Contrato creado",
    toastStatusError: "Error al cambiar estado"
  },
  adminTools: {
    toast18Months: "18 meses de datos generados exitosamente!",
    toast30Days: "30 días de datos generados!"
  },
  paymentHistory: {
    toastLoadError: "Error al cargar los pagos"
  }
};

for (const [section, keys] of Object.entries(extraKeys)) {
  if (!es[section]) es[section] = {};
  Object.assign(es[section], keys);
}
fs.writeFileSync(esPath, JSON.stringify(es, null, 2) + '\n', 'utf8');
console.log('✅ es.json updated with batch 2 keys');

// ─── Process files ─────────────────────────────────────────────

function processFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipped (not found): ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Ensure useTranslation import
  if (!content.includes('useTranslation')) {
    // Try to add after first import
    const firstImport = content.match(/^import .+;$/m);
    if (firstImport) {
      content = content.replace(
        firstImport[0],
        `${firstImport[0]}\nimport { useTranslation } from 'react-i18next';`
      );
    }
  }

  // Ensure const { t } = useTranslation() exists
  if (content.includes('useTranslation') && !content.includes('const { t }')) {
    // Add after function declaration
    const fnMatch = content.match(/((?:export\s+(?:default\s+)?)?(?:function|const)\s+\w+[^{]*\{)/);
    if (fnMatch) {
      content = content.replace(fnMatch[0], `${fnMatch[0]}\n  const { t } = useTranslation();`);
    }
  }

  let count = 0;
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.replaceAll(search, replace);
      count++;
    }
  }

  if (count > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${filePath} — ${count} replacements`);
  } else {
    console.log(`ℹ️  ${filePath} — no matches`);
  }
}

// ─── SquareIntegration.tsx ─────────────────────────────────────
processFile('src/pages/integrations/SquareIntegration.tsx', [
  [`toast.success('Square conectado correctamente'`, `toast.success(t('square.toastConnected')`],
  [`toast.success('Datos importados correctamente')`, `toast.success(t('square.toastImported'))`],
  [`toast.error('Error en la sincronización inicial'`, `toast.error(t('square.toastSyncInitialError')`],
  [`toast.info('Datos disponibles. Puedes sincronizar manualmente si necesitas actualizar.')`, `toast.info(t('square.toastDataAvailable'))`],
  [`toast.error('Error conectando Square'`, `toast.error(t('square.toastConnectError')`],
  [`toast.error('No se encontró la organización. Recarga la página.')`, `toast.error(t('square.toastOrgNotFound'))`],
  [`toast.error('Error iniciando conexión'`, `toast.error(t('square.toastStartError')`],
  [`toast.info('Sincronización en curso'`, `toast.info(t('square.toastSyncing')`],
  [`toast.success('Sincronización completada'`, `toast.success(t('square.toastSyncComplete')`],
  [`toast.error('Error sincronizando'`, `toast.error(t('square.toastSyncFailed')`],
  [`toast.info('Square desconectado. Mostrando datos de demostración.')`, `toast.info(t('square.toastDisconnected'))`],
  [`toast.error('Error al desconectar'`, `toast.error(t('square.toastDisconnectError')`],
]);

// ─── LightspeedIntegration.tsx ─────────────────────────────────
processFile('src/pages/integrations/LightspeedIntegration.tsx', [
  [`toast.success('¡Lightspeed conectado correctamente!')`, `toast.success(t('lightspeed.toastConnected'))`],
  [`toast.error('Error al iniciar conexión: ' + e.message)`, `toast.error(t('lightspeed.toastConnectError') + ': ' + e.message)`],
  [`toast.success('Sincronización completada')`, `toast.success(t('lightspeed.toastSyncComplete'))`],
  [`toast.error('Error en sincronización: ' + e.message)`, `toast.error(t('lightspeed.toastSyncError') + ': ' + e.message)`],
  [`toast.success('Lightspeed desconectado')`, `toast.success(t('lightspeed.toastDisconnected'))`],
]);

// ─── Availability.tsx ──────────────────────────────────────────
processFile('src/pages/Availability.tsx', [
  [`toast.success('Availability saved successfully')`, `toast.success(t('availability.toastSaved'))`],
  [`toast.error('Failed to save availability')`, `toast.error(t('availability.toastSaveError'))`],
  [`toast.success('Time off request submitted')`, `toast.success(t('availability.toastTimeOffSubmitted'))`],
  [`toast.success('Request approved')`, `toast.success(t('availability.toastApproved'))`],
  [`toast.info('Request rejected')`, `toast.info(t('availability.toastRejected'))`],
  [`toast.success('Request cancelled')`, `toast.success(t('availability.toastCancelled'))`],
]);

// ─── ScheduleSettingsSheet.tsx ─────────────────────────────────
processFile('src/components/scheduling/ScheduleSettingsSheet.tsx', [
  [`toast.error('Error guardando: ' + error.message)`, `toast.error(t('scheduleSettings.toastSaveError') + ': ' + error.message)`],
  [`toast.success('Schedule settings guardados')`, `toast.success(t('scheduleSettings.toastSaved'))`],
]);

// ─── ClockInPanel.tsx ──────────────────────────────────────────
processFile('src/components/staff/ClockInPanel.tsx', [
  [`toast.error('No se encontró tu registro de empleado')`, `toast.error(t('clockIn.toastNotFound'))`],
  [`toast.success('Entrada registrada correctamente')`, `toast.success(t('clockIn.toastClockInOk'))`],
  [`toast.error('Error al registrar entrada')`, `toast.error(t('clockIn.toastClockInError'))`],
  [`toast.success('Salida registrada correctamente')`, `toast.success(t('clockIn.toastClockOutOk'))`],
  [`toast.error('Error al registrar salida')`, `toast.error(t('clockIn.toastClockOutError'))`],
]);

// ─── EventCalendarManager.tsx ──────────────────────────────────
processFile('src/components/settings/EventCalendarManager.tsx', [
  [`toast.success('Evento añadido')`, `toast.success(t('eventCalendar.toastAdded'))`],
  [`toast.error('Error'`, `toast.error(t('eventCalendar.toastError')`],
  [`toast.success('Evento eliminado')`, `toast.success(t('eventCalendar.toastDeleted'))`],
]);

// ─── LocationWizard.tsx ────────────────────────────────────────
processFile('src/components/settings/LocationWizard.tsx', [
  [`toast.error('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.')`, `toast.error(t('locationWizard.toastSessionExpired'))`],
  [`toast.error('Error de permisos. Recarga la página e intenta de nuevo.')`, `toast.error(t('locationWizard.toastPermissionsError'))`],
  [`toast.error('No tienes permisos para crear locales. Verifica que tienes rol de propietario.')`, `toast.error(t('locationWizard.toastNoPermissions'))`],
  [`toast.success('Local creado correctamente')`, `toast.success(t('locationWizard.toastCreated'))`],
  [`toast.error('Error creando el local'`, `toast.error(t('locationWizard.toastCreateError')`],
]);

// ─── TrainingTracker.tsx ───────────────────────────────────────
processFile('src/components/workforce/TrainingTracker.tsx', [
  [`toast.success('Certificado añadido')`, `toast.success(t('trainingTracker.toastCertAdded'))`],
  [`toast.error('Error'`, `toast.error(t('trainingTracker.toastError')`],
]);

// ─── EmployeeReviews.tsx ───────────────────────────────────────
processFile('src/components/workforce/EmployeeReviews.tsx', [
  [`toast.success('Evaluación guardada')`, `toast.success(t('employeeReviews.toastSaved'))`],
  [`toast.error('Error al guardar'`, `toast.error(t('employeeReviews.toastSaveError')`],
]);

// ─── EmploymentContracts.tsx ───────────────────────────────────
processFile('src/components/workforce/EmploymentContracts.tsx', [
  [`toast.error('Selecciona un empleado')`, `toast.error(t('contracts.toastSelectEmployee'))`],
  [`toast.error('Error al actualizar contrato')`, `toast.error(t('contracts.toastUpdateError'))`],
  [`toast.success('Contrato actualizado')`, `toast.success(t('contracts.toastUpdated'))`],
  [`toast.error('Error al crear contrato')`, `toast.error(t('contracts.toastCreateError'))`],
  [`toast.success('Contrato creado')`, `toast.success(t('contracts.toastCreated'))`],
  [`toast.error('Error al cambiar estado')`, `toast.error(t('contracts.toastStatusError'))`],
]);

// ─── AdminTools.tsx ────────────────────────────────────────────
processFile('src/pages/AdminTools.tsx', [
  [`toast.success('18 meses de datos generados exitosamente!')`, `toast.success(t('adminTools.toast18Months'))`],
  [`toast.success('30 días de datos generados!')`, `toast.success(t('adminTools.toast30Days'))`],
]);

// ─── PaymentHistoryManager.tsx ─────────────────────────────────
processFile('src/components/settings/PaymentHistoryManager.tsx', [
  [`toast.error('Error al cargar los pagos')`, `toast.error(t('paymentHistory.toastLoadError'))`],
]);

console.log('\n🎉 Batch 2 complete!');
