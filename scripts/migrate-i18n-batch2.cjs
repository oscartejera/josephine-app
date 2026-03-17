#!/usr/bin/env node
/**
 * migrate-i18n-batch2.cjs — Second batch of hardcoded string migrations
 * Covers: components/settings, scheduling, procurement, reviews, waste,
 *         pages/DataImport, Integrations, Recipes, team, etc.
 */
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const SRC_DIR = path.join(__dirname, '..', 'src');
const esPath = path.join(LOCALES_DIR, 'es.json');
let esData = JSON.parse(fs.readFileSync(esPath, 'utf8'));

let filesModified = 0, keysAdded = 0, stringsReplaced = 0;

function setNestedKey(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in cur) || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  if (!(parts[parts.length - 1] in cur)) { cur[parts[parts.length - 1]] = value; keysAdded++; }
}

function processFile(relPath, replacements) {
  const fullPath = path.join(SRC_DIR, relPath);
  if (!fs.existsSync(fullPath)) { console.log(`  ⏭️  ${relPath} not found`); return; }
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false, count = 0;
  for (const r of replacements) {
    if (r.i18nKey && r.i18nValue) setNestedKey(esData, r.i18nKey, r.i18nValue);
    if (content.includes(r.search)) {
      content = content.replace(r.search, r.replace);
      modified = true; count++; stringsReplaced++;
    }
  }
  if (modified) {
    // Ensure useTranslation import
    if (!content.includes('useTranslation')) {
      const lines = content.split('\n');
      let lastImport = -1;
      for (let i = 0; i < lines.length; i++) if (lines[i].trimStart().startsWith('import ')) lastImport = i;
      if (lastImport >= 0) { lines.splice(lastImport + 1, 0, "import { useTranslation } from 'react-i18next';"); content = lines.join('\n'); }
    }
    fs.writeFileSync(fullPath, content, 'utf8');
    filesModified++; console.log(`  ✅ ${relPath} — ${count} strings`);
  }
}

console.log('\n🔄 Batch 2: Migrating remaining hardcoded strings...\n');

// ── Scheduling Components ──
processFile('components/scheduling/SwapShiftDialog.tsx', [
  { search: '>Select shift to swap with<', replace: '>{t("scheduling.selectShiftToSwap")}<',
    i18nKey: 'scheduling.selectShiftToSwap', i18nValue: 'Selecciona turno con el que intercambiar' },
]);

processFile('components/scheduling/SwapRequestsPanel.tsx', [
  { search: '>No swap requests yet<', replace: '>{t("scheduling.noSwapRequests")}<',
    i18nKey: 'scheduling.noSwapRequests', i18nValue: 'No hay solicitudes de intercambio aún' },
  { search: '>Employees can request to swap shifts with colleagues<', replace: '>{t("scheduling.swapDescription")}<',
    i18nKey: 'scheduling.swapDescription', i18nValue: 'Los empleados pueden solicitar intercambiar turnos con compañeros' },
]);

processFile('components/scheduling/ScheduleSettingsSheet.tsx', [
  { search: '>Tipo de servicio<', replace: '>{t("scheduling.serviceType")}<',
    i18nKey: 'scheduling.serviceType', i18nValue: 'Tipo de servicio' },
  { search: '>Coste horario medio €/h<', replace: '>{t("scheduling.avgHourlyCost")}<',
    i18nKey: 'scheduling.avgHourlyCost', i18nValue: 'Coste horario medio €/h' },
]);

processFile('components/scheduling/ScheduleGrid.tsx', [
  { search: '>No actual data<', replace: '>{t("scheduling.noActualData")}<',
    i18nKey: 'scheduling.noActualData', i18nValue: 'Sin datos reales' },
]);

processFile('components/scheduling/EmptyScheduleState.tsx', [
  { search: '>No schedule yet<', replace: '>{t("scheduling.noScheduleYet")}<',
    i18nKey: 'scheduling.noScheduleYet', i18nValue: 'Aún no hay horario' },
]);

// ── Reviews Components ──
processFile('components/reviews/RatingOverTimeChart.tsx', [
  { search: '>Rating over time<', replace: '>{t("reviews.ratingOverTime")}<',
    i18nKey: 'reviews.ratingOverTime', i18nValue: 'Valoración a lo largo del tiempo' },
]);

processFile('components/reviews/RatingByLocationTable.tsx', [
  { search: '>Rating by location<', replace: '>{t("reviews.ratingByLocation")}<',
    i18nKey: 'reviews.ratingByLocation', i18nValue: 'Valoración por ubicación' },
]);

processFile('components/reviews/CustomerReviewsPanel.tsx', [
  { search: '>No reviews found for this period<', replace: '>{t("reviews.noReviewsForPeriod")}<',
    i18nKey: 'reviews.noReviewsForPeriod', i18nValue: 'No se encontraron reseñas para este periodo' },
]);

// ── Waste Components ──
processFile('components/waste/WasteLeaderboard.tsx', [
  { search: '>Logged waste value<', replace: '>{t("waste.loggedWasteValue")}<',
    i18nKey: 'waste.loggedWasteValue', i18nValue: 'Valor de merma registrado' },
]);

processFile('components/waste/WasteCategoryDonut.tsx', [
  { search: '>Waste by ingredient category<', replace: '>{t("waste.byIngredientCategory")}<',
    i18nKey: 'waste.byIngredientCategory', i18nValue: 'Merma por categoría de ingrediente' },
]);

// ── Procurement Components ──
processFile('components/procurement/ProcurementSettingsDialog.tsx', [
  { search: '>Reset all settings?<', replace: '>{t("procurement.resetSettings")}<',
    i18nKey: 'procurement.resetSettings', i18nValue: '¿Restablecer toda la configuración?' },
]);

processFile('components/procurement/OrderSummaryPanel.tsx', [
  { search: '>No items in cart<', replace: '>{t("procurement.noItemsInCart")}<',
    i18nKey: 'procurement.noItemsInCart', i18nValue: 'No hay artículos en el carrito' },
]);

processFile('components/procurement/OrderSummaryDesktop.tsx', [
  { search: '>No items in cart<', replace: '>{t("procurement.noItemsInCart")}<',
    i18nKey: 'procurement.noItemsInCart', i18nValue: 'No hay artículos en el carrito' },
]);

processFile('components/procurement/OrderHistoryPanel.tsx', [
  { search: '>View past orders and quickly reorder<', replace: '>{t("procurement.viewPastOrders")}<',
    i18nKey: 'procurement.viewPastOrders', i18nValue: 'Ver pedidos anteriores y reordenar rápidamente' },
]);

// ── Sales Components ──
processFile('components/sales/DateRangePicker.tsx', [
  { search: '>Or select custom range:<', replace: '>{t("sales.selectCustomRange")}:<',
    i18nKey: 'sales.selectCustomRange', i18nValue: 'O selecciona rango personalizado' },
]);

processFile('components/sales/AskJosephine.tsx', [
  { search: '>Ask about your sales<', replace: '>{t("sales.askAboutSales")}<',
    i18nKey: 'sales.askAboutSales', i18nValue: 'Pregunta sobre tus ventas' },
]);

// ── Settings Components ──
processFile('components/settings/LocationWizard.tsx', [
  { search: '>Añade tus proveedores actuales<', replace: '>{t("settings.addCurrentSuppliers")}<',
    i18nKey: 'settings.addCurrentSuppliers', i18nValue: 'Añade tus proveedores actuales' },
]);

processFile('components/settings/LocationManager.tsx', [
  { search: '>Se creará automáticamente:<', replace: '>{t("settings.autoCreated")}:<',
    i18nKey: 'settings.autoCreated', i18nValue: 'Se creará automáticamente' },
  { search: '>Plano de sala con 5 mesas de ejemplo<', replace: '>{t("settings.floorPlan5Tables")}<',
    i18nKey: 'settings.floorPlan5Tables', i18nValue: 'Plano de sala con 5 mesas de ejemplo' },
  { search: '>Configuración de objetivos (GP, COL)<', replace: '>{t("settings.objectivesConfig")}<',
    i18nKey: 'settings.objectivesConfig', i18nValue: 'Configuración de objetivos (GP, COL)' },
  { search: '>Configuración de nóminas (España)<', replace: '>{t("settings.payrollConfig")}<',
    i18nKey: 'settings.payrollConfig', i18nValue: 'Configuración de nóminas (España)' },
  { search: '>Local de origen<', replace: '>{t("settings.sourceLocation")}<',
    i18nKey: 'settings.sourceLocation', i18nValue: 'Local de origen' },
  { search: '>Esta acción eliminará permanentemente:<', replace: '>{t("settings.deleteWarning")}:<',
    i18nKey: 'settings.deleteWarning', i18nValue: 'Esta acción eliminará permanentemente' },
  { search: '>Todos los tickets y ventas del local<', replace: '>{t("settings.allTicketsAndSales")}<',
    i18nKey: 'settings.allTicketsAndSales', i18nValue: 'Todos los tickets y ventas del local' },
  { search: '>Empleados asignados a este local<', replace: '>{t("settings.assignedEmployees")}<',
    i18nKey: 'settings.assignedEmployees', i18nValue: 'Empleados asignados a este local' },
  { search: '>Inventario y pedidos<', replace: '>{t("settings.inventoryAndOrders")}<',
    i18nKey: 'settings.inventoryAndOrders', i18nValue: 'Inventario y pedidos' },
  { search: '>Configuración de mesas y planos<', replace: '>{t("settings.tablesAndFloorPlans")}<',
    i18nKey: 'settings.tablesAndFloorPlans', i18nValue: 'Configuración de mesas y planos' },
  { search: '>Añade tu primer local para empezar<', replace: '>{t("settings.addFirstLocation")}<',
    i18nKey: 'settings.addFirstLocation', i18nValue: 'Añade tu primer local para empezar' },
]);

processFile('components/settings/ExportTab.tsx', [
  { search: '>Descarga datos en formato CSV<', replace: '>{t("settings.downloadCsv")}<',
    i18nKey: 'settings.downloadCsv', i18nValue: 'Descarga datos en formato CSV' },
  { search: '>Historial de ventas y transacciones<', replace: '>{t("settings.salesHistory")}<',
    i18nKey: 'settings.salesHistory', i18nValue: 'Historial de ventas y transacciones' },
  { search: '>Lista de empleados y roles<', replace: '>{t("settings.employeeList")}<',
    i18nKey: 'settings.employeeList', i18nValue: 'Lista de empleados y roles' },
  { search: '>Items de inventario y stock<', replace: '>{t("settings.inventoryItems")}<',
    i18nKey: 'settings.inventoryItems', i18nValue: 'Items de inventario y stock' },
]);

processFile('components/settings/EventCalendarManager.tsx', [
  { search: '>Impacto en ventas<', replace: '>{t("settings.salesImpact")}<',
    i18nKey: 'settings.salesImpact', i18nValue: 'Impacto en ventas' },
]);

processFile('components/settings/DataSourceSettings.tsx', [
  { search: '>Modo de selección<', replace: '>{t("settings.selectionMode")}<',
    i18nKey: 'settings.selectionMode', i18nValue: 'Modo de selección' },
  { search: '>Fuente de datos<', replace: '>{t("settings.dataSource")}<',
    i18nKey: 'settings.dataSource', i18nValue: 'Fuente de datos' },
]);

processFile('components/settings/BookingSettingsManager.tsx', [
  { search: '>Selecciona una ubicación para configurar las reservas online<', replace: '>{t("settings.selectLocationForBooking")}<',
    i18nKey: 'settings.selectLocationForBooking', i18nValue: 'Selecciona una ubicación para configurar las reservas online' },
  { search: '>Habilitar reservas online<', replace: '>{t("settings.enableOnlineBooking")}<',
    i18nKey: 'settings.enableOnlineBooking', i18nValue: 'Habilitar reservas online' },
  { search: '>Límites de personas<', replace: '>{t("settings.peopleLimits")}<',
    i18nKey: 'settings.peopleLimits', i18nValue: 'Límites de personas' },
  { search: '>Días de antelación máximos<', replace: '>{t("settings.maxAdvanceDays")}<',
    i18nKey: 'settings.maxAdvanceDays', i18nValue: 'Días de antelación máximos' },
  { search: '>Notas para clientes<', replace: '>{t("settings.customerNotes")}<',
    i18nKey: 'settings.customerNotes', i18nValue: 'Notas para clientes' },
]);

processFile('components/settings/BillingTab.tsx', [
  { search: '>Tu plan actual y estado de suscripción<', replace: '>{t("settings.currentPlanStatus")}<',
    i18nKey: 'settings.currentPlanStatus', i18nValue: 'Tu plan actual y estado de suscripción' },
  { search: '>Facturación y pagos<', replace: '>{t("settings.billingAndPayments")}<',
    i18nKey: 'settings.billingAndPayments', i18nValue: 'Facturación y pagos' },
  { search: '>Actualizar tu método de pago<', replace: '>{t("settings.updatePaymentMethod")}<',
    i18nKey: 'settings.updatePaymentMethod', i18nValue: 'Actualizar tu método de pago' },
  { search: '>Cambiar o cancelar tu suscripción<', replace: '>{t("settings.changeOrCancelSub")}<',
    i18nKey: 'settings.changeOrCancelSub', i18nValue: 'Cambiar o cancelar tu suscripción' },
]);

// ── Pages ──
processFile('pages/ReviewsAll.tsx', [
  { search: '>No reviews found for this period<', replace: '>{t("reviews.noReviewsForPeriod")}<',
    i18nKey: 'reviews.noReviewsForPeriod', i18nValue: 'No se encontraron reseñas para este periodo' },
]);

processFile('pages/ProcurementOrders.tsx', [
  { search: '>No suppliers found<', replace: '>{t("procurement.noSuppliersFound")}<',
    i18nKey: 'procurement.noSuppliersFound', i18nValue: 'No se encontraron proveedores' },
  { search: '>Place an order to add suppliers<', replace: '>{t("procurement.placeOrderToAdd")}<',
    i18nKey: 'procurement.placeOrderToAdd', i18nValue: 'Realiza un pedido para añadir proveedores' },
  { search: '>No orders yet<', replace: '>{t("procurement.noOrdersYet")}<',
    i18nKey: 'procurement.noOrdersYet', i18nValue: 'No hay pedidos aún' },
  { search: '>No line items found<', replace: '>{t("procurement.noLineItems")}<',
    i18nKey: 'procurement.noLineItems', i18nValue: 'No se encontraron líneas de pedido' },
]);

processFile('pages/ProcurementCart.tsx', [
  { search: '>Your cart is empty<', replace: '>{t("procurement.cartEmpty")}<',
    i18nKey: 'procurement.cartEmpty', i18nValue: 'Tu carrito está vacío' },
]);

processFile('pages/StaffFloor.tsx', [
  { search: '>Selecciona un local<', replace: '>{t("staff.selectLocation")}<',
    i18nKey: 'staff.selectLocation', i18nValue: 'Selecciona un local' },
]);

processFile('pages/StaffClock.tsx', [
  { search: '>Selecciona un local<', replace: '>{t("staff.selectLocation")}<',
    i18nKey: 'staff.selectLocation', i18nValue: 'Selecciona un local' },
]);

processFile('pages/InventoryLocation.tsx', [
  { search: '>Something went wrong<', replace: '>{t("common.somethingWentWrong")}<',
    i18nKey: 'common.somethingWentWrong', i18nValue: 'Algo salió mal' },
]);

processFile('pages/team/TeamHome.tsx', [
  { search: '>Turno de hoy<', replace: '>{t("team.todayShift")}<',
    i18nKey: 'team.todayShift', i18nValue: 'Turno de hoy' },
  { search: '>Horas y pagos<', replace: '>{t("team.hoursAndPay")}<',
    i18nKey: 'team.hoursAndPay', i18nValue: 'Horas y pagos' },
  { search: '>Noticias del equipo<', replace: '>{t("team.teamNews")}<',
    i18nKey: 'team.teamNews', i18nValue: 'Noticias del equipo' },
]);

processFile('pages/team/TeamPay.tsx', [
  { search: '>Control de horas y estimaciones<', replace: '>{t("team.hoursControl")}<',
    i18nKey: 'team.hoursControl', i18nValue: 'Control de horas y estimaciones' },
]);

processFile('pages/ResetPassword.tsx', [
  { search: '>Tu contraseña ha sido cambiada exitosamente<', replace: '>{t("auth.passwordChanged")}<',
    i18nKey: 'auth.passwordChanged', i18nValue: 'Tu contraseña ha sido cambiada exitosamente' },
  { search: '>Ingresa tu nueva contraseña<', replace: '>{t("auth.enterNewPassword")}<',
    i18nKey: 'auth.enterNewPassword', i18nValue: 'Ingresa tu nueva contraseña' },
]);

processFile('pages/Settings/DataPrivacySection.tsx', [
  { search: '>Preferencias de cookies<', replace: '>{t("settings.cookiePreferences")}<',
    i18nKey: 'settings.cookiePreferences', i18nValue: 'Preferencias de cookies' },
]);

processFile('pages/WorkforceTeam.tsx', [
  { search: '>Todos los locales<', replace: '>{t("common.allLocations")}<',
    i18nKey: 'common.allLocations', i18nValue: 'Todos los locales' },
]);

processFile('pages/Integrations.tsx', [
  { search: '>Catálogo de productos y menú<', replace: '>{t("integrations.productCatalog")}<',
    i18nKey: 'integrations.productCatalog', i18nValue: 'Catálogo de productos y menú' },
  { search: '>Pedidos y tickets<', replace: '>{t("integrations.ordersAndTickets")}<',
    i18nKey: 'integrations.ordersAndTickets', i18nValue: 'Pedidos y tickets' },
  { search: '>Pagos y transacciones<', replace: '>{t("integrations.paymentsAndTransactions")}<',
    i18nKey: 'integrations.paymentsAndTransactions', i18nValue: 'Pagos y transacciones' },
  { search: '>Información de ubicaciones<', replace: '>{t("integrations.locationInfo")}<',
    i18nKey: 'integrations.locationInfo', i18nValue: 'Información de ubicaciones' },
]);

processFile('pages/DataImport.tsx', [
  { search: '>Sube tu primer archivo CSV para empezar<', replace: '>{t("dataImport.uploadFirstCsv")}<',
    i18nKey: 'dataImport.uploadFirstCsv', i18nValue: 'Sube tu primer archivo CSV para empezar' },
  { search: '>Arrastra tu archivo aquí<', replace: '>{t("dataImport.dragFileHere")}<',
    i18nKey: 'dataImport.dragFileHere', i18nValue: 'Arrastra tu archivo aquí' },
  { search: '>Esto puede tardar unos segundos<', replace: '>{t("dataImport.mayTakeSeconds")}<',
    i18nKey: 'dataImport.mayTakeSeconds', i18nValue: 'Esto puede tardar unos segundos' },
]);

processFile('pages/DataHealth.tsx', [
  { search: '>Con par level:<', replace: '>{t("dataHealth.withParLevel")}:<',
    i18nKey: 'dataHealth.withParLevel', i18nValue: 'Con par level' },
  { search: '>Ubicaciones con conteo:<', replace: '>{t("dataHealth.locationsWithCount")}:<',
    i18nKey: 'dataHealth.locationsWithCount', i18nValue: 'Ubicaciones con conteo' },
]);

processFile('pages/integrations/SquareIntegration.tsx', [
  { search: '>Sincronización automática con Square<', replace: '>{t("integrations.squareAutoSync")}<',
    i18nKey: 'integrations.squareAutoSync', i18nValue: 'Sincronización automática con Square' },
  { search: '>Conecta tu cuenta de Square<', replace: '>{t("integrations.connectSquare")}<',
    i18nKey: 'integrations.connectSquare', i18nValue: 'Conecta tu cuenta de Square' },
  { search: '>Locales y ubicaciones<', replace: '>{t("integrations.localesAndLocations")}<',
    i18nKey: 'integrations.localesAndLocations', i18nValue: 'Locales y ubicaciones' },
  { search: '>Catálogo de productos (items y categorías)<', replace: '>{t("integrations.productCatalogFull")}<',
    i18nKey: 'integrations.productCatalogFull', i18nValue: 'Catálogo de productos (items y categorías)' },
  { search: '>Métodos de pago y cantidades<', replace: '>{t("integrations.paymentMethodsAndAmounts")}<',
    i18nKey: 'integrations.paymentMethodsAndAmounts', i18nValue: 'Métodos de pago y cantidades' },
]);

processFile('pages/inventory-setup/RecipesPage.tsx', [
  { search: '>Nombre del plato *<', replace: '>{t("recipes.dishName")}<',
    i18nKey: 'recipes.dishName', i18nValue: 'Nombre del plato *' },
  { search: '>Unidad de rendimiento<', replace: '>{t("recipes.yieldUnit")}<',
    i18nKey: 'recipes.yieldUnit', i18nValue: 'Unidad de rendimiento' },
]);

processFile('pages/inventory-setup/RecipeDetailPage.tsx', [
  { search: '>Receta no encontrada<', replace: '>{t("recipes.notFound")}<',
    i18nKey: 'recipes.notFound', i18nValue: 'Receta no encontrada' },
  { search: '>Detalles de la Receta<', replace: '>{t("recipes.details")}<',
    i18nKey: 'recipes.details', i18nValue: 'Detalles de la Receta' },
  { search: '>Ingrediente de inventario<', replace: '>{t("recipes.inventoryIngredient")}<',
    i18nKey: 'recipes.inventoryIngredient', i18nValue: 'Ingrediente de inventario' },
]);

processFile('pages/inventory-setup/MenuItemsPage.tsx', [
  { search: '>Food cost medio<', replace: '>{t("menu.avgFoodCost")}<',
    i18nKey: 'menu.avgFoodCost', i18nValue: 'Food cost medio' },
]);

// ── UI Components ──
processFile('components/ui/RouteErrorBoundary.tsx', [
  { search: '>Something went wrong<', replace: '>{t("common.somethingWentWrong")}<',
    i18nKey: 'common.somethingWentWrong', i18nValue: 'Algo salió mal' },
]);

// ── BI Components ──
processFile('components/bi/BISalesHeader.tsx', [
  { search: '>No data for this period<', replace: '>{t("bi.noDataForPeriod")}<',
    i18nKey: 'bi.noDataForPeriod', i18nValue: 'Sin datos para este periodo' },
]);

processFile('components/dashboard/LocationBenchmark.tsx', [
  { search: '>No data for this period<', replace: '>{t("dashboard.noDataForPeriod")}<',
    i18nKey: 'dashboard.noDataForPeriod', i18nValue: 'Sin datos para este periodo' },
]);

// ── Save ──
fs.writeFileSync(esPath, JSON.stringify(esData, null, 2) + '\n', 'utf8');
console.log(`\n📊 Batch 2 Summary:`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Strings replaced: ${stringsReplaced}`);
console.log(`   New i18n keys added: ${keysAdded}`);
console.log(`\n💡 Run \`npm run i18n:sync\` to propagate.\n`);
