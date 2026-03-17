/**
 * Batch-4 i18n migration: Handles remaining 177 strings that couldn't be auto-migrated
 * - Template literals with ${} interpolation → t('key', { var })
 * - Constant arrays (suggested questions, country lists, splash messages)
 * - Simple strings the regex missed
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const ES_PATH = path.join(SRC, 'i18n', 'locales', 'es.json');
const es = JSON.parse(fs.readFileSync(ES_PATH, 'utf8'));

let totalReplaced = 0;
let totalKeys = 0;
const newKeys = {};

function addKey(ns, key, val) {
  if (!es[ns]) es[ns] = {};
  if (!es[ns][key]) {
    es[ns][key] = val;
    if (!newKeys[ns]) newKeys[ns] = {};
    newKeys[ns][key] = val;
    totalKeys++;
  }
}

function replaceInFile(relPath, replacements) {
  const fp = path.join(SRC, relPath);
  if (!fs.existsSync(fp)) { console.log('SKIP (not found):', relPath); return; }
  let code = fs.readFileSync(fp, 'utf8');
  let count = 0;
  for (const [from, to] of replacements) {
    if (code.includes(from)) {
      code = code.replace(from, to);
      count++;
    }
  }
  if (count > 0) {
    // Ensure useTranslation import & hook
    if (code.includes("useTranslation") === false) {
      code = "import { useTranslation } from 'react-i18next';\n" + code;
    }
    if (!code.includes("const { t } = useTranslation()") && !code.includes("const {t} = useTranslation()")) {
      // For .tsx files, add after component declaration
      const hookMatch = code.match(/(export (?:default )?function \w+\([^)]*\)\s*(?::\s*\w+\s*)?\{)/);
      if (hookMatch) {
        code = code.replace(hookMatch[1], hookMatch[1] + "\n  const { t } = useTranslation();");
      }
    }
    fs.writeFileSync(fp, code, 'utf8');
    totalReplaced += count;
    console.log(`  ✅ ${relPath}: ${count} replacements`);
  } else {
    console.log(`  ⚠️ ${relPath}: 0 matches`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 1. DataSourceSettings.tsx (14 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('settings', 'dataSourceSaveError', 'No se pudo guardar la configuración de fuente de datos.');
addKey('settings', 'dataSourceUpdated', 'Configuración de fuente de datos actualizada.');
addKey('settings', 'unexpectedSaveError', 'Error inesperado al guardar.');
addKey('settings', 'posRecentSync', 'Datos POS (sincronización reciente)');
addKey('settings', 'demoNoRecentSync', 'Datos Demo (sin sincronización reciente)');
addKey('settings', 'demoManualSelection', 'Demo (selección manual)');
addKey('settings', 'posManualSelection', 'Datos POS (selección manual)');
addKey('settings', 'posAutoLegacy', 'Datos POS (detección automática legacy)');
addKey('settings', 'demoNoPosConnection', 'Datos Demo (sin conexión POS)');
addKey('settings', 'demoDetectionError', 'Datos Demo (error de detección)');
addKey('settings', 'demoNoSession', 'Datos Demo (sin sesión)');
addKey('settings', 'loadingEllipsis', 'Cargando...');
addKey('settings', 'autoModeDescription', 'Usa datos POS si hay una sincronización en las últimas 24h, si no datos demo.');
addKey('settings', 'manualModeDescription', 'Elige manualmente qué fuente de datos usar.');
addKey('settings', 'dataSourceTitle', 'Fuente de Datos');
addKey('settings', 'dataSourceDescription', 'Controla si la aplicación muestra datos reales del POS o datos de demostración.');
addKey('settings', 'lastSync', 'Última sincronización');
addKey('settings', 'noPosRecentSyncWarning', 'No hay sincronización POS reciente. Se mostrarán datos Demo hasta que se complete una sincronización exitosa.');
addKey('settings', 'posDataAvailable', 'Datos POS disponibles.');
addKey('settings', 'saveChanges', 'Guardar cambios');
addKey('common', 'blocked', 'Bloqueado');
addKey('common', 'never', 'Nunca');
addKey('common', 'secondsAgo', 'Hace unos segundos');
addKey('common', 'minutesAgo', 'Hace {{count}} min');
addKey('common', 'hoursAgo', 'Hace {{count}}h');

replaceInFile('components/settings/DataSourceSettings.tsx', [
  ["description: 'No se pudo guardar la configuración de fuente de datos.'", "description: t('settings.dataSourceSaveError')"],
  ["description: 'Configuración de fuente de datos actualizada.'", "description: t('settings.dataSourceUpdated')"],
  ["description: 'Error inesperado al guardar.'", "description: t('settings.unexpectedSaveError')"],
  ["auto_pos_recent: 'Datos POS (sincronización reciente)'", "auto_pos_recent: t('settings.posRecentSync')"],
  ["auto_demo_no_sync: 'Datos Demo (sin sincronización reciente)'", "auto_demo_no_sync: t('settings.demoNoRecentSync')"],
  ["manual_demo: 'Demo (selección manual)'", "manual_demo: t('settings.demoManualSelection')"],
  ["manual_pos_recent: 'Datos POS (selección manual)'", "manual_pos_recent: t('settings.posManualSelection')"],
  ["legacy_pos_connected: 'Datos POS (detección automática legacy)'", "legacy_pos_connected: t('settings.posAutoLegacy')"],
  ["legacy_no_pos: 'Datos Demo (sin conexión POS)'", "legacy_no_pos: t('settings.demoNoPosConnection')"],
  ["legacy_error: 'Datos Demo (error de detección)'", "legacy_error: t('settings.demoDetectionError')"],
  ["no_session: 'Datos Demo (sin sesión)'", "no_session: t('settings.demoNoSession')"],
  ["loading: 'Cargando...'", "loading: t('settings.loadingEllipsis')"],
  ["? 'Usa datos POS si hay una sincronización en las últimas 24h, si no datos demo.'", "? t('settings.autoModeDescription')"],
  [": 'Elige manualmente qué fuente de datos usar.'}", ": t('settings.manualModeDescription')}"],
  ["Fuente de Datos", "{t('settings.dataSourceTitle')}"],
  ["Controla si la aplicación muestra datos reales del POS o datos de demostración.", "{t('settings.dataSourceDescription')}"],
  ["Bloqueado", "{t('common.blocked')}"],
  ["Última sincronización: {formatSyncTime(lastSyncedAt)}", "{t('settings.lastSync')}: {formatSyncTime(lastSyncedAt)}"],
  ["Guardar cambios", "{t('settings.saveChanges')}"],
  ["if (!date) return 'Nunca';", "if (!date) return t('common.never');"],
  ["if (diffMin < 1) return 'Hace unos segundos';", "if (diffMin < 1) return t('common.secondsAgo');"],
  ["if (diffMin < 60) return `Hace ${diffMin} min`;", "if (diffMin < 60) return t('common.minutesAgo', { count: diffMin });"],
  ["if (diffHours < 24) return `Hace ${diffHours}h`;", "if (diffHours < 24) return t('common.hoursAgo', { count: diffHours });"],
  ["No hay sincronización POS reciente. Se mostrarán datos Demo hasta que se\n                    complete una sincronización exitosa.", "{t('settings.noPosRecentSyncWarning')}"],
  ["Última sincronización: {formatSyncTime(lastSyncedAt)}. Datos POS disponibles.", "{t('settings.lastSync')}: {formatSyncTime(lastSyncedAt)}. {t('settings.posDataAvailable')}"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 2. PayrollValidate.tsx (11 template literals)
// ═══════════════════════════════════════════════════════════════════════
addKey('payroll', 'employeesWithoutNif', '{{count}} empleado(s) sin NIF');
addKey('payroll', 'sandboxEstimatedValues', ' (sandbox: se usarán valores estimados)');
addKey('payroll', 'employeesWithoutNss', '{{count}} empleado(s) sin NSS');
addKey('payroll', 'employeesWithoutIban', '{{count}} empleado(s) sin IBAN (no se podrá generar SEPA)');
addKey('payroll', 'employeesWithoutContract', '{{count}} empleado(s) sin contrato activo');
addKey('payroll', 'sandboxConvenioSalaries', ' (sandbox: se usarán salarios del convenio)');
addKey('payroll', 'noVariablesLoaded', 'No hay variables cargadas');
addKey('payroll', 'sandboxContractHours', ' (sandbox: se usarán horas de contrato)');
addKey('payroll', 'entityWithoutCcc', 'Entidad sin CCC');
addKey('payroll', 'sandboxSimulatedSubmissions', ' (sandbox: presentaciones se simularán)');
addKey('payroll', 'pendingTimesheets', '{{count}} timesheet(s) pendientes de aprobar');
addKey('payroll', 'contracts', 'Contratos');
addKey('payroll', 'activeContracts', 'Contratos activos');
addKey('payroll', 'timesheetsApproved', 'Timesheets aprobados');
addKey('payroll', 'variables', 'Variables');
addKey('payroll', 'monthVariablesLoaded', 'Variables del mes cargadas');
addKey('payroll', 'entity', 'Entidad');

replaceInFile('components/payroll/PayrollValidate.tsx', [
  [
    "details: missingNif.length > 0 ? `${missingNif.length} empleado(s) sin NIF${isSandboxMode ? ' (sandbox: se usarán valores estimados)' : ''}` : undefined,",
    "details: missingNif.length > 0 ? t('payroll.employeesWithoutNif', { count: missingNif.length }) + (isSandboxMode ? t('payroll.sandboxEstimatedValues') : '') : undefined,"
  ],
  [
    "details: missingNss.length > 0 ? `${missingNss.length} empleado(s) sin NSS${isSandboxMode ? ' (sandbox: se usarán valores estimados)' : ''}` : undefined,",
    "details: missingNss.length > 0 ? t('payroll.employeesWithoutNss', { count: missingNss.length }) + (isSandboxMode ? t('payroll.sandboxEstimatedValues') : '') : undefined,"
  ],
  [
    "details: missingIban.length > 0 ? `${missingIban.length} empleado(s) sin IBAN (no se podrá generar SEPA)` : undefined,",
    "details: missingIban.length > 0 ? t('payroll.employeesWithoutIban', { count: missingIban.length }) : undefined,"
  ],
  [
    "details: missingContract.length > 0 ? `${missingContract.length} empleado(s) sin contrato activo${isSandboxMode ? ' (sandbox: se usarán salarios del convenio)' : ''}` : undefined,",
    "details: missingContract.length > 0 ? t('payroll.employeesWithoutContract', { count: missingContract.length }) + (isSandboxMode ? t('payroll.sandboxConvenioSalaries') : '') : undefined,"
  ],
  [
    "details: inputsCount === 0 ? `No hay variables cargadas${isSandboxMode ? ' (sandbox: se usarán horas de contrato)' : ''}` : undefined,",
    "details: inputsCount === 0 ? t('payroll.noVariablesLoaded') + (isSandboxMode ? t('payroll.sandboxContractHours') : '') : undefined,"
  ],
  [
    "details: !hasCCC ? `Entidad sin CCC${isSandboxMode ? ' (sandbox: presentaciones se simularán)' : ''}` : undefined,",
    "details: !hasCCC ? t('payroll.entityWithoutCcc') + (isSandboxMode ? t('payroll.sandboxSimulatedSubmissions') : '') : undefined,"
  ],
  [
    "details: pendingTsCount > 0 ? `${pendingTsCount} timesheet(s) pendientes de aprobar` : undefined,",
    "details: pendingTsCount > 0 ? t('payroll.pendingTimesheets', { count: pendingTsCount }) : undefined,"
  ],
  ["category: 'Contratos',", "category: t('payroll.contracts'),"],
  ["description: 'Contratos activos',", "description: t('payroll.activeContracts'),"],
  ["category: 'Timesheets',", "category: 'Timesheets',"],
  ["description: 'Timesheets aprobados',", "description: t('payroll.timesheetsApproved'),"],
  ["category: 'Variables',", "category: t('payroll.variables'),"],
  ["description: 'Variables del mes cargadas',", "description: t('payroll.monthVariablesLoaded'),"],
  ["category: 'Entidad',", "category: t('payroll.entity'),"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 3. SyncSplashScreen.tsx (8 strings — fun loading messages)
// ═══════════════════════════════════════════════════════════════════════
addKey('integrations', 'splashMsg1', 'Calculando cuántas servilletas necesitas mañana...');
addKey('integrations', 'splashMsg2', 'Analizando por qué todos piden postre los viernes...');
addKey('integrations', 'splashMsg3', 'Prediciendo la próxima tendencia gastronómica...');
addKey('integrations', 'splashMsg4', 'Tu sous-chef digital está calentando motores...');
addKey('integrations', 'splashMsg5', 'Optimizando el flujo de la cocina con matemáticas...');
addKey('integrations', 'splashMsg6', 'La IA ya sabe qué van a pedir antes que ellos...');
addKey('integrations', 'splashMsg7', 'Sincronizando datos más rápido que un camarero veterano...');
addKey('integrations', 'splashMsg8', 'Procesando números como si fueran mise en place...');

replaceInFile('components/integrations/SyncSplashScreen.tsx', [
  ["'Calculando cuántas servilletas necesitas mañana...'", "t('integrations.splashMsg1')"],
  ["'Analizando por qué todos piden postre los viernes...'", "t('integrations.splashMsg2')"],
  ["'Prediciendo la próxima tendencia gastronómica...'", "t('integrations.splashMsg3')"],
  ["'Tu sous-chef digital está calentando motores...'", "t('integrations.splashMsg4')"],
  ["'Optimizando el flujo de la cocina con matemáticas...'", "t('integrations.splashMsg5')"],
  ["'La IA ya sabe qué van a pedir antes que ellos...'", "t('integrations.splashMsg6')"],
  ["'Sincronizando datos más rápido que un camarero veterano...'", "t('integrations.splashMsg7')"],
  ["'Procesando números como si fueran mise en place...'", "t('integrations.splashMsg8')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 4. JosephineChat.tsx (7 strings — suggested questions + AI responses)
// ═══════════════════════════════════════════════════════════════════════
addKey('ai', 'suggestedLabourCost', '¿Cuál es el coste de personal actual vs el presupuesto? ¿Estamos dentro del objetivo de COL%?');
addKey('ai', 'suggestedIngredients', '¿Qué ingredientes están por debajo del nivel mínimo y necesito pedir?');
addKey('ai', 'suggestedExecutiveSummary', 'Dame un resumen ejecutivo del día de hoy: ventas, personal, incidencias, y predicciones para mañana.');
addKey('ai', 'welcomeMessage', '¡Hola! 👋 Soy **Josephine**, tu asistente de operaciones. Pregúntame sobre ventas, personal, inventario, previsiones o cualquier aspecto de tu restaurante.');
addKey('ai', 'errorRetry', 'No he podido obtener la información en este momento. Intenta de nuevo.');
addKey('ai', 'connectionError', 'No se pudo conectar con el asistente AI. Verifica que OPENAI_API_KEY esté configurada.');

replaceInFile('components/ai/JosephineChat.tsx', [
  ["'¿Cuál es el coste de personal actual vs el presupuesto? ¿Estamos dentro del objetivo de COL%?'", "t('ai.suggestedLabourCost')"],
  ["'¿Qué ingredientes están por debajo del nivel mínimo y necesito pedir?'", "t('ai.suggestedIngredients')"],
  ["'Dame un resumen ejecutivo del día de hoy: ventas, personal, incidencias, y predicciones para mañana.'", "t('ai.suggestedExecutiveSummary')"],
  ["'¡Hola! 👋 Soy **Josephine**, tu asistente de operaciones. Pregúntame sobre ventas, personal, inventario, previsiones o cualquier aspecto de tu restaurante.'", "t('ai.welcomeMessage')"],
  ["'No he podido obtener la información en este momento. Intenta de nuevo.'", "t('ai.errorRetry')"],
  ["`⚠️ Error: ${err.message || 'No se pudo conectar con el asistente AI. Verifica que OPENAI_API_KEY esté configurada.'}`", "`⚠️ Error: ${err.message || t('ai.connectionError')}`"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 5. LocationManager.tsx (6 strings — country/currency labels)
// ═══════════════════════════════════════════════════════════════════════
addKey('settings', 'countrySpain', 'España (Madrid)');
addKey('settings', 'countryFrance', 'Francia (París)');
addKey('settings', 'countryGermany', 'Alemania (Berlín)');
addKey('settings', 'countryUS', 'EEUU (Los Ángeles)');
addKey('settings', 'countryMexico', 'México (Ciudad de México)');
addKey('settings', 'currencyDollarUsd', '$ Dólar (USD)');

replaceInFile('components/settings/LocationManager.tsx', [
  ["label: 'España (Madrid)'", "label: t('settings.countrySpain')"],
  ["label: 'Francia (París)'", "label: t('settings.countryFrance')"],
  ["label: 'Alemania (Berlín)'", "label: t('settings.countryGermany')"],
  ["label: 'EEUU (Los Ángeles)'", "label: t('settings.countryUS')"],
  ["label: 'México (Ciudad de México)'", "label: t('settings.countryMexico')"],
  ["label: '$ Dólar (USD)'", "label: t('settings.currencyDollarUsd')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 6. LocationWizard.tsx (10 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('settings', 'currencyDollar', '$ Dólar');
addKey('settings', 'templateAlreadyAdded', '{{name}} ya está en tu lista');
addKey('settings', 'templateAdded', '{{name}} añadido');
addKey('settings', 'locationCreated', '¡Local "{{name}}" creado con {{products}} productos, {{tables}} mesas y {{schedules}} horarios tipo!');
addKey('common', 'nameRequired', 'Nombre *');

replaceInFile('components/settings/LocationWizard.tsx', [
  ["label: 'España (Madrid)'", "label: t('settings.countrySpain')"],
  ["label: 'Francia (París)'", "label: t('settings.countryFrance')"],
  ["label: 'Alemania (Berlín)'", "label: t('settings.countryGermany')"],
  ["label: 'EEUU (Los Ángeles)'", "label: t('settings.countryUS')"],
  ["label: 'México (Ciudad de México)'", "label: t('settings.countryMexico')"],
  ["label: '$ Dólar'", "label: t('settings.currencyDollar')"],
  ["`${template.name} ya está en tu lista`", "t('settings.templateAlreadyAdded', { name: template.name })"],
  ["`${template.name} añadido`", "t('settings.templateAdded', { name: template.name })"],
  ["Nombre *", "{t('common.nameRequired')}"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 7. SquareIntegration.tsx (6 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('integrations', 'syncTakingTooLong', 'La sincronización está tardando demasiado. Verifica el historial en unos minutos.');
addKey('integrations', 'processingData', 'Procesando datos...');
addKey('integrations', 'initialSyncInProgress', 'Sincronización inicial en curso...');
addKey('integrations', 'loadingSquareData', 'Cargando tus datos de Square...');
addKey('integrations', 'syncAlreadyActive', 'Ya hay una sincronización activa. Espera a que termine.');
addKey('integrations', 'syncInProgress', 'Sincronización en curso...');

replaceInFile('pages/integrations/SquareIntegration.tsx', [
  ["'La sincronización está tardando demasiado. Verifica el historial en unos minutos.'", "t('integrations.syncTakingTooLong')"],
  ["'Procesando datos...'", "t('integrations.processingData')"],
  ["'Sincronización inicial en curso...'", "t('integrations.initialSyncInProgress')"],
  ["'Cargando tus datos de Square...'", "t('integrations.loadingSquareData')"],
  ["'Ya hay una sincronización activa. Espera a que termine.'", "t('integrations.syncAlreadyActive')"],
  ["'Sincronización en curso...'", "t('integrations.syncInProgress')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 8. AskJosephinePanel.tsx (4 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('ai', 'suggestedSalesAboveBelow', '¿Por qué las ventas están por encima/debajo del forecast?');
addKey('ai', 'suggestedSalesDrivers', '¿Cuáles son los principales drivers de ventas?');
addKey('ai', 'suggestedUnderperforming', '¿Qué productos están underperforming?');
addKey('ai', 'suggestedTicketMedio', '¿Cómo podemos mejorar el ticket medio?');

replaceInFile('components/bi/AskJosephinePanel.tsx', [
  ["'¿Por qué las ventas están por encima/debajo del forecast?'", "t('ai.suggestedSalesAboveBelow')"],
  ["'¿Cuáles son los principales drivers de ventas?'", "t('ai.suggestedSalesDrivers')"],
  ["'¿Qué productos están underperforming?'", "t('ai.suggestedUnderperforming')"],
  ["'¿Cómo podemos mejorar el ticket medio?'", "t('ai.suggestedTicketMedio')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 9. AskJosephineDrawer.tsx (inventory) (4 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('ai', 'suggestedCogsAbove', '¿Por qué mi COGS actual está por encima del teórico?');
addKey('ai', 'suggestedWasteSources', '¿Cuáles son las principales fuentes de merma?');
addKey('ai', 'suggestedVarianceCategory', '¿Qué categoría tiene mayor varianza?');
addKey('ai', 'inventoryAnalysisPrompt', 'Analiza mi situación actual de inventario y dame un resumen ejecutivo con los puntos clave.');

replaceInFile('components/inventory/AskJosephineDrawer.tsx', [
  ["'¿Por qué mi COGS actual está por encima del teórico?'", "t('ai.suggestedCogsAbove')"],
  ["'¿Cuáles son las principales fuentes de merma?'", "t('ai.suggestedWasteSources')"],
  ["'¿Qué categoría tiene mayor varianza?'", "t('ai.suggestedVarianceCategory')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 10. AskJosephineLabourPanel.tsx (4 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('ai', 'suggestedColAboveBelow', '¿Por qué el COL% está por encima/debajo del objetivo?');
addKey('ai', 'suggestedStaffingAdjust', '¿Qué locations necesitan ajustes de staffing?');
addKey('ai', 'suggestedSplhImprove', '¿Cómo puedo mejorar el SPLH en las peores locations?');
addKey('ai', 'suggestedShiftSavings', '¿Cuánto podría ahorrar optimizando turnos?');

replaceInFile('components/labour/AskJosephineLabourPanel.tsx', [
  ["'¿Por qué el COL% está por encima/debajo del objetivo?'", "t('ai.suggestedColAboveBelow')"],
  ["'¿Qué locations necesitan ajustes de staffing?'", "t('ai.suggestedStaffingAdjust')"],
  ["'¿Cómo puedo mejorar el SPLH en las peores locations?'", "t('ai.suggestedSplhImprove')"],
  ["'¿Cuánto podría ahorrar optimizando turnos?'", "t('ai.suggestedShiftSavings')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 11. AskJosephineSalesDrawer.tsx (4 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('ai', 'suggestedSalesDropWednesday', '¿Por qué bajaron las ventas el miércoles?');
addKey('ai', 'suggestedBestChannel', '¿Qué canal está teniendo mejor desempeño?');
addKey('ai', 'suggestedTicketVsForecast', '¿Cómo está el ticket promedio comparado con forecast?');
addKey('ai', 'salesAnalysisPrompt', 'Analiza mi situación actual de ventas y dame un resumen ejecutivo con los puntos clave.');

replaceInFile('components/sales/AskJosephineSalesDrawer.tsx', [
  ["'¿Por qué bajaron las ventas el miércoles?'", "t('ai.suggestedSalesDropWednesday')"],
  ["'¿Qué canal está teniendo mejor desempeño?'", "t('ai.suggestedBestChannel')"],
  ["'¿Cómo está el ticket promedio comparado con forecast?'", "t('ai.suggestedTicketVsForecast')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 12. InsightErrorBoundary.tsx (4 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('common', 'errorLoadingData', '{{pageName}} — Error al cargar datos');
addKey('common', 'autoRetryCount', 'Reintento automático {{current}} de {{max}}…');
addKey('common', 'autoRetryExhausted', 'Los reintentos automáticos se agotaron. Puedes reintentar manualmente.');
addKey('common', 'unexpectedSectionError', 'Se produjo un error inesperado al cargar esta sección.');

replaceInFile('components/InsightErrorBoundary.tsx', [
  ["`${this.props.pageName} — Error al cargar datos`", "t('common.errorLoadingData', { pageName: this.props.pageName })"],
  ["`Reintento automático ${this.state.retryCount + 1} de ${MAX_RETRIES}…`", "t('common.autoRetryCount', { current: this.state.retryCount + 1, max: MAX_RETRIES })"],
  ["'Los reintentos automáticos se agotaron. Puedes reintentar manualmente.'", "t('common.autoRetryExhausted')"],
  ["'Se produjo un error inesperado al cargar esta sección.'", "t('common.unexpectedSectionError')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 13. PayrollCalculate.tsx (4 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('payroll', 'noPayrollInitiated', 'No hay nómina iniciada para este período. Vuelve a Inicio y pulsa "Iniciar Nómina".');
addKey('payroll', 'payrollsCalculated', 'Se han calculado {{count}} nóminas. Total neto: €{{total}}');
addKey('payroll', 'calculateError', 'Error al calcular nóminas.');
addKey('payroll', 'calculatePayrolls', 'Calcular Nóminas');

replaceInFile('components/payroll/PayrollCalculate.tsx', [
  ["`Se han calculado ${result.employees_calculated || 0} nóminas. Total neto: €${result.total_net_pay?.toLocaleString('es-ES', { minimumFractionDigits: 2 }) || '0'}`", "t('payroll.payrollsCalculated', { count: result.employees_calculated || 0, total: result.total_net_pay?.toLocaleString('es-ES', { minimumFractionDigits: 2 }) || '0' })"],
  ["'Error al calcular nóminas.'", "t('payroll.calculateError')"],
  ["Calcular Nóminas", "{t('payroll.calculatePayrolls')}"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 14. DataPrivacySection.tsx (4 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('settings', 'exportError', 'No se pudieron exportar los datos. Inténtalo de nuevo.');
addKey('settings', 'accountDeleteScheduled', 'Tu cuenta se eliminará en 30 días. Puedes cancelar desde este panel.');
addKey('settings', 'requestError', 'No se pudo procesar la solicitud. Inténtalo de nuevo.');
addKey('settings', 'consentStatus', 'Analíticas: {{analytics}} · Marketing: {{marketing}}');

replaceInFile('pages/Settings/DataPrivacySection.tsx', [
  ["'No se pudieron exportar los datos. Inténtalo de nuevo.'", "t('settings.exportError')"],
  ["'Tu cuenta se eliminará en 30 días. Puedes cancelar desde este panel.'", "t('settings.accountDeleteScheduled')"],
  ["'No se pudo procesar la solicitud. Inténtalo de nuevo.'", "t('settings.requestError')"],
  ["`Analíticas: ${currentConsent.analytics ? 'Sí' : 'No'} · Marketing: ${currentConsent.marketing ? 'Sí' : 'No'}`", "t('settings.consentStatus', { analytics: currentConsent.analytics ? t('common.yes') : t('common.no'), marketing: currentConsent.marketing ? t('common.yes') : t('common.no') })"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 15. OnboardingWizardV2.tsx (9 strings — tour steps + POS labels)
// ═══════════════════════════════════════════════════════════════════════
addKey('onboarding', 'tourMainMenu', 'Aquí tienes el menú principal. Navega entre las distintas secciones de Josephine.');
addKey('onboarding', 'tourControlTower', 'El Control Tower es tu centro de mando. Aquí ves un resumen de todo tu negocio.');
addKey('onboarding', 'tourKpiCards', 'Las tarjetas KPI muestran métricas clave: ventas, personal, costes y previsiones.');
addKey('onboarding', 'tourInsights', 'En Insights encontrarás análisis detallados: ventas, personal, P&L, reseñas, inventario y más.');
addKey('onboarding', 'tourWorkforce', 'Workforce gestiona tu equipo: turnos, fichajes, onboarding y más.');
addKey('onboarding', 'posSelectedLater', '{{pos}} seleccionado. Lo conectaremos después.');
addKey('onboarding', 'squareConnectLater', 'Square (se conectará al finalizar)');
addKey('onboarding', 'lightspeedConnectLater', 'Lightspeed (se conectará al finalizar)');
addKey('common', 'next', 'Siguiente');

replaceInFile('pages/OnboardingWizardV2.tsx', [
  ["'Aquí tienes el menú principal. Navega entre las distintas secciones de Josephine.'", "t('onboarding.tourMainMenu')"],
  ["'El Control Tower es tu centro de mando. Aquí ves un resumen de todo tu negocio.'", "t('onboarding.tourControlTower')"],
  ["'Las tarjetas KPI muestran métricas clave: ventas, personal, costes y previsiones.'", "t('onboarding.tourKpiCards')"],
  ["'En Insights encontrarás análisis detallados: ventas, personal, P&L, reseñas, inventario y más.'", "t('onboarding.tourInsights')"],
  ["'Workforce gestiona tu equipo: turnos, fichajes, onboarding y más.'", "t('onboarding.tourWorkforce')"],
  ["`${pos === 'square' ? 'Square' : 'Lightspeed'} seleccionado. Lo conectaremos después.`", "t('onboarding.posSelectedLater', { pos: pos === 'square' ? 'Square' : 'Lightspeed' })"],
  ["'Square (se conectará al finalizar)'", "t('onboarding.squareConnectLater')"],
  ["'Lightspeed (se conectará al finalizar)'", "t('onboarding.lightspeedConnectLater')"],
  [">Siguiente<", ">{t('common.next')}<"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 16. DataImport.tsx (5 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('common', 'dateRequired', 'Fecha (requerido)');
addKey('common', 'netSalesRequired', 'Ventas Netas (requerido)');
addKey('common', 'invalidDate', 'Fecha inválida: "{{value}}"');
addKey('common', 'invalidNetSales', 'Ventas netas inválidas: "{{value}}"');
addKey('common', 'import', 'Importar');

replaceInFile('pages/DataImport.tsx', [
  ["'Fecha (requerido)'", "t('common.dateRequired')"],
  ["'Ventas Netas (requerido)'", "t('common.netSalesRequired')"],
  ["`Fecha inválida: \"${row[dateIdx]}\"`", "t('common.invalidDate', { value: row[dateIdx] })"],
  ["`Ventas netas inválidas: \"${row[salesIdx]}\"`", "t('common.invalidNetSales', { value: row[salesIdx] })"],
  [">Importar<", ">{t('common.import')}<"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 17. EmailOTPVerification.tsx (3 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('auth', 'otpSent', 'Hemos enviado un código de 6 dígitos a {{email}}');
addKey('auth', 'otpSendError', 'No se pudo enviar el código. Intenta de nuevo.');
addKey('auth', 'otpVerifyError', 'Ocurrió un error al verificar. Intenta de nuevo.');

replaceInFile('components/auth/EmailOTPVerification.tsx', [
  ["`Hemos enviado un código de 6 dígitos a ${email}`", "t('auth.otpSent', { email })"],
  ["'No se pudo enviar el código. Intenta de nuevo.'", "t('auth.otpSendError')"],
  ["'Ocurrió un error al verificar. Intenta de nuevo.'", "t('auth.otpVerifyError')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 18. RecipesPage.tsx (3 strings — template literals)
// ═══════════════════════════════════════════════════════════════════════
addKey('inventory', 'recipeCreated', 'Receta "{{name}}" creada');
addKey('inventory', 'deleteRecipeConfirm', '¿Eliminar la receta "{{name}}"?');
addKey('inventory', 'recipeDeleted', 'Receta "{{name}}" eliminada');

replaceInFile('pages/inventory-setup/RecipesPage.tsx', [
  ["`Receta \"${newRecipe.menu_item_name}\" creada`", "t('inventory.recipeCreated', { name: newRecipe.menu_item_name })"],
  ["`¿Eliminar la receta \"${name}\"?`", "t('inventory.deleteRecipeConfirm', { name })"],
  ["`Receta \"${name}\" eliminada`", "t('inventory.recipeDeleted', { name })"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 19. KioskMode.tsx (3 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('workforce', 'cameraAccessDenied', 'No se pudo acceder a la cámara. Permite el acceso para fichar.');
addKey('workforce', 'pinNotRecognized', 'PIN no reconocido. Inténtalo de nuevo.');
addKey('workforce', 'photoRequiredForClock', 'Debes tomar una foto para fichar. Permite el acceso a la cámara.');

replaceInFile('pages/KioskMode.tsx', [
  ["'No se pudo acceder a la cámara. Permite el acceso para fichar.'", "t('workforce.cameraAccessDenied')"],
  ["'PIN no reconocido. Inténtalo de nuevo.'", "t('workforce.pinNotRecognized')"],
  ["'Debes tomar una foto para fichar. Permite el acceso a la cámara.'", "t('workforce.photoRequiredForClock')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 20. Reviews.tsx + ReviewsAll.tsx (3+3 strings — review reply templates)
// ═══════════════════════════════════════════════════════════════════════
addKey('reviews', 'replyPositive', '¡Hola {{author}}! Muchas gracias por tu opinión. Nos alegra saber que disfrutaste de nuestra comida y servicio. ¡Te esperamos pronto!');
addKey('reviews', 'replyNeutral', 'Estimado/a {{author}}, agradecemos sinceramente su valoración. Su opinión nos ayuda a mejorar cada día. Nos encantaría poder ofrecerle una experiencia aún mejor en su próxima visita.');
addKey('reviews', 'replyQuick', 'Gracias por tu reseña, {{author}}. ¡Esperamos verte pronto!');

replaceInFile('pages/Reviews.tsx', [
  ["`¡Hola ${review.author_name}! Muchas gracias por tu opinión. Nos alegra saber que disfrutaste de nuestra comida y servicio. ¡Te esperamos pronto!`", "t('reviews.replyPositive', { author: review.author_name })"],
  ["`Estimado/a ${review.author_name}, agradecemos sinceramente su valoración. Su opinión nos ayuda a mejorar cada día. Nos encantaría poder ofrecerle una experiencia aún mejor en su próxima visita.`", "t('reviews.replyNeutral', { author: review.author_name })"],
  ["`Gracias por tu reseña, ${review.author_name}. ¡Esperamos verte pronto!`", "t('reviews.replyQuick', { author: review.author_name })"],
]);

replaceInFile('pages/ReviewsAll.tsx', [
  ["`¡Hola ${review.author_name}! Muchas gracias por tu opinión. Nos alegra saber que disfrutaste de nuestra comida y servicio. ¡Te esperamos pronto!`", "t('reviews.replyPositive', { author: review.author_name })"],
  ["`Estimado/a ${review.author_name}, agradecemos sinceramente su valoración. Su opinión nos ayuda a mejorar cada día. Nos encantaría poder ofrecerle una experiencia aún mejor en su próxima visita.`", "t('reviews.replyNeutral', { author: review.author_name })"],
  ["`Gracias por tu reseña, ${review.author_name}. ¡Esperamos verte pronto!`", "t('reviews.replyQuick', { author: review.author_name })"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 21. ModuleErrorBoundary.tsx (2 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('common', 'autoRetrying', 'Reintentando automáticamente ({{current}}/{{max}})…');
addKey('common', 'autoRetriesExhausted', 'Los reintentos automáticos se agotaron.');

replaceInFile('components/errors/ModuleErrorBoundary.tsx', [
  ["`Reintentando automáticamente (${this.state.retryCount + 1}/${MAX_RETRIES})…`", "t('common.autoRetrying', { current: this.state.retryCount + 1, max: MAX_RETRIES })"],
  ["'Los reintentos automáticos se agotaron.'", "t('common.autoRetriesExhausted')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 22. AddItemDialog.tsx (2 strings — placeholders)
// ═══════════════════════════════════════════════════════════════════════
addKey('inventory', 'exampleFreshSalmon', 'e.g., Salmón Fresco');
addKey('inventory', 'exampleSupplierName', 'e.g., Pescaderías del Norte');

replaceInFile('components/inventory/AddItemDialog.tsx', [
  ["'e.g., Salmón Fresco'", "t('inventory.exampleFreshSalmon')"],
  ["'e.g., Pescaderías del Norte'", "t('inventory.exampleSupplierName')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 23. AutoPurchaseOrder.tsx (2 strings — template literals)
// ═══════════════════════════════════════════════════════════════════════
addKey('inventory', 'itemsBelowMinimum', '{{count}} items por debajo del nivel mínimo');
addKey('inventory', 'purchaseOrderCreated', 'Orden de compra creada con {{count}} líneas');

replaceInFile('components/inventory/AutoPurchaseOrder.tsx', [
  ["`${result.length} items por debajo del nivel mínimo`", "t('inventory.itemsBelowMinimum', { count: result.length })"],
  ["`Orden de compra creada con ${result.totalLines} líneas`", "t('inventory.purchaseOrderCreated', { count: result.totalLines })"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 24. SmartCountingFlow.tsx (2 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('inventory', 'quantityInUnit', 'Cantidad en {{unit}}');
addKey('inventory', 'saveCounts', 'Guardar {{count}} contajes');

replaceInFile('components/inventory/SmartCountingFlow.tsx', [
  ["`Cantidad en ${current.unit}`", "t('inventory.quantityInUnit', { unit: current.unit })"],
  ["`Guardar ${countedCount} contajes`", "t('inventory.saveCounts', { count: countedCount })"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 25. PayrollHome.tsx (2 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('payroll', 'employeesWithoutIbanSepa', '{{count}} empleado(s) sin IBAN (no se podrá generar SEPA)');
addKey('payroll', 'selectEntity', 'Selecciona entidad...');

replaceInFile('components/payroll/PayrollHome.tsx', [
  ["`${totalEmps - withIban} empleado(s) sin IBAN (no se podrá generar SEPA)`", "t('payroll.employeesWithoutIbanSepa', { count: totalEmps - withIban })"],
  ["'Selecciona entidad...'", "t('payroll.selectEntity')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 26. LoyaltyManager.tsx (2 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('settings', 'pointsAdded', '{{points}} puntos añadidos');
addKey('settings', 'loyaltyPlaceholderRewards', 'Café gratis, 10% descuento...');

replaceInFile('components/settings/LoyaltyManager.tsx', [
  ["`${pointsForm.points > 0 ? '+' : ''}${pointsForm.points} puntos añadidos`", "t('settings.pointsAdded', { points: `${pointsForm.points > 0 ? '+' : ''}${pointsForm.points}` })"],
  ["'Café gratis, 10% descuento...'", "t('settings.loyaltyPlaceholderRewards')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 27. UsersRolesManager.tsx (2 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('settings', 'roleRequiresLocation', 'El rol "{{role}}" requiere una ubicación específica');
addKey('settings', 'requiresLocation', ' (requiere ubicación)');

replaceInFile('components/settings/UsersRolesManager.tsx', [
  ["`El rol \"${selectedRole?.name}\" requiere una ubicación específica`", "t('settings.roleRequiresLocation', { role: selectedRole?.name })"],
  ["' (requiere ubicación)'", "t('settings.requiresLocation')"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 28. TeamManager.tsx (1 string — same role requires location)
// ═══════════════════════════════════════════════════════════════════════
replaceInFile('components/settings/TeamManager.tsx', [
  ["`El rol \"${selectedRole.name}\" requiere una ubicación específica`", "t('settings.roleRequiresLocation', { role: selectedRole.name })"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 29. OnboardingChecklist.tsx (2 strings)
// ═══════════════════════════════════════════════════════════════════════
addKey('onboarding', 'addSuppliersForProcurement', 'Añade tus proveedores para activar Procurement (pedidos inteligentes)');
addKey('onboarding', 'itemsInCatalog', '✓ {{count}} artículos en catálogo');

replaceInFile('pages/OnboardingChecklist.tsx', [
  ["'Añade tus proveedores para activar Procurement (pedidos inteligentes)'", "t('onboarding.addSuppliersForProcurement')"],
  ["`✓ ${inventoryRes.count} artículos en catálogo`", "t('onboarding.itemsInCatalog', { count: inventoryRes.count })"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 30-43. Single-string files
// ═══════════════════════════════════════════════════════════════════════
addKey('common', 'noAccessMessage', 'No tienes permisos para ver esta página. Contacta a tu administrador si crees que es un error.');
addKey('common', 'loading', 'Cargando...');
addKey('common', 'demoDataBanner', 'Estás viendo datos de demostración. Conecta tu POS para ver datos reales.');
addKey('common', 'reason', 'Razón: {{reason}}');
addKey('integrations', 'disconnectLightspeed', '¿Desconectar Lightspeed? Los datos sincronizados se mantendrán.');
addKey('inventory', 'addIngredient', 'Añadir Ingrediente');
addKey('common', 'onboardingCompanyExample', 'Ej: Restaurantes García S.L.');
addKey('payroll', 'searchEmployee', 'Buscar empleado...');
addKey('pos', 'cashCountInstructions', 'Introduce el efectivo contado para cerrar la sesión.');
addKey('pos', 'searchProduct', 'Buscar producto...');
addKey('inventory', 'searchEllipsis', 'Buscar...');
addKey('scheduling', 'autoScheduleDescription', 'Respeta automáticamente las normas laborales, la disponibilidad del equipo y las preferencias de cada empleado.');
addKey('scheduling', 'addScheduleMessage', 'Añade un mensaje con la notificación del horario...');
addKey('settings', 'bookingImportantInfo', 'Información importante que los clientes deben saber...');
addKey('pricing', 'starterPlanDescription', 'El plan Starter es gratuito para siempre. Pro y Enterprise tienen 14 días de prueba gratuita.');
addKey('auth', 'resetLinkExpired', 'El enlace de recuperación ha expirado o es inválido. Por favor solicita uno nuevo.');
addKey('workforce', 'employeeAddedToTeam', '{{name}} añadido al equipo');
addKey('common', 'yes', 'Sí');
addKey('common', 'no', 'No');

replaceInFile('components/common/NoAccess.tsx', [
  ["'No tienes permisos para ver esta página. Contacta a tu administrador si crees que es un error.'", "t('common.noAccessMessage')"],
]);

replaceInFile('components/ui/DataSourceBadge.tsx', [
  ["'Cargando...'", "t('common.loading')"],
]);

replaceInFile('components/ui/DemoDataBanner.tsx', [
  ["Estás viendo datos de demostración. Conecta tu POS para ver datos reales.", "{t('common.demoDataBanner')}"],
]);

replaceInFile('components/layout/DataSourceBadge.tsx', [
  ["`Razón: ${reasonLabel}`", "t('common.reason', { reason: reasonLabel })"],
]);

replaceInFile('pages/integrations/LightspeedIntegration.tsx', [
  ["'¿Desconectar Lightspeed? Los datos sincronizados se mantendrán.'", "t('integrations.disconnectLightspeed')"],
]);

replaceInFile('pages/inventory-setup/RecipeDetailPage.tsx', [
  [">Añadir Ingrediente<", ">{t('inventory.addIngredient')}<"],
]);

replaceInFile('components/onboarding/OnboardingWizard.tsx', [
  ["'Ej: Restaurantes García S.L.'", "t('common.onboardingCompanyExample')"],
]);

replaceInFile('components/payroll/PayrollEmployees.tsx', [
  ["'Buscar empleado...'", "t('payroll.searchEmployee')"],
]);

replaceInFile('components/pos/POSCashSession.tsx', [
  ["'Introduce el efectivo contado para cerrar la sesión.'", "t('pos.cashCountInstructions')"],
]);

replaceInFile('components/pos/POSQuickOrder.tsx', [
  ["'Buscar producto...'", "t('pos.searchProduct')"],
]);

replaceInFile('components/pricing-omnes/PricingOmnesTable.tsx', [
  ["'Buscar...'", "t('inventory.searchEllipsis')"],
]);

replaceInFile('components/scheduling/CreateScheduleModal.tsx', [
  ["'Respeta automáticamente las normas laborales, la disponibilidad del equipo y las preferencias de cada empleado.'", "t('scheduling.autoScheduleDescription')"],
]);

replaceInFile('components/scheduling/PublishModal.tsx', [
  ["'Añade un mensaje con la notificación del horario...'", "t('scheduling.addScheduleMessage')"],
]);

replaceInFile('components/settings/BookingSettingsManager.tsx', [
  ["'Información importante que los clientes deben saber...'", "t('settings.bookingImportantInfo')"],
]);

replaceInFile('pages/Pricing.tsx', [
  ["'El plan Starter es gratuito para siempre. Pro y Enterprise tienen 14 días de prueba gratuita.'", "t('pricing.starterPlanDescription')"],
]);

replaceInFile('pages/ResetPassword.tsx', [
  ["'El enlace de recuperación ha expirado o es inválido. Por favor solicita uno nuevo.'", "t('auth.resetLinkExpired')"],
]);

replaceInFile('pages/WorkforceTeam.tsx', [
  ["`${form.full_name} añadido al equipo`", "t('workforce.employeeAddedToTeam', { name: form.full_name })"],
]);

// ═══════════════════════════════════════════════════════════════════════
// 44. Scheduling.tsx (1 complex template literal)
// ═══════════════════════════════════════════════════════════════════════
addKey('scheduling', 'autoFillResult', 'Auto-fill: {{count}} turno(s) añadido(s)');

replaceInFile('pages/Scheduling.tsx', [
  ["`Auto-fill: ${count} turno${count > 1 ? 's' : ''} añadido${count > 1 ? 's' : ''}`", "t('scheduling.autoFillResult', { count })"],
]);

// ═══════════════════════════════════════════════════════════════════════
// Save es.json with all new keys
// ═══════════════════════════════════════════════════════════════════════
fs.writeFileSync(ES_PATH, JSON.stringify(es, null, 2) + '\n', 'utf8');

console.log(`\n✅ Batch-4 complete: ${totalReplaced} replacements, ${totalKeys} new keys added`);
console.log('New key namespaces:', Object.keys(newKeys).join(', '));
