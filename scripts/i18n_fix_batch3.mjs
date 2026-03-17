/**
 * Batch 3: Remaining toasts from POS, inventory, reviews, onboarding,
 * payroll, LocationManager, scheduling dialogs, etc.
 */
import fs from 'fs';
import path from 'path';

const esPath = path.join('src', 'i18n', 'locales', 'es.json');
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));

// ─── Add missing locale keys ───────────────────────────────────
const batch3 = {
  pos: {
    ...es.pos,
    toastCajaAbierta: "Caja abierta",
    toastCajaCerrada: "Caja cerrada",
    toastError: "Error"
  },
  paymentHistory: {
    ...es.paymentHistory,
    toastCopied: "ID copiado al portapapeles",
    toastCopyError: "Error al copiar"
  },
  locationManager: {
    toastNameRequired: "El nombre del local es obligatorio",
    toastGroupNotFound: "No se encontró el grupo",
    toastSessionExpired: "Tu sesión ha expirado. Por favor, inicia sesión de nuevo.",
    toastPermissionsError: "Error de permisos. Recarga la página e intenta de nuevo.",
    toastNoPermissions: "No tienes permisos para crear locales. Verifica que tienes rol de propietario.",
    toastSelectSource: "Selecciona un local de origen",
    toastUpdated: "Local actualizado",
    toastCannotDelete: "No puedes eliminar el único local del grupo"
  },
  teamManagers: {
    toastCompleteFields: "Completa nombre, apellido y ubicación",
    toastEmailCopied: "Email copiado"
  },
  reviewCard: {
    ...es.reviewCard,
    toastRefineSuccess: "Respuesta refinada correctamente",
    toastRefineError: "Error al refinar respuesta",
    toastEnterReply: "Por favor introduce una respuesta",
    toastReplySubmitted: "Respuesta enviada correctamente",
    toastReplyDraft: "No se pudo publicar — guardada como borrador"
  },
  onboardingWizard: {
    toastComplete: "¡Configuración completada!",
    toastError: "Error en la configuración"
  },
  menuEngineering: {
    ...es.menuEngineering,
    toastActionSaved: "Plan de acción guardado",
    toastSaveError: "Error al guardar"
  },
  inventoryHeader: {
    toastRegenerated: "Datos demo regenerados"
  },
  smartCounting: {
    toastInvalidQty: "Introduce una cantidad válida",
    toastNoCountsToSave: "No hay contajes para guardar",
    toastSaveError: "Error al guardar"
  },
  labourEmpty: {
    toastSeedError: "Error al generar datos demo",
    toastGenError: "Error generando datos demo"
  },
  autoPurchase: {
    toastNoAlerts: "¡No hay alertas de stock bajo!",
    toastScanError: "Error al escanear inventario",
    toastNoSuppliers: "No hay proveedores configurados",
    toastGenOrderError: "Error al generar orden de compra"
  },
  addItem: {
    toastRequired: "Nombre y Precio son obligatorios",
    toastAdded: "Item añadido correctamente",
    toastAddError: "Error añadiendo item"
  }
};

for (const [section, keys] of Object.entries(batch3)) {
  if (!es[section]) es[section] = {};
  Object.assign(es[section], keys);
}
fs.writeFileSync(esPath, JSON.stringify(es, null, 2) + '\n', 'utf8');
console.log('✅ es.json updated with batch 3 keys');

// ─── Helper ────────────────────────────────────────────────────

function processFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) { console.log(`⚠️  Skipped: ${filePath}`); return; }
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('useTranslation')) {
    const m = content.match(/^import .+;$/m);
    if (m) content = content.replace(m[0], `${m[0]}\nimport { useTranslation } from 'react-i18next';`);
  }
  if (content.includes('useTranslation') && !content.includes('const { t }')) {
    const fn = content.match(/((?:export\s+(?:default\s+)?)?(?:function|const)\s+\w+[^{]*\{)/);
    if (fn) content = content.replace(fn[0], `${fn[0]}\n  const { t } = useTranslation();`);
  }

  let count = 0;
  for (const [s, r] of replacements) {
    if (content.includes(s)) { content = content.replaceAll(s, r); count++; }
  }
  if (count > 0) { fs.writeFileSync(filePath, content, 'utf8'); console.log(`✅ ${filePath} — ${count}`); }
  else { console.log(`ℹ️  ${filePath} — 0`); }
}

// ─── POSCashSession.tsx ────────────────────────────────────────
processFile('src/components/pos/POSCashSession.tsx', [
  [`toast.success('Caja abierta')`, `toast.success(t('pos.toastCajaAbierta'))`],
  [`toast.success('Caja cerrada')`, `toast.success(t('pos.toastCajaCerrada'))`],
  [`toast.error('Error: '`, `toast.error(t('pos.toastError') + ': '`],
]);

// ─── PaymentHistoryManager.tsx (remaining) ─────────────────────
processFile('src/components/settings/PaymentHistoryManager.tsx', [
  [`toast.success('ID copiado al portapapeles')`, `toast.success(t('paymentHistory.toastCopied'))`],
  [`toast.error('Error al copiar')`, `toast.error(t('paymentHistory.toastCopyError'))`],
]);

// ─── LocationManager.tsx ───────────────────────────────────────
processFile('src/components/settings/LocationManager.tsx', [
  [`toast.error('El nombre del local es obligatorio')`, `toast.error(t('locationManager.toastNameRequired'))`],
  [`toast.error('No se encontró el grupo')`, `toast.error(t('locationManager.toastGroupNotFound'))`],
  [`toast.error('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.')`, `toast.error(t('locationManager.toastSessionExpired'))`],
  [`toast.error('Error de permisos. Recarga la página e intenta de nuevo.')`, `toast.error(t('locationManager.toastPermissionsError'))`],
  [`toast.error('No tienes permisos para crear locales. Verifica que tienes rol de propietario.')`, `toast.error(t('locationManager.toastNoPermissions'))`],
  [`toast.error('Selecciona un local de origen')`, `toast.error(t('locationManager.toastSelectSource'))`],
  [`toast.success('Local actualizado')`, `toast.success(t('locationManager.toastUpdated'))`],
  [`toast.error('No puedes eliminar el único local del grupo')`, `toast.error(t('locationManager.toastCannotDelete'))`],
]);

// ─── TeamManagersTab.tsx ───────────────────────────────────────
processFile('src/components/settings/TeamManagersTab.tsx', [
  [`toast.error('Completa nombre, apellido y ubicación')`, `toast.error(t('teamManagers.toastCompleteFields'))`],
  [`toast.success('Email copiado')`, `toast.success(t('teamManagers.toastEmailCopied'))`],
]);

// ─── ReviewCard.tsx ────────────────────────────────────────────
processFile('src/components/reviews/ReviewCard.tsx', [
  [`toast.success('Reply refined successfully')`, `toast.success(t('reviewCard.toastRefineSuccess'))`],
  [`toast.error('Failed to refine reply')`, `toast.error(t('reviewCard.toastRefineError'))`],
  [`toast.error('Please enter a reply')`, `toast.error(t('reviewCard.toastEnterReply'))`],
  [`toast.success('Reply submitted successfully')`, `toast.success(t('reviewCard.toastReplySubmitted'))`],
  [`toast.error('Couldn\\'t publish — saved as draft')`, `toast.error(t('reviewCard.toastReplyDraft'))`],
  [`toast.error("Couldn't publish — saved as draft")`, `toast.error(t('reviewCard.toastReplyDraft'))`],
]);

// ─── OnboardingWizard.tsx ──────────────────────────────────────
processFile('src/components/onboarding/OnboardingWizard.tsx', [
  [`toast.success('¡Configuración completada!'`, `toast.success(t('onboardingWizard.toastComplete')`],
  [`toast.error('Error en la configuración'`, `toast.error(t('onboardingWizard.toastError')`],
]);

// ─── MenuEngineeringActions.tsx ────────────────────────────────
processFile('src/components/menu-engineering/MenuEngineeringActions.tsx', [
  [`toast.success('Action plan saved')`, `toast.success(t('menuEngineering.toastActionSaved'))`],
  [`toast.error('Error saving')`, `toast.error(t('menuEngineering.toastSaveError'))`],
]);

// ─── InventoryHeader.tsx ───────────────────────────────────────
processFile('src/components/inventory/InventoryHeader.tsx', [
  [`toast.success('Demo data regenerated'`, `toast.success(t('inventoryHeader.toastRegenerated')`],
]);

// ─── SmartCountingFlow.tsx ─────────────────────────────────────
processFile('src/components/inventory/SmartCountingFlow.tsx', [
  [`toast.error('Introduce una cantidad válida')`, `toast.error(t('smartCounting.toastInvalidQty'))`],
  [`toast.error('No hay contajes para guardar')`, `toast.error(t('smartCounting.toastNoCountsToSave'))`],
  [`toast.error('Error al guardar'`, `toast.error(t('smartCounting.toastSaveError')`],
]);

// ─── LabourEmptyState.tsx ──────────────────────────────────────
processFile('src/components/labour/LabourEmptyState.tsx', [
  [`toast.error('Failed to seed demo data')`, `toast.error(t('labourEmpty.toastSeedError'))`],
  [`toast.error('Error generating demo data')`, `toast.error(t('labourEmpty.toastGenError'))`],
]);

// ─── AutoPurchaseOrder.tsx ─────────────────────────────────────
processFile('src/components/inventory/AutoPurchaseOrder.tsx', [
  [`toast.success('¡No hay alertas de stock bajo!')`, `toast.success(t('autoPurchase.toastNoAlerts'))`],
  [`toast.error('Error al escanear inventario')`, `toast.error(t('autoPurchase.toastScanError'))`],
  [`toast.error('No hay proveedores configurados')`, `toast.error(t('autoPurchase.toastNoSuppliers'))`],
  [`toast.error('Error al generar orden de compra')`, `toast.error(t('autoPurchase.toastGenOrderError'))`],
]);

// ─── AddItemDialog.tsx ─────────────────────────────────────────
processFile('src/components/inventory/AddItemDialog.tsx', [
  [`toast.error('Name and Price are required')`, `toast.error(t('addItem.toastRequired'))`],
  [`toast.success('Item added successfully')`, `toast.success(t('addItem.toastAdded'))`],
  [`toast.error('Error adding item: '`, `toast.error(t('addItem.toastAddError') + ': '`],
]);

console.log('\n🎉 Batch 3 complete!');
