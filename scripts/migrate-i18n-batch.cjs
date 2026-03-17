#!/usr/bin/env node
/**
 * migrate-i18n-batch.cjs — Batch migrate hardcoded strings to t() calls
 * 
 * This script reads .tsx files and replaces known hardcoded strings with
 * i18n t() calls. It also adds the corresponding keys to es.json.
 * 
 * After running: execute `npm run i18n:sync` to propagate to other locales.
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const SRC_DIR = path.join(__dirname, '..', 'src');

// Load es.json
const esPath = path.join(LOCALES_DIR, 'es.json');
let esData = JSON.parse(fs.readFileSync(esPath, 'utf8'));

// Track stats
let filesModified = 0;
let keysAdded = 0;
let stringsReplaced = 0;

/**
 * Set a nested key in the locale object
 */
function setNestedKey(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  const lastPart = parts[parts.length - 1];
  if (!(lastPart in current)) {
    current[lastPart] = value;
    keysAdded++;
  }
}

/**
 * Check if a key already exists
 */
function hasKey(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object' || !(part in current)) {
      return false;
    }
    current = current[part];
  }
  return true;
}

/**
 * Replace a hardcoded string in a file.
 * Each replacement is: { search: string, replace: string, i18nKey: string, i18nValue: string }
 */
function processFile(relPath, replacements) {
  const fullPath = path.join(SRC_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ⏭️  Skipped ${relPath} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  let count = 0;
  
  for (const r of replacements) {
    // Add the i18n key
    if (r.i18nKey && r.i18nValue) {
      setNestedKey(esData, r.i18nKey, r.i18nValue);
    }
    
    // Replace in file  
    if (content.includes(r.search)) {
      content = content.replace(r.search, r.replace);
      modified = true;
      count++;
      stringsReplaced++;
    }
  }
  
  // Ensure useTranslation import exists
  if (modified) {
    if (!content.includes('useTranslation')) {
      // Add import after the last import line
      const lines = content.split('\n');
      let lastImportIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trimStart().startsWith('import ')) {
          lastImportIndex = i;
        }
      }
      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex + 1, 0, "import { useTranslation } from 'react-i18next';");
        content = lines.join('\n');
      }
    }
    
    // Ensure const { t } = useTranslation(); exists inside the component
    // (only if there's a function component)
    if (!content.includes('const { t }') && !content.includes('const {t}')) {
      // Find the first line after a function component declaration with '() =>' or 'function'
      const funcMatch = content.match(/((?:const|function)\s+\w+[^{]*\{)\s*\n/);
      if (funcMatch) {
        const idx = content.indexOf(funcMatch[0]);
        if (idx >= 0) {
          content = content.slice(0, idx + funcMatch[0].length) + 
                    '  const { t } = useTranslation();\n' + 
                    content.slice(idx + funcMatch[0].length);
        }
      }
    }
    
    fs.writeFileSync(fullPath, content, 'utf8');
    filesModified++;
    console.log(`  ✅ ${relPath} — ${count} replacements`);
  }
}

// ────────────────────────────────────────────────────────────────────
// REPLACEMENTS BY FILE
// ────────────────────────────────────────────────────────────────────

console.log('\n🔄 Migrating hardcoded strings to t() calls...\n');

// ── Dashboard.tsx ──
processFile('pages/Dashboard.tsx', [
  {
    search: '>Resumen de operaciones de hoy<',
    replace: '>{t("dashboard.todayOperationsSummary")}<',
    i18nKey: 'dashboard.todayOperationsSummary',
    i18nValue: 'Resumen de operaciones de hoy',
  },
]);

// ── KioskMode.tsx ──
processFile('pages/KioskMode.tsx', [
  {
    search: '>Toca para desbloquear<',
    replace: '>{t("kiosk.tapToUnlock")}<',
    i18nKey: 'kiosk.tapToUnlock',
    i18nValue: 'Toca para desbloquear',
  },
]);

// ── OnboardingChecklist.tsx ──
processFile('pages/OnboardingChecklist.tsx', [
  {
    search: '>Configuración de Josephine<',
    replace: '>{t("onboarding.configTitle")}<',
    i18nKey: 'onboarding.configTitle',
    i18nValue: 'Configuración de Josephine',
  },
  {
    search: '>Progreso de configuración<',
    replace: '>{t("onboarding.configProgress")}<',
    i18nKey: 'onboarding.configProgress',
    i18nValue: 'Progreso de configuración',
  },
  {
    search: '>Verificando configuración...</',
    replace: '>{t("onboarding.verifyingConfig")}</',
    i18nKey: 'onboarding.verifyingConfig',
    i18nValue: 'Verificando configuración...',
  },
  {
    search: '>Integraciones externas pendientes<',
    replace: '>{t("onboarding.pendingIntegrations")}<',
    i18nKey: 'onboarding.pendingIntegrations',
    i18nValue: 'Integraciones externas pendientes',
  },
]);

// ── OnboardingWizardV2.tsx ──
processFile('pages/OnboardingWizardV2.tsx', [
  {
    search: '>Configurando tu cuenta...</',
    replace: '>{t("onboarding.configuringAccount")}</',
    i18nKey: 'onboarding.configuringAccount',
    i18nValue: 'Configurando tu cuenta...',
  },
  {
    search: '>Conecta tu sistema POS<',
    replace: '>{t("onboarding.connectPos")}<',
    i18nKey: 'onboarding.connectPos',
    i18nValue: 'Conecta tu sistema POS',
  },
  {
    search: '>Conexión directa vía OAuth<',
    replace: '>{t("onboarding.directOauth")}<',
    i18nKey: 'onboarding.directOauth',
    i18nValue: 'Conexión directa vía OAuth',
  },
  {
    search: '>Importa datos de cualquier POS<',
    replace: '>{t("onboarding.importAnyPos")}<',
    i18nKey: 'onboarding.importAnyPos',
    i18nValue: 'Importa datos de cualquier POS',
  },
]);

// ── BookingWidget.tsx ──
processFile('pages/BookingWidget.tsx', [
  {
    search: '>Peticiones especiales<',
    replace: '>{t("booking.specialRequests")}<',
    i18nKey: 'booking.specialRequests',
    i18nValue: 'Peticiones especiales',
  },
]);

// ── Budgets.tsx ──
processFile('pages/Budgets.tsx', [
  {
    search: '>Compare actual performance vs budget<',
    replace: '>{t("budgets.comparePerformance")}<',
    i18nKey: 'budgets.comparePerformance',
    i18nValue: 'Compara rendimiento real vs presupuesto',
  },
]);

// ── CashManagement.tsx ──
processFile('pages/CashManagement.tsx', [
  {
    search: '>Monitor sales, payments, refunds and leakage<',
    replace: '>{t("cash.monitorDescription")}<',
    i18nKey: 'cash.monitorDescription',
    i18nValue: 'Monitoriza ventas, pagos, reembolsos y fugas',
  },
]);

// ── MenuEngineering.tsx ──
processFile('pages/MenuEngineering.tsx', [
  {
    search: '>No data for this period<',
    replace: '>{t("menu.noDataForPeriod")}<',
    i18nKey: 'menu.noDataForPeriod',
    i18nValue: 'Sin datos para este periodo',
  },
  {
    search: '>Select a category<',
    replace: '>{t("menu.selectCategory")}<',
    i18nKey: 'menu.selectCategory',
    i18nValue: 'Selecciona una categoría',
  },
  {
    search: '>Promote middle band products<',
    replace: '>{t("menu.promoteMiddleBand")}<',
    i18nKey: 'menu.promoteMiddleBand',
    i18nValue: 'Promueve productos de banda media',
  },
  {
    search: '>High if popularity_pct ≥ threshold<',
    replace: '>{t("menu.highIfPopularity")}<',
    i18nKey: 'menu.highIfPopularity',
    i18nValue: 'Alto si popularity_pct ≥ umbral',
  },
  {
    search: '>High if unit GP ≥ avg GP<',
    replace: '>{t("menu.highIfGP")}<',
    i18nKey: 'menu.highIfGP',
    i18nValue: 'Alto si GP unitario ≥ GP medio',
  },
  {
    search: '>Prices normalized ex-VAT (10%)<',
    replace: '>{t("menu.pricesNormalized")}<',
    i18nKey: 'menu.pricesNormalized',
    i18nValue: 'Precios normalizados sin IVA (10%)',
  },
  {
    search: '>Decision support tool, not absolute truth<',
    replace: '>{t("menu.decisionSupport")}<',
    i18nKey: 'menu.decisionSupport',
    i18nValue: 'Herramienta de soporte a la decisión, no verdad absoluta',
  },
]);

// ── StockAuditPage.tsx ──
processFile('pages/operations/StockAuditPage.tsx', [
  {
    search: '>Stock teórico vs real — rojo = varianza negativa >5%<',
    replace: '>{t("stock.theoreticalVsReal")}<',
    i18nKey: 'stock.theoreticalVsReal',
    i18nValue: 'Stock teórico vs real — rojo = varianza negativa >5%',
  },
]);

// ── ClockInPanel.tsx ──
processFile('components/staff/ClockInPanel.tsx', [
  {
    search: '>Ubicación detectada<',
    replace: '>{t("staff.locationDetected")}<',
    i18nKey: 'staff.locationDetected',
    i18nValue: 'Ubicación detectada',
  },
  {
    search: '>Turno activo desde<',
    replace: '>{t("staff.activeShiftSince")}<',
    i18nKey: 'staff.activeShiftSince',
    i18nValue: 'Turno activo desde',
  },
  {
    search: '>Esta semana:<',
    replace: '>{t("staff.thisWeek")}:<',
    i18nKey: 'staff.thisWeek',
    i18nValue: 'Esta semana',
  },
]);

// ── TeamLayout.tsx ──
processFile('components/team/TeamLayout.tsx', [
  {
    search: '>Portal de Equipo<',
    replace: '>{t("team.teamPortal")}<',
    i18nKey: 'team.teamPortal',
    i18nValue: 'Portal de Equipo',
  },
  {
    search: '>Panel de gestión<',
    replace: '>{t("team.managementPanel")}<',
    i18nKey: 'team.managementPanel',
    i18nValue: 'Panel de gestión',
  },
]);

// ── TrainingTracker.tsx ──
processFile('components/workforce/TrainingTracker.tsx', [
  {
    search: '>Formación y Certificados<',
    replace: '>{t("workforce.trainingAndCerts")}<',
    i18nKey: 'workforce.trainingAndCerts',
    i18nValue: 'Formación y Certificados',
  },
  {
    search: '>Fecha emisión<',
    replace: '>{t("workforce.issueDate")}<',
    i18nKey: 'workforce.issueDate',
    i18nValue: 'Fecha emisión',
  },
  {
    search: '>Fecha caducidad<',
    replace: '>{t("workforce.expiryDate")}<',
    i18nKey: 'workforce.expiryDate',
    i18nValue: 'Fecha caducidad',
  },
]);

// ── EmploymentContracts.tsx ──
processFile('components/workforce/EmploymentContracts.tsx', [
  {
    search: '>Contratos activos<',
    replace: '>{t("workforce.activeContracts")}<',
    i18nKey: 'workforce.activeContracts',
    i18nValue: 'Contratos activos',
  },
  {
    search: '>Salario medio<',
    replace: '>{t("workforce.avgSalary")}<',
    i18nKey: 'workforce.avgSalary',
    i18nValue: 'Salario medio',
  },
  {
    search: '>Jornada media<',
    replace: '>{t("workforce.avgWorkday")}<',
    i18nKey: 'workforce.avgWorkday',
    i18nValue: 'Jornada media',
  },
  {
    search: '>Tipo más común<',
    replace: '>{t("workforce.mostCommonType")}<',
    i18nKey: 'workforce.mostCommonType',
    i18nValue: 'Tipo más común',
  },
  {
    search: '>Crea el primer contrato para tu equipo<',
    replace: '>{t("workforce.createFirstContract")}<',
    i18nKey: 'workforce.createFirstContract',
    i18nValue: 'Crea el primer contrato para tu equipo',
  },
  {
    search: '>Tipo de contrato<',
    replace: '>{t("workforce.contractType")}<',
    i18nKey: 'workforce.contractType',
    i18nValue: 'Tipo de contrato',
  },
  {
    search: '>Salario bruto/mes (€)<',
    replace: '>{t("workforce.grossSalaryMonth")}<',
    i18nKey: 'workforce.grossSalaryMonth',
    i18nValue: 'Salario bruto/mes (€)',
  },
]);

// ── EmployeeReviews.tsx ──
processFile('components/workforce/EmployeeReviews.tsx', [
  {
    search: '>Rendimiento del Equipo<',
    replace: '>{t("workforce.teamPerformance")}<',
    i18nKey: 'workforce.teamPerformance',
    i18nValue: 'Rendimiento del Equipo',
  },
]);

// ── UsersRolesManager.tsx ──
processFile('components/settings/UsersRolesManager.tsx', [
  {
    search: '>No tienes permisos para gestionar usuarios<',
    replace: '>{t("settings.noUserPermission")}<',
    i18nKey: 'settings.noUserPermission',
    i18nValue: 'No tienes permisos para gestionar usuarios',
  },
]);

// ── TeamManagersTab.tsx ──
processFile('components/settings/TeamManagersTab.tsx', [
  {
    search: '>Selecciona una ubicación<',
    replace: '>{t("settings.selectLocation")}<',
    i18nKey: 'settings.selectLocation',
    i18nValue: 'Selecciona una ubicación',
  },
  {
    search: '>Tiene acceso<',
    replace: '>{t("settings.hasAccess")}<',
    i18nKey: 'settings.hasAccess',
    i18nValue: 'Tiene acceso',
  },
]);

// ── TeamManager.tsx ──
processFile('components/settings/TeamManager.tsx', [
  {
    search: '>No tienes permisos para gestionar el equipo<',
    replace: '>{t("settings.noTeamPermission")}<',
    i18nKey: 'settings.noTeamPermission',
    i18nValue: 'No tienes permisos para gestionar el equipo',
  },
]);

// ── SupplierIntegrationManager.tsx ──
processFile('components/settings/SupplierIntegrationManager.tsx', [
  {
    search: '>Añade proveedores desde el asistente de locales<',
    replace: '>{t("settings.addSuppliersFromWizard")}<',
    i18nKey: 'settings.addSuppliersFromWizard',
    i18nValue: 'Añade proveedores desde el asistente de locales',
  },
  {
    search: '>Método de envío<',
    replace: '>{t("settings.shippingMethod")}<',
    i18nKey: 'settings.shippingMethod',
    i18nValue: 'Método de envío',
  },
  {
    search: '>Email de pedidos<',
    replace: '>{t("settings.orderEmail")}<',
    i18nKey: 'settings.orderEmail',
    i18nValue: 'Email de pedidos',
  },
  {
    search: '>Web de pedidos<',
    replace: '>{t("settings.orderWebsite")}<',
    i18nKey: 'settings.orderWebsite',
    i18nValue: 'Web de pedidos',
  },
  {
    search: '>Email de respaldo<',
    replace: '>{t("settings.fallbackEmail")}<',
    i18nKey: 'settings.fallbackEmail',
    i18nValue: 'Email de respaldo',
  },
]);

// ── PaymentMethodsTab.tsx ──
processFile('components/settings/PaymentMethodsTab.tsx', [
  {
    search: '>Manage payment methods for procurement autopay<',
    replace: '>{t("settings.managePaymentMethods")}<',
    i18nKey: 'settings.managePaymentMethods',
    i18nValue: 'Gestiona métodos de pago para autopago de compras',
  },
  {
    search: '>Your card details are securely encrypted<',
    replace: '>{t("settings.cardEncrypted")}<',
    i18nKey: 'settings.cardEncrypted',
    i18nValue: 'Los datos de tu tarjeta están cifrados de forma segura',
  },
  {
    search: '>No payment methods<',
    replace: '>{t("settings.noPaymentMethods")}<',
    i18nKey: 'settings.noPaymentMethods',
    i18nValue: 'Sin métodos de pago',
  },
  {
    search: '>Add a payment method to enable autopay for procurement orders<',
    replace: '>{t("settings.addPaymentMethodDesc")}<',
    i18nKey: 'settings.addPaymentMethodDesc',
    i18nValue: 'Añade un método de pago para habilitar el autopago de pedidos',
  },
  {
    search: '>Delete payment method?<',
    replace: '>{t("settings.deletePaymentMethod")}<',
    i18nKey: 'settings.deletePaymentMethod',
    i18nValue: '¿Eliminar método de pago?',
  },
]);

// ── PaymentHistoryManager.tsx ──
processFile('components/settings/PaymentHistoryManager.tsx', [
  {
    search: '>Histórico de Pagos<',
    replace: '>{t("settings.paymentHistory")}<',
    i18nKey: 'settings.paymentHistory',
    i18nValue: 'Histórico de Pagos',
  },
  {
    search: '>Pagos con Stripe<',
    replace: '>{t("settings.stripePayments")}<',
    i18nKey: 'settings.stripePayments',
    i18nValue: 'Pagos con Stripe',
  },
  {
    search: '>Todos los locales<',
    replace: '>{t("settings.allLocations")}<',
    i18nKey: 'settings.allLocations',
    i18nValue: 'Todos los locales',
  },
]);

// ── ObjectivesTab.tsx ──
processFile('components/settings/ObjectivesTab.tsx', [
  {
    search: '>Define los KPIs objetivo para cada local. Estos valores se usan en el scheduling y forecast.<',
    replace: '>{t("settings.kpiObjectivesDesc")}<',
    i18nKey: 'settings.kpiObjectivesDesc',
    i18nValue: 'Define los KPIs objetivo para cada local. Estos valores se usan en el scheduling y forecast.',
  },
  {
    search: '>Cómo los objetivos afectan la generación automática de turnos<',
    replace: '>{t("settings.objectivesImpact")}<',
    i18nKey: 'settings.objectivesImpact',
    i18nValue: 'Cómo los objetivos afectan la generación automática de turnos',
  },
  {
    search: '>Budget semanal (est.)<',
    replace: '>{t("settings.weeklyBudgetEst")}<',
    i18nKey: 'settings.weeklyBudgetEst',
    i18nValue: 'Budget semanal (est.)',
  },
  {
    search: '>Max horas/semana<',
    replace: '>{t("settings.maxHoursWeek")}<',
    i18nKey: 'settings.maxHoursWeek',
    i18nValue: 'Max horas/semana',
  },
]);

// ── LoyaltyManager.tsx ──
processFile('components/settings/LoyaltyManager.tsx', [
  {
    search: '>Programa de Fidelización<',
    replace: '>{t("settings.loyaltyProgram")}<',
    i18nKey: 'settings.loyaltyProgram',
    i18nValue: 'Programa de Fidelización',
  },
  {
    search: '>Gestiona clientes frecuentes y recompensas<',
    replace: '>{t("settings.loyaltyDesc")}<',
    i18nKey: 'settings.loyaltyDesc',
    i18nValue: 'Gestiona clientes frecuentes y recompensas',
  },
  {
    search: '>Puntos en circulación<',
    replace: '>{t("settings.pointsInCirculation")}<',
    i18nKey: 'settings.pointsInCirculation',
    i18nValue: 'Puntos en circulación',
  },
  {
    search: '>Recompensas activas<',
    replace: '>{t("settings.activeRewards")}<',
    i18nKey: 'settings.activeRewards',
    i18nValue: 'Recompensas activas',
  },
  {
    search: '>Por nivel<',
    replace: '>{t("settings.byLevel")}<',
    i18nKey: 'settings.byLevel',
    i18nValue: 'Por nivel',
  },
  {
    search: '>Catálogo de Recompensas<',
    replace: '>{t("settings.rewardsCatalog")}<',
    i18nKey: 'settings.rewardsCatalog',
    i18nValue: 'Catálogo de Recompensas',
  },
  {
    search: '>Configuración del Programa<',
    replace: '>{t("settings.programConfig")}<',
    i18nKey: 'settings.programConfig',
    i18nValue: 'Configuración del Programa',
  },
  {
    search: '>Puntos por Euro gastado<',
    replace: '>{t("settings.pointsPerEuro")}<',
    i18nKey: 'settings.pointsPerEuro',
    i18nValue: 'Puntos por Euro gastado',
  },
  {
    search: '>Bono de Bienvenida (puntos)<',
    replace: '>{t("settings.welcomeBonus")}<',
    i18nKey: 'settings.welcomeBonus',
    i18nValue: 'Bono de Bienvenida (puntos)',
  },
  {
    search: '>Niveles de Fidelización<',
    replace: '>{t("settings.loyaltyLevels")}<',
    i18nKey: 'settings.loyaltyLevels',
    i18nValue: 'Niveles de Fidelización',
  },
  {
    search: '>Coste en Puntos *<',
    replace: '>{t("settings.costInPoints")}<',
    i18nKey: 'settings.costInPoints',
    i18nValue: 'Coste en Puntos *',
  },
]);

// ── WasteByReasonChart.tsx ──
processFile('components/waste/WasteByReasonChart.tsx', [
  {
    search: '>Waste by Reason Value<',
    replace: '>{t("waste.byReasonValue")}<',
    i18nKey: 'waste.byReasonValue',
    i18nValue: 'Merma por razón (valor)',
  },
]);

// ── AdminTools.tsx (lower priority, internal tool) ──
processFile('pages/AdminTools.tsx', [
  {
    search: '>Herramientas para generar datos demo y gestión del sistema<',
    replace: '>{t("admin.toolsDescription")}<',
    i18nKey: 'admin.toolsDescription',
    i18nValue: 'Herramientas para generar datos demo y gestión del sistema',
  },
  {
    search: '>Actuals completos<',
    replace: '>{t("admin.actualsComplete")}<',
    i18nKey: 'admin.actualsComplete',
    i18nValue: 'Actuals completos',
  },
  {
    search: '>Actuals actuales<',
    replace: '>{t("admin.actualsCurrent")}<',
    i18nKey: 'admin.actualsCurrent',
    i18nValue: 'Actuals actuales',
  },
  {
    search: '>Suficiente para ver funcionalidades<',
    replace: '>{t("admin.sufficientForFeatures")}<',
    i18nKey: 'admin.sufficientForFeatures',
    i18nValue: 'Suficiente para ver funcionalidades',
  },
  {
    search: '>Ventajas sobre v4:<',
    replace: '>{t("admin.advantagesOverV4")}:<',
    i18nKey: 'admin.advantagesOverV4',
    i18nValue: 'Ventajas sobre v4',
  },
  {
    search: '>Qué se genera<',
    replace: '>{t("admin.whatIsGenerated")}<',
    i18nKey: 'admin.whatIsGenerated',
    i18nValue: 'Qué se genera',
  },
  {
    search: '>Queries de Verificación<',
    replace: '>{t("admin.verificationQueries")}<',
    i18nKey: 'admin.verificationQueries',
    i18nValue: 'Queries de Verificación',
  },
  {
    search: '>Ver totales:<',
    replace: '>{t("admin.viewTotals")}:<',
    i18nKey: 'admin.viewTotals',
    i18nValue: 'Ver totales',
  },
  {
    search: '>Ver sales por mes:<',
    replace: '>{t("admin.viewSalesByMonth")}:<',
    i18nKey: 'admin.viewSalesByMonth',
    i18nValue: 'Ver sales por mes',
  },
]);

// ── Save updated es.json ──
fs.writeFileSync(esPath, JSON.stringify(esData, null, 2) + '\n', 'utf8');

console.log(`\n📊 Summary:`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Strings replaced: ${stringsReplaced}`);
console.log(`   New i18n keys added: ${keysAdded}`);
console.log(`\n💡 Run \`npm run i18n:sync\` now to propagate keys to other locales.\n`);
