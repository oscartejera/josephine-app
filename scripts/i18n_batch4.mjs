/**
 * i18n Batch 4 — JSX inline text, toast({title}), empty-states, labels, buttons
 * Run: node scripts/i18n_batch4.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

/* ── file-level replacements ────────────────────────────────────── */
const replacements = {

  /* ── PAGES ────────────────────────────────────────── */

  // WorkforceTimesheet.tsx
  'src/pages/WorkforceTimesheet.tsx': [
    [/<Edit className="mr-2 h-4 w-4" \/> Editar/g, '<Edit className="mr-2 h-4 w-4" /> {t("common.edit")}'],
    [/<XCircle className="mr-2 h-4 w-4" \/> Eliminar/g, '<XCircle className="mr-2 h-4 w-4" /> {t("common.delete")}'],
    [/>No hay alertas esta semana</g, '>{t("timesheet.noAlerts")}'],
  ],

  // WorkforceTeam.tsx
  'src/pages/WorkforceTeam.tsx': [
    [/<Edit className="mr-2 h-4 w-4" \/> Editar/g, '<Edit className="mr-2 h-4 w-4" /> {t("common.edit")}'],
    [`label: 'Propietario'`, `label: t('roles.owner')`],
    [`label: 'Administrador'`, `label: t('roles.admin')`],
    [`label: 'Gerente Operaciones'`, `label: t('roles.opsManager')`],
    [`label: 'Gerente Local'`, `label: t('roles.storeManager')`],
    [`label: 'Encargado/a'`, `label: t('roles.manager')`],
    [`label: 'Camarero/a'`, `label: t('roles.waiter')`],
    [`label: 'Cocinero/a'`, `label: t('roles.cook')`],
    [`label: 'Barista'`, `label: t('roles.bartender')`],
    [`label: 'Hostess'`, `label: t('roles.host')`],
    [`label: 'Friegaplatos'`, `label: t('roles.dishwasher')`],
    [`label: 'Repartidor/a'`, `label: t('roles.delivery')`],
    [`label: 'Empleado'`, `label: t('roles.employee')`],
    [`label: 'Importante'`, `label: t('team.important')`],
    [`label: 'Celebración'`, `label: t('team.celebration')`],
    [`label: 'Horarios'`, `label: t('team.schedules')`],
    [`label: 'Info'`, `label: t('team.info')`],
  ],

  // WorkforceOnboarding.tsx
  'src/pages/WorkforceOnboarding.tsx': [
    [`label: 'Contrato de trabajo firmado'`, `label: t('onboarding.signedContract')`],
    [`label: 'Copia DNI / NIE'`, `label: t('onboarding.dniCopy')`],
    [`label: 'Número de Seguridad Social'`, `label: t('onboarding.ssNumber')`],
    [`label: 'Cuenta bancaria (IBAN)'`, `label: t('onboarding.bankAccount')`],
    [`label: 'Foto para ficha empleado'`, `label: t('onboarding.employeePhoto')`],
    [`label: 'Formación PRL recibida'`, `label: t('onboarding.prlTraining')`],
    [`label: 'Carné de manipulador de alimentos'`, `label: t('onboarding.foodHandler')`],
    [`label: 'Tour del establecimiento'`, `label: t('onboarding.facilityTour')`],
    [`label: 'Protocolo de alérgenos'`, `label: t('onboarding.allergenProtocol')`],
    [`label: 'Uniforme entregado'`, `label: t('onboarding.uniformDelivered')`],
    [`label: 'Acceso al sistema configurado'`, `label: t('onboarding.systemAccess')`],
    [`label: 'Turno de prueba completado'`, `label: t('onboarding.trialShift')`],
    [`label: 'Contratos'`, `label: t('onboarding.contracts')`],
    [`label: 'Certificados PRL'`, `label: t('onboarding.prlCertificates')`],
    [`label: 'DNI / NIE'`, `label: t('onboarding.dniNie')`],
    [`label: 'SS'`, `label: t('onboarding.ss')`],
  ],

  // Payroll.tsx
  'src/pages/Payroll.tsx': [
    [`label: 'Inicio'`, `label: t('payroll.home')`],
    [`label: 'Empleados'`, `label: t('payroll.employees')`],
    [`label: 'Variables'`, `label: t('payroll.variables')`],
    [`label: 'Validar'`, `label: t('payroll.validate')`],
    [`label: 'Calcular'`, `label: t('payroll.calculate')`],
    [`label: 'Revisar'`, `label: t('payroll.review')`],
    [`label: 'Presentar'`, `label: t('payroll.submit')`],
    [`label: 'Pagar'`, `label: t('payroll.pay')`],
  ],

  // ProcurementOrders.tsx
  'src/pages/ProcurementOrders.tsx': [
    [`>Total Value<`, `>{t("procurement.totalValue")}<`],
  ],

  // ProcurementCart.tsx
  'src/pages/ProcurementCart.tsx': [
    [`>Subtotal<`, `>{t("procurement.subtotal")}<`],
    [/Subtotal \(\{cartItems\.length\} items\)/g, `{t("procurement.subtotalItems", { count: cartItems.length })}`],
    [`>Total VAT (21%)<`, `>{t("procurement.totalVat")}<`],
  ],

  // MenuItemsPage.tsx
  'src/pages/inventory-setup/MenuItemsPage.tsx': [
    [`>Total platos<`, `>{t("menu.totalDishes")}<`],
    [`>Estado<`, `>{t("common.status")}<`],
    [`>Sin escandallo<`, `>{t("menu.noRecipe")}<`],
    [`>Sin ingredientes<`, `>{t("menu.noIngredients")}<`],
  ],

  // RecipeDetailPage.tsx
  'src/pages/inventory-setup/RecipeDetailPage.tsx': [
    [`>Editar escandallo<`, `>{t("recipes.editRecipe")}<`],
    [`>Nombre<`, `>{t("common.name")}<`],
    [`toast({ title: 'Guardado', description: 'Receta actualizada' })`, `toast({ title: t('common.saved'), description: t('recipes.recipeUpdated') })`],
    [`toast({ title: 'Añadido', description: 'Ingrediente añadido a la receta' })`, `toast({ title: t('common.added'), description: t('recipes.ingredientAdded') })`],
    [`toast({ title: 'Eliminado' })`, `toast({ title: t('common.deleted') })`],
    [`>Añadir Ingrediente<`, `>{t("recipes.addIngredient")}<`],
  ],

  // RecipesPage.tsx — handled manually (template literal replacement)

  // DataImport.tsx
  'src/pages/DataImport.tsx': [
    [`>Estado<`, `>{t("common.status")}<`],
    [`>No hay importaciones previas<`, `>{t("dataImport.noPreviousImports")}<`],
  ],

  // Dashboard.tsx
  'src/pages/Dashboard.tsx': [
    [`>No hay locales configurados<`, `>{t("dashboard.noLocations")}<`],
  ],

  // BookingWidget.tsx
  'src/pages/BookingWidget.tsx': [
    [`>Nombre *<`, `>{t("booking.guestName")} *<`],
    [`>Teléfono<`, `>{t("common.phone")}<`],
    [`>No hay horarios disponibles para esta fecha<`, `>{t("booking.noTimesAvailable")}<`],
  ],

  // StaffFloor.tsx
  'src/pages/StaffFloor.tsx': [
    [`>No hay mesas configuradas<`, `>{t("staff.noTablesConfigured")}<`],
  ],

  // ResetPassword.tsx
  'src/pages/ResetPassword.tsx': [
    [`>Confirmar contraseña<`, `>{t("auth.confirmPassword")}<`],
  ],

  // DataPrivacySection.tsx
  'src/pages/Settings/DataPrivacySection.tsx': [
    [`>Eliminar mi cuenta<`, `>{t("settings.deleteMyAccount")}<`],
    [`>Exportar mis datos<`, `>{t("settings.exportMyData")}<`],
    [`title: 'Datos exportados'`, `title: t('settings.dataExported')`],
    [`title: 'Error al exportar'`, `title: t('settings.exportError')`],
    [`title: 'Solicitud registrada'`, `title: t('settings.requestRegistered')`],
    [`title: 'Preferencias actualizadas'`, `title: t('settings.preferencesUpdated')`],
  ],

  // DataHealth.tsx
  'src/pages/DataHealth.tsx': [
    [`>Total conteos:<`, `>{t("dataHealth.totalCounts")}:<`],
  ],

  // OnboardingChecklist.tsx
  'src/pages/OnboardingChecklist.tsx': [
    [`title: 'Conectar tu POS'`, `title: t('onboardingChecklist.connectPOS')`],
    [`title: 'Crear tu equipo'`, `title: t('onboardingChecklist.createTeam')`],
    [`title: 'Crear primer horario'`, `title: t('onboardingChecklist.createSchedule')`],
    [`title: 'Configurar proveedores'`, `title: t('onboardingChecklist.configureSuppliers')`],
    [`title: 'Crear recetas con costes'`, `title: t('onboardingChecklist.createRecipes')`],
    [`title: 'Crear catálogo de inventario'`, `title: t('onboardingChecklist.createInventory')`],
    [`title: 'Establecer presupuestos'`, `title: t('onboardingChecklist.setBudgets')`],
  ],

  // SquareIntegration.tsx
  'src/pages/integrations/SquareIntegration.tsx': [
    [`>Estado de la conexión<`, `>{t("square.connectionStatus")}<`],
    [`label: 'Conectando con Square...'`, `label: t('square.connecting')`],
    [`label: 'Importando locales...'`, `label: t('square.importingLocations')`],
    [`label: 'Importando catálogo...'`, `label: t('square.importingCatalog')`],
  ],

  // InventoryReconciliation.tsx
  'src/pages/InventoryReconciliation.tsx': [
    [`label: 'Counts & Waste'`, `label: t('inventory.countsAndWaste')`],
    [`label: 'Counts'`, `label: t('inventory.counts')`],
    [`label: 'Reconciliation report'`, `label: t('inventory.reconciliationReport')`],
  ],

  // InventoryLocation.tsx + Inventory.tsx
  'src/pages/InventoryLocation.tsx': [
    [`label: 'Insights'`, `label: t('inventory.insights')`],
    [`label: 'Inventory'`, `label: t('inventory.inventory')`],
  ],
  'src/pages/Inventory.tsx': [
    [`label: 'Insights'`, `label: t('inventory.insights')`],
    [`label: 'Inventory'`, `label: t('inventory.inventory')`],
  ],

  // team pages
  'src/pages/team/TeamPay.tsx': [
    [`>Sin fichajes este mes<`, `>{t("team.noClockInsThisMonth")}<`],
    [`>Sin turnos planificados<`, `>{t("team.noShiftsPlanned")}<`],
  ],
  'src/pages/team/TeamHome.tsx': [
    [`>Sin turno programado<`, `>{t("team.noShiftScheduled")}<`],
  ],

  /* ── COMPONENTS ────────────────────────────────────── */

  // StaffLayout + TeamLayout
  'src/components/staff/StaffLayout.tsx': [
    [`>Cerrar sesión<`, `>{t("common.logout")}<`],
  ],
  'src/components/team/TeamLayout.tsx': [
    [`>Cerrar sesión<`, `>{t("common.logout")}<`],
  ],

  // EmployeeReviews.tsx
  'src/components/workforce/EmployeeReviews.tsx': [
    [`>Sin empleados en este local<`, `>{t("reviews.noEmployees")}<`],
    [`>Sin evaluar<`, `>{t("reviews.notEvaluated")}<`],
  ],

  // TrainingTracker.tsx
  'src/components/workforce/TrainingTracker.tsx': [
    [`>Sin caducidad<`, `>{t("training.noExpiry")}<`],
    [`>Sin certificados registrados<`, `>{t("training.noCertificates")}<`],
  ],

  // EmploymentContracts.tsx
  'src/components/workforce/EmploymentContracts.tsx': [
    [`>Estado<`, `>{t("common.status")}<`],
    [`>No hay contratos registrados<`, `>{t("contracts.noContracts")}<`],
  ],

  // EmptyLocationsState.tsx
  'src/components/ui/EmptyLocationsState.tsx': [
    [`>Sin locales accesibles<`, `>{t("common.noAccessibleLocations")}<`],
  ],

  // NotificationCenter (ui)
  'src/components/ui/NotificationCenter.tsx': [
    [`>Sin notificaciones<`, `>{t("common.noNotifications")}<`],
  ],

  // NotificationCenter (notifications)
  'src/components/notifications/NotificationCenter.tsx': [
    [`>No hay notificaciones<`, `>{t("common.noNotifications")}<`],
  ],

  // OfflineBanner.tsx
  'src/components/OfflineBanner.tsx': [
    [`>Sin conexión — los datos pueden no estar actualizados<`, `>{t("common.offlineBanner")}<`],
  ],

  // HourlyDrillDownDrawer.tsx
  'src/components/sales/HourlyDrillDownDrawer.tsx': [
    [`>Total Sales<`, `>{t("sales.totalSales")}<`],
    [`>Total Orders<`, `>{t("sales.totalOrders")}<`],
  ],

  // MenuEngineeringTable.tsx
  'src/components/menu-engineering/MenuEngineeringTable.tsx': [
    [`>Total Profit<`, `>{t("menuEngineering.totalProfit")}<`],
  ],

  // PaymentHistoryManager.tsx
  'src/components/settings/PaymentHistoryManager.tsx': [
    [`>Total Transacciones<`, `>{t("payments.totalTransactions")}<`],
    [`>Total Propinas<`, `>{t("payments.totalTips")}<`],
  ],

  // SupplierIntegrationManager.tsx
  'src/components/settings/SupplierIntegrationManager.tsx': [
    [`>Estado<`, `>{t("common.status")}<`],
    [`>Teléfono de contacto<`, `>{t("common.contactPhone")}<`],
    [`>No hay proveedores configurados<`, `>{t("suppliers.noSuppliers")}<`],
    [`toast({ title: 'Guardado', description:`, `toast({ title: t('common.saved'), description:`],
    [`title: 'Conexión exitosa'`, `title: t('suppliers.connectionSuccess')`],
  ],

  // TeamManagersTab.tsx
  'src/components/settings/TeamManagersTab.tsx': [
    [`>Nombre<`, `>{t("common.name")}<`],
    [`>Apellido<`, `>{t("common.lastName")}<`],
    [`> Enviar invitación<`, `> {t("team.sendInvitation")}<`],
    [`>Sin acceso<`, `>{t("team.noAccess")}<`],
  ],

  // UsersRolesManager.tsx
  'src/components/settings/UsersRolesManager.tsx': [
    [`>Editar Roles de Usuario<`, `>{t("users.editRoles")}<`],
    [`>Añadir Nuevo Rol<`, `>{t("users.addNewRole")}<`],
    [`>Sin roles<`, `>{t("users.noRoles")}<`],
    [`>Sin roles asignados<`, `>{t("users.noRolesAssigned")}<`],
    [`title: 'Rol asignado'`, `title: t('users.roleAssigned')`],
    [`title: 'Rol eliminado'`, `title: t('users.roleRemoved')`],
  ],

  // TeamManager.tsx
  'src/components/settings/TeamManager.tsx': [
    [`>Estado<`, `>{t("common.status")}<`],
    [`>Nombre Completo *<`, `>{t("common.fullName")} *<`],
    [`>Sin miembros del equipo<`, `>{t("team.noTeamMembers")}<`],
    [`>Sin rol<`, `>{t("team.noRole")}<`],
    [`title: 'Error al invitar'`, `title: t('team.inviteError')`],
  ],

  // LocationWizard.tsx
  'src/components/settings/LocationWizard.tsx': [
    [`>Nombre del Local *<`, `>{t("location.locationName")} *<`],
    [`>Ciudad<`, `>{t("common.city")}<`],
    [`>Añadir producto personalizado<`, `>{t("location.addCustomProduct")}<`],
    [`>Añadir mesa<`, `>{t("location.addTable")}<`],
    [`>Añadir rápido de sugeridos:<`, `>{t("location.quickAddSuggested")}:<`],
    [`>Configurar después<`, `>{t("location.configureLater")}<`],
  ],

  // LocationManager.tsx
  'src/components/settings/LocationManager.tsx': [
    [`>Nombre del Local *<`, `>{t("location.locationName")} *<`],
    [`>Ciudad<`, `>{t("common.city")}<`],
    [`>Nombre del nuevo local *<`, `>{t("location.newLocationName")} *<`],
    [`>Nombre<`, `>{t("common.name")}<`],
    [`>No hay locales configurados<`, `>{t("dashboard.noLocations")}<`],
    [`>Estado actual:<`, `>{t("common.currentStatus")}:<`],
  ],

  // LoyaltyManager.tsx
  'src/components/settings/LoyaltyManager.tsx': [
    [`>Activo<`, `>{t("common.active")}<`],
    [`>Nombre *<`, `>{t("common.name")} *<`],
    [`>Teléfono<`, `>{t("common.phone")}<`],
    [`toast({ title: 'Configuración guardada' })`, `toast({ title: t('common.configSaved') })`],
    [`toast({ title: 'Completa nombre y email o teléfono', variant: 'destructive' })`, `toast({ title: t('loyalty.completeNameAndContact'), variant: 'destructive' })`],
    [`toast({ title: 'Miembro actualizado' })`, `toast({ title: t('loyalty.memberUpdated') })`],
    [`toast({ title: 'Miembro creado',`, `toast({ title: t('loyalty.memberCreated'),`],
    [`toast({ title: 'Completa nombre y coste en puntos', variant: 'destructive' })`, `toast({ title: t('loyalty.completeNameAndCost'), variant: 'destructive' })`],
    [`toast({ title: 'Recompensa actualizada' })`, `toast({ title: t('loyalty.rewardUpdated') })`],
    [`toast({ title: 'Recompensa creada' })`, `toast({ title: t('loyalty.rewardCreated') })`],
  ],

  // EventCalendarManager.tsx
  'src/components/settings/EventCalendarManager.tsx': [
    [`>Sin eventos próximos<`, `>{t("events.noUpcomingEvents")}<`],
  ],

  // ObjectivesTab.tsx
  'src/components/settings/ObjectivesTab.tsx': [
    [`toast({ title: "Guardado", description: "Objetivos actualizados" })`, `toast({ title: t('common.saved'), description: t('objectives.objectivesUpdated') })`],
  ],

  // PaymentMethodsTab.tsx
  'src/components/settings/PaymentMethodsTab.tsx': [
    [`toast({ title: "Payment method added"`, `toast({ title: t('payments.methodAdded')`],
    [`toast({ title: "Default updated", description: "Payment method set as default" })`, `toast({ title: t('payments.defaultUpdated'), description: t('payments.setAsDefault') })`],
    [`toast({ title: "Deleted", description: "Payment method removed" })`, `toast({ title: t('common.deleted'), description: t('payments.methodRemoved') })`],
  ],

  // ExportTab.tsx
  'src/components/settings/ExportTab.tsx': [
    [`toast({ title: "Exportado"`, `toast({ title: t('common.exported')`],
  ],

  // DataSourceSettings.tsx
  'src/components/settings/DataSourceSettings.tsx': [
    [`>Estado actual:<`, `>{t("common.currentStatus")}:<`],
    [`title: 'Guardado'`, `title: t('common.saved')`],
  ],

  // BookingSettingsManager.tsx
  'src/components/settings/BookingSettingsManager.tsx': [
    [`title: 'Guardado'`, `title: t('common.saved')`],
    [`toast({ title: 'Copiado al portapapeles' })`, `toast({ title: t('common.copiedToClipboard') })`],
    [`toast({ title: 'Error al copiar', variant: 'destructive' })`, `toast({ title: t('common.copyError'), variant: 'destructive' })`],
  ],

  // DemoDataManager.tsx
  'src/components/settings/DemoDataManager.tsx': [
    [`title: "Datos demo regenerados"`, `title: t('settings.demoDataRegenerated')`],
  ],

  // BillingTab.tsx
  'src/components/settings/BillingTab.tsx': [
    [`>Descargar facturas anteriores<`, `>{t("billing.downloadPreviousInvoices")}<`],
  ],

  // CreateScheduleModal.tsx
  'src/components/scheduling/CreateScheduleModal.tsx': [
    [`title: 'Analizando pronóstico de ventas y SPLH histórico'`, `title: t('scheduling.analyzingForecast')`],
    [`title: 'Calculando niveles de dotación óptimos por estación'`, `title: t('scheduling.calculatingStaffing')`],
    [`title: 'Verificando restricciones de disponibilidad y contratos'`, `title: t('scheduling.verifyingConstraints')`],
  ],

  // OrderHistoryPanel.tsx
  'src/components/procurement/OrderHistoryPanel.tsx': [
    [`title: 'Items added to cart'`, `title: t('procurement.itemsAddedToCart')`],
    [`title: 'Reorder'`, `title: t('procurement.reorder')`],
    [`title: 'Entrega recibida'`, `title: t('procurement.deliveryReceived')`],
  ],

  // PayrollReview.tsx
  'src/components/payroll/PayrollReview.tsx': [
    [`toast({ title: 'Nóminas aprobadas', description: 'Puedes proceder a la presentación' })`, `toast({ title: t('payroll.payrollApproved'), description: t('payroll.proceedToSubmission') })`],
  ],

  // PayrollSubmit.tsx
  'src/components/payroll/PayrollSubmit.tsx': [
    [`>Sin presentar<`, `>{t("payroll.notSubmitted")}<`],
    [`toast({ title: 'Todas las presentaciones completadas', description: 'Puedes proceder al pago.' })`, `toast({ title: t('payroll.allSubmissionsComplete'), description: t('payroll.proceedToPayment') })`],
  ],

  // PayrollEmployees.tsx
  'src/components/payroll/PayrollEmployees.tsx': [
    [`>Sin contrato<`, `>{t("payroll.noContract")}<`],
  ],

  // PayrollHome.tsx
  'src/components/payroll/PayrollHome.tsx': [
    [`>Configurar Certificado Digital<`, `>{t("payroll.configureCertificate")}<`],
  ],

  // OnboardingWizard.tsx
  'src/components/onboarding/OnboardingWizard.tsx': [
    [`title: 'Tu Negocio', description: 'Nombre de tu empresa'`, `title: t('onboarding.yourBusiness'), description: t('onboarding.companyName')`],
    [`title: 'Tu Local', description: 'Primer establecimiento'`, `title: t('onboarding.yourLocation'), description: t('onboarding.firstLocation')`],
    [`title: 'Tu Carta', description: 'Productos y precios'`, `title: t('onboarding.yourMenu'), description: t('onboarding.productsAndPrices')`],
    [`>No hay inventario predefinido para esta plantilla<`, `>{t("onboarding.noPresetInventory")}<`],
  ],

  // POSOpenTables.tsx
  'src/components/pos/POSOpenTables.tsx': [
    [`>No hay mesas abiertas<`, `>{t("pos.noOpenTables")}<`],
  ],

  // Labour
  'src/components/labour/StaffingHeatmap.tsx': [
    [`>No hay datos suficientes (últimas 4 semanas)<`, `>{t("labour.insufficientData")}<`],
  ],
  'src/components/labour/PayrollForecast.tsx': [
    [`>No hay datos de turnos<`, `>{t("labour.noShiftData")}<`],
  ],

  // AutoPurchaseOrder.tsx
  'src/components/inventory/AutoPurchaseOrder.tsx': [
    [`>No hay items por debajo del nivel mínimo<`, `>{t("inventory.noItemsBelowMinimum")}<`],
  ],

  // AppSidebar.tsx
  'src/components/layout/AppSidebar.tsx': [
    [`>Importar Datos<`, `>{t("sidebar.importData")}<`],
  ],
};

/* ── locale keys ────────────────────────────────────────── */
const newKeys = {
  // common
  "common.edit": "Editar",
  "common.delete": "Eliminar",
  "common.logout": "Cerrar sesión",
  "common.status": "Estado",
  "common.name": "Nombre",
  "common.lastName": "Apellido",
  "common.phone": "Teléfono",
  "common.city": "Ciudad",
  "common.active": "Activo",
  "common.fullName": "Nombre Completo",
  "common.currentStatus": "Estado actual",
  "common.saved": "Guardado",
  "common.created": "Creado",
  "common.deleted": "Eliminado",
  "common.added": "Añadido",
  "common.exported": "Exportado",
  "common.copiedToClipboard": "Copiado al portapapeles",
  "common.copyError": "Error al copiar",
  "common.configSaved": "Configuración guardada",
  "common.noAccessibleLocations": "Sin locales accesibles",
  "common.noNotifications": "Sin notificaciones",
  "common.offlineBanner": "Sin conexión — los datos pueden no estar actualizados",
  "common.contactPhone": "Teléfono de contacto",

  // roles
  "roles.owner": "Propietario",
  "roles.admin": "Administrador",
  "roles.opsManager": "Gerente Operaciones",
  "roles.storeManager": "Gerente Local",
  "roles.manager": "Encargado/a",
  "roles.waiter": "Camarero/a",
  "roles.cook": "Cocinero/a",
  "roles.bartender": "Barista",
  "roles.host": "Hostess",
  "roles.dishwasher": "Friegaplatos",
  "roles.delivery": "Repartidor/a",
  "roles.employee": "Empleado",

  // team
  "team.important": "Importante",
  "team.celebration": "Celebración",
  "team.schedules": "Horarios",
  "team.info": "Info",
  "team.sendInvitation": "Enviar invitación",
  "team.noAccess": "Sin acceso",
  "team.noTeamMembers": "Sin miembros del equipo",
  "team.noRole": "Sin rol",
  "team.inviteError": "Error al invitar",
  "team.noClockInsThisMonth": "Sin fichajes este mes",
  "team.noShiftsPlanned": "Sin turnos planificados",
  "team.noShiftScheduled": "Sin turno programado",

  // timesheet
  "timesheet.noAlerts": "No hay alertas esta semana",

  // onboarding
  "onboarding.signedContract": "Contrato de trabajo firmado",
  "onboarding.dniCopy": "Copia DNI / NIE",
  "onboarding.ssNumber": "Número de Seguridad Social",
  "onboarding.bankAccount": "Cuenta bancaria (IBAN)",
  "onboarding.employeePhoto": "Foto para ficha empleado",
  "onboarding.prlTraining": "Formación PRL recibida",
  "onboarding.foodHandler": "Carné de manipulador de alimentos",
  "onboarding.facilityTour": "Tour del establecimiento",
  "onboarding.allergenProtocol": "Protocolo de alérgenos",
  "onboarding.uniformDelivered": "Uniforme entregado",
  "onboarding.systemAccess": "Acceso al sistema configurado",
  "onboarding.trialShift": "Turno de prueba completado",
  "onboarding.contracts": "Contratos",
  "onboarding.prlCertificates": "Certificados PRL",
  "onboarding.dniNie": "DNI / NIE",
  "onboarding.ss": "SS",
  "onboarding.yourBusiness": "Tu Negocio",
  "onboarding.companyName": "Nombre de tu empresa",
  "onboarding.yourLocation": "Tu Local",
  "onboarding.firstLocation": "Primer establecimiento",
  "onboarding.yourMenu": "Tu Carta",
  "onboarding.productsAndPrices": "Productos y precios",
  "onboarding.noPresetInventory": "No hay inventario predefinido para esta plantilla",

  // onboardingChecklist
  "onboardingChecklist.connectPOS": "Conectar tu POS",
  "onboardingChecklist.createTeam": "Crear tu equipo",
  "onboardingChecklist.createSchedule": "Crear primer horario",
  "onboardingChecklist.configureSuppliers": "Configurar proveedores",
  "onboardingChecklist.createRecipes": "Crear recetas con costes",
  "onboardingChecklist.createInventory": "Crear catálogo de inventario",
  "onboardingChecklist.setBudgets": "Establecer presupuestos",

  // payroll
  "payroll.home": "Inicio",
  "payroll.employees": "Empleados",
  "payroll.variables": "Variables",
  "payroll.validate": "Validar",
  "payroll.calculate": "Calcular",
  "payroll.review": "Revisar",
  "payroll.submit": "Presentar",
  "payroll.pay": "Pagar",
  "payroll.notSubmitted": "Sin presentar",
  "payroll.noContract": "Sin contrato",
  "payroll.configureCertificate": "Configurar Certificado Digital",
  "payroll.payrollApproved": "Nóminas aprobadas",
  "payroll.proceedToSubmission": "Puedes proceder a la presentación",
  "payroll.allSubmissionsComplete": "Todas las presentaciones completadas",
  "payroll.proceedToPayment": "Puedes proceder al pago.",

  // procurement
  "procurement.totalValue": "Total Value",
  "procurement.subtotal": "Subtotal",
  "procurement.subtotalItems": "Subtotal ({{count}} items)",
  "procurement.totalVat": "Total VAT (21%)",
  "procurement.itemsAddedToCart": "Items added to cart",
  "procurement.reorder": "Reorder",
  "procurement.deliveryReceived": "Entrega recibida",

  // menu
  "menu.totalDishes": "Total platos",
  "menu.noRecipe": "Sin escandallo",
  "menu.noIngredients": "Sin ingredientes",

  // recipes
  "recipes.editRecipe": "Editar escandallo",
  "recipes.recipeUpdated": "Receta actualizada",
  "recipes.ingredientAdded": "Ingrediente añadido a la receta",
  "recipes.addIngredient": "Añadir Ingrediente",
  "recipes.recipePrefix": "Receta",

  // booking
  "booking.guestName": "Nombre",
  "booking.noTimesAvailable": "No hay horarios disponibles para esta fecha",

  // staff
  "staff.noTablesConfigured": "No hay mesas configuradas",

  // auth
  "auth.confirmPassword": "Confirmar contraseña",

  // settings
  "settings.deleteMyAccount": "Eliminar mi cuenta",
  "settings.exportMyData": "Exportar mis datos",
  "settings.dataExported": "Datos exportados",
  "settings.exportError": "Error al exportar",
  "settings.requestRegistered": "Solicitud registrada",
  "settings.preferencesUpdated": "Preferencias actualizadas",
  "settings.demoDataRegenerated": "Datos demo regenerados",

  // dataImport
  "dataImport.noPreviousImports": "No hay importaciones previas",

  // dashboard
  "dashboard.noLocations": "No hay locales configurados",

  // dataHealth
  "dataHealth.totalCounts": "Total conteos",

  // square
  "square.connectionStatus": "Estado de la conexión",
  "square.connecting": "Conectando con Square...",
  "square.importingLocations": "Importando locales...",
  "square.importingCatalog": "Importando catálogo...",

  // inventory
  "inventory.countsAndWaste": "Counts & Waste",
  "inventory.counts": "Counts",
  "inventory.reconciliationReport": "Reconciliation report",
  "inventory.insights": "Insights",
  "inventory.inventory": "Inventory",
  "inventory.noItemsBelowMinimum": "No hay items por debajo del nivel mínimo",

  // reviews
  "reviews.noEmployees": "Sin empleados en este local",
  "reviews.notEvaluated": "Sin evaluar",

  // training
  "training.noExpiry": "Sin caducidad",
  "training.noCertificates": "Sin certificados registrados",

  // contracts
  "contracts.noContracts": "No hay contratos registrados",

  // location
  "location.locationName": "Nombre del Local",
  "location.newLocationName": "Nombre del nuevo local",
  "location.addCustomProduct": "Añadir producto personalizado",
  "location.addTable": "Añadir mesa",
  "location.quickAddSuggested": "Añadir rápido de sugeridos",
  "location.configureLater": "Configurar después",

  // sales
  "sales.totalSales": "Total Sales",
  "sales.totalOrders": "Total Orders",

  // menuEngineering
  "menuEngineering.totalProfit": "Total Profit",

  // payments
  "payments.totalTransactions": "Total Transacciones",
  "payments.totalTips": "Total Propinas",
  "payments.methodAdded": "Payment method added",
  "payments.defaultUpdated": "Default updated",
  "payments.setAsDefault": "Payment method set as default",
  "payments.methodRemoved": "Payment method removed",

  // suppliers
  "suppliers.noSuppliers": "No hay proveedores configurados",
  "suppliers.connectionSuccess": "Conexión exitosa",

  // users
  "users.editRoles": "Editar Roles de Usuario",
  "users.addNewRole": "Añadir Nuevo Rol",
  "users.noRoles": "Sin roles",
  "users.noRolesAssigned": "Sin roles asignados",
  "users.roleAssigned": "Rol asignado",
  "users.roleRemoved": "Rol eliminado",

  // loyalty
  "loyalty.completeNameAndContact": "Completa nombre y email o teléfono",
  "loyalty.memberUpdated": "Miembro actualizado",
  "loyalty.memberCreated": "Miembro creado",
  "loyalty.completeNameAndCost": "Completa nombre y coste en puntos",
  "loyalty.rewardUpdated": "Recompensa actualizada",
  "loyalty.rewardCreated": "Recompensa creada",

  // objectives
  "objectives.objectivesUpdated": "Objetivos actualizados",

  // events
  "events.noUpcomingEvents": "Sin eventos próximos",

  // billing
  "billing.downloadPreviousInvoices": "Descargar facturas anteriores",

  // scheduling
  "scheduling.analyzingForecast": "Analizando pronóstico de ventas y SPLH histórico",
  "scheduling.calculatingStaffing": "Calculando niveles de dotación óptimos por estación",
  "scheduling.verifyingConstraints": "Verificando restricciones de disponibilidad y contratos",

  // pos
  "pos.noOpenTables": "No hay mesas abiertas",

  // labour
  "labour.insufficientData": "No hay datos suficientes (últimas 4 semanas)",
  "labour.noShiftData": "No hay datos de turnos",

  // sidebar
  "sidebar.importData": "Importar Datos",
};

/* ── ensure useTranslation import + hook ───────────────────────── */
function ensureI18n(src) {
  if (!src.includes('useTranslation')) {
    src = `import { useTranslation } from 'react-i18next';\n` + src;
  }
  // add hook if missing
  if (!src.includes('const { t }') && !src.includes('const {t}')) {
    src = src.replace(
      /(export\s+(default\s+)?function\s+\w+\s*\([^)]*\)\s*\{)/,
      '$1\n  const { t } = useTranslation();'
    );
  }
  return src;
}

/* ── apply ──────────────────────────────────────────────────────── */
let totalReplaced = 0;
let filesProcessed = 0;

for (const [relPath, reps] of Object.entries(replacements)) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) { console.warn(`SKIP (not found): ${relPath}`); continue; }
  let src = readFileSync(abs, 'utf8');
  let changed = false;

  for (const rep of reps) {
    const [from, to] = Array.isArray(rep) ? rep : [rep, null];
    if (!to && to !== '') continue;

    if (from instanceof RegExp) {
      const matches = src.match(from);
      if (matches) {
        src = src.replace(from, to);
        totalReplaced += matches.length;
        changed = true;
      }
    } else {
      if (src.includes(from)) {
        src = src.replaceAll(from, to);
        totalReplaced++;
        changed = true;
      }
    }
  }

  if (changed) {
    src = ensureI18n(src);
    writeFileSync(abs, src);
    filesProcessed++;
    console.log(`✓ ${relPath}`);
  }
}

/* ── patch es.json ─────────────────────────────────────────────── */
const localePath = resolve(ROOT, 'src/i18n/locales/es.json');
const locale = JSON.parse(readFileSync(localePath, 'utf8'));

let keysAdded = 0;
for (const [dotKey, value] of Object.entries(newKeys)) {
  const parts = dotKey.split('.');
  let obj = locale;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]]) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  if (!obj[parts.at(-1)]) {
    obj[parts.at(-1)] = value;
    keysAdded++;
  }
}
writeFileSync(localePath, JSON.stringify(locale, null, 2) + '\n');

console.log(`\n✅ Batch 4 complete: ${totalReplaced} replacements across ${filesProcessed} files, ${keysAdded} locale keys added`);
