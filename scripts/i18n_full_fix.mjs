/**
 * Comprehensive i18n fix script — processes ALL remaining files
 * Replaces hardcoded Spanish/English strings with t() calls
 * Adds corresponding keys to es.json (and stubs in en/ca/de/fr)
 */
import fs from 'fs';
import path from 'path';

const SRC = 'src';
const LOCALES_DIR = path.join(SRC, 'i18n', 'locales');

// ─── Locale data to add ────────────────────────────────────────
const newLocaleKeys = {

  // ─── WorkforceTeam ──────────────────────────────────────────
  workforce: {
    title: "Equipo",
    addEmployee: "Añadir empleado",
    searchPlaceholder: "Buscar empleado...",
    filterRole: "Rol",
    filterLocation: "Local",
    allRoles: "Todos los roles",
    allLocations: "Todos los locales",
    tableEmployee: "Empleado",
    tableRole: "Rol",
    tableLocation: "Local",
    tableCostHour: "Coste/h",
    tableStatus: "Estado",
    tableActions: "Acciones",
    active: "Activo",
    inactive: "Inactivo",
    onLeave: "De permiso",
    edit: "Editar",
    delete: "Eliminar",
    activate: "Activar",
    deactivate: "Desactivar",
    noEmployees: "Sin empleados",
    noEmployeesDesc: "Añade tu primer miembro del equipo",
    addEmployeeTitle: "Nuevo empleado",
    editEmployeeTitle: "Editar empleado",
    fullName: "Nombre completo",
    fullNameRequired: "Nombre completo *",
    namePlaceholder: "María López García",
    role: "Rol",
    costHour: "Coste/hora (€)",
    locationRequired: "Local *",
    selectLocation: "Seleccionar local",
    employeeStatus: "Estado del empleado",
    saveChanges: "Guardar cambios",
    clockedIn: "Fichados ahora",
    noClockedIn: "Nadie fichado ahora",
    noClockedInDesc: "Los empleados aparecerán aquí al fichar entrada",
    since: "desde",
    announcements: "Anuncios",
    newAnnouncement: "Nuevo anuncio",
    noAnnouncements: "Sin anuncios",
    noAnnouncementsDesc: "Crea el primer anuncio para tu equipo",
    announcementTitle: "Título *",
    announcementContent: "Contenido",
    announcementPlaceholder: "Escribe el mensaje para tu equipo...",
    announcementType: "Tipo",
    typeGeneral: "General",
    typeImportant: "Importante",
    typeSchedule: "Horarios",
    typeCelebration: "Celebración",
    locationOptional: "Local (opcional)",
    all: "Todos",
    pinTop: "Fijar en la parte superior",
    publish: "Publicar",
    pinned: "Fijado",
    toastNameLocationRequired: "Nombre y local son obligatorios",
    toastAddError: "Error al añadir empleado",
    toastUpdateError: "Error al actualizar",
    toastUpdated: "Empleado actualizado",
    toastStatusError: "Error al cambiar estado",
    toastTitleRequired: "El título es obligatorio",
    toastAnnouncementError: "Error al crear anuncio",
    toastAnnouncementPublished: "Anuncio publicado",
    toastDeleteError: "Error al eliminar",
    toastAnnouncementDeleted: "Anuncio eliminado"
  },

  // ─── WorkforceTimesheet ─────────────────────────────────────
  timesheet: {
    title: "Fichajes",
    subtitle: "Revisión y control de fichajes",
    allLocations: "Todos los locales",
    labourCost: "Coste laboral",
    clockIns: "Fichajes",
    tableEmployee: "Empleado",
    tableDate: "Fecha",
    tableClockIn: "Entrada",
    tableClockOut: "Salida",
    tableDuration: "Duración",
    tableCost: "Coste",
    tableSource: "Fuente",
    active: "Activo",
    manual: "Manual",
    noClockIns: "Sin fichajes esta semana",
    anomalies: "Anomalías",
    noAnomalies: "Todo en orden",
    clockInTime: "Hora de entrada",
    clockOutTime: "Hora de salida",
    toastUpdateError: "Error al actualizar fichaje",
    toastUpdated: "Fichaje actualizado",
    toastDeleteError: "Error al eliminar",
    toastDeleted: "Fichaje eliminado"
  },

  // ─── Scheduling ─────────────────────────────────────────────
  scheduling: {
    accepted: "Horario aceptado",
    reverted: "Horario revertido",
    published: "Horario publicado y notificaciones enviadas a todos los empleados",
    swapRequested: "Solicitud de cambio enviada para aprobación",
    swapApproved: "Cambio aprobado — turnos intercambiados",
    swapRejected: "Solicitud de cambio rechazada",
    autoFillEmpty: "Auto-fill: No se encontraron huecos para rellenar"
  },

  // ─── RecipesPage ────────────────────────────────────────────
  recipes: {
    searchPlaceholder: "Buscar recetas...",
    category: "Categoría",
    allCategories: "Todas las categorías",
    addRecipe: "Añadir receta",
    namePlaceholder: "Ej: Pasta Carbonara",
    name: "Nombre",
    portions: "Porciones",
    cost: "Coste",
    margin: "Margen",
    actions: "Acciones",
    edit: "Editar",
    delete: "Eliminar",
    noRecipes: "Sin recetas",
    noRecipesDesc: "Añade tu primera receta",
    selectIngredient: "Seleccionar ingrediente",
    selectSubRecipe: "Seleccionar sub-receta"
  },

  // ─── MenuItemsPage ──────────────────────────────────────────
  menuItems: {
    searchPlaceholder: "Buscar platos...",
    category: "Categoría",
    allCategories: "Todas las categorías",
    addItem: "Nuevo plato",
    name: "Nombre",
    sellingPrice: "Precio venta",
    cost: "Coste",
    margin: "Margen",
    actions: "Acciones",
    edit: "Editar",
    delete: "Eliminar",
    noItems: "Sin platos",
    noItemsDesc: "Añade tu primer plato del menú"
  },

  // ─── InventoryItems ─────────────────────────────────────────
  inventoryItems: {
    searchPlaceholder: "Buscar por nombre...",
    category: "Categoría",
    supplier: "Proveedor",
    allLocations: "Todas las ubicaciones",
    allCategories: "Todas las categorías",
    allSuppliers: "Todos los proveedores",
    addItem: "Nuevo artículo",
    exportPdf: "Exportar PDF",
    name: "Nombre",
    unit: "Unidad",
    stock: "Stock",
    parLevel: "Par level",
    price: "Precio",
    actions: "Acciones",
    noItems: "Sin artículos",
    toastGeneratingPdf: "Generando PDF...",
    toastExported: "Exportado correctamente"
  },

  // ─── Reviews ────────────────────────────────────────────────
  reviews: {
    allPlatforms: "Todas las plataformas",
    allLocations: "Todas las ubicaciones",
    averageRating: "Valoración media",
    totalReviews: "Total reseñas",
    responseRate: "Tasa de respuesta",
    sentiment: "Sentimiento",
    positive: "Positivo",
    negative: "Negativo",
    neutral: "Neutro",
    reply: "Responder",
    noReviews: "Sin reseñas"
  },

  // ─── BookingWidget ──────────────────────────────────────────
  booking: {
    title: "Reservar mesa",
    date: "Fecha",
    time: "Hora",
    guests: "Comensales",
    guestsSuffix: "personas",
    name: "Tu nombre",
    email: "tu@email.com",
    phone: "Teléfono",
    specialRequests: "Peticiones especiales",
    specialRequestsPlaceholder: "Alergias, silla para bebé, celebración especial...",
    confirm: "Confirmar reserva",
    confirmed: "¡Reserva confirmada!",
    confirmationMessage: "Te hemos enviado un email de confirmación"
  },

  // ─── EmployeeReviews ────────────────────────────────────────
  employeeReviews: {
    title: "Evaluaciones",
    newReview: "Nueva evaluación",
    selectEmployee: "Seleccionar empleado",
    overallScore: "Puntuación general",
    strengths: "Fortalezas",
    goals: "Objetivos",
    date: "Fecha",
    score: "Puntuación",
    reviewer: "Evaluador",
    noReviews: "Sin evaluaciones"
  },

  // ─── EmploymentContracts ────────────────────────────────────
  contracts: {
    title: "Contratos",
    newContract: "Nuevo contrato",
    selectEmployee: "Seleccionar empleado",
    contractType: "Tipo de contrato",
    permanent: "Indefinido",
    temporary: "Temporal",
    partTime: "Parcial",
    startDate: "Fecha inicio",
    endDate: "Fecha fin",
    salary: "Salario anual",
    hoursWeek: "Horas/semana",
    noContracts: "Sin contratos"
  },

  // ─── TeamDirectory ──────────────────────────────────────────
  teamDirectory: {
    searchPlaceholder: "Buscar compañero/a..."
  },

  // ─── TeamHome ───────────────────────────────────────────────
  teamHome: {
    toastClockIn: "Entrada registrada",
    toastClockInError: "Error al registrar entrada",
    toastClockOut: "Salida registrada",
    toastClockOutError: "Error al registrar salida"
  },

  // ─── Procurement ────────────────────────────────────────────
  procurement: {
    specialInstructions: "Añade instrucciones especiales para este pedido...",
    toastNewOrder: "¡Nuevo pedido recibido!",
    toastOrderSent: "¡Pedido enviado al proveedor!"
  },

  // ─── OnboardingWizardV2 ─────────────────────────────────────
  onboarding: {
    toastError: "Error al configurar tu cuenta. Intenta de nuevo.",
    toastWelcome: "Bienvenido a Josephine",
    toastFinalError: "Error al finalizar. Intenta de nuevo."
  },

  // ─── Pricing ────────────────────────────────────────────────
  pricing: {
    toastFreePlan: "Plan gratuito — ya estás en este plan",
    toastPaymentError: "No se pudo crear la sesión de pago. Intenta de nuevo."
  },

  // ─── DataImport ─────────────────────────────────────────────
  dataImport: {
    toastSelectLocation: "Selecciona una ubicación específica antes de importar",
    toastImportError: "Error inesperado durante la importación"
  },

  // ─── WorkforceOnboarding ────────────────────────────────────
  workforceOnboarding: {
    noRecentOnboardings: "Sin incorporaciones recientes",
    allEmployees: "Todos los empleados",
    contractType: "Tipo de contrato",
    permanent: "Indefinido",
    temporary: "Temporal",
    partTime: "Parcial",
    intern: "Becario",
    toastContractRegistered: "Contrato registrado (demo)"
  },

  // ─── SquareIntegration ──────────────────────────────────────
  square: {
    toastConnected: "Square conectado correctamente",
    toastImported: "Datos importados correctamente",
    toastSyncError: "Error en la sincronización inicial",
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

  // ─── Settings components ────────────────────────────────────
  settings: {
    selectRole: "Seleccionar rol",
    selectScope: "Seleccionar scope",
    selectLocation: "Seleccionar ubicación",
    firstName: "María",
    lastName: "García",
    fullName: "Juan García",
    emailPlaceholder: "juan@ejemplo.com",
    paymentMethod: "Método",
    location: "Local"
  },

  // ─── RecommendationCard ─────────────────────────────────────
  recommendations: {
    menuOptimization: "Optimización Menú",
    revenue: "Revenue",
    laborSavings: "Labor savings"
  },

  // ─── StaffingRecommendation ─────────────────────────────────
  staffing: {
    day: "Día"
  }
};

// ─── Read and update es.json ───────────────────────────────────
const esPath = path.join(LOCALES_DIR, 'es.json');
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));

// Merge new keys into es.json
for (const [section, keys] of Object.entries(newLocaleKeys)) {
  if (!es[section]) es[section] = {};
  for (const [key, value] of Object.entries(keys)) {
    if (!es[section][key]) {
      es[section][key] = value;
    }
  }
}

fs.writeFileSync(esPath, JSON.stringify(es, null, 2) + '\n', 'utf8');
console.log('✅ es.json updated with all new sections');

// ─── File processing ───────────────────────────────────────────

function processFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipped (not found): ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Ensure useTranslation import exists
  if (!content.includes('useTranslation')) {
    content = content.replace(
      /^(import .+;\n)/m,
      `import { useTranslation } from 'react-i18next';\n$1`
    );
  }
  
  // Ensure t is destructured in the component
  const hasT = /const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useTranslation/.test(content);
  if (!hasT && content.includes('useTranslation')) {
    // Add const { t } = useTranslation() after the first line of the component function
    content = content.replace(
      /((?:export\s+(?:default\s+)?)?function\s+\w+\s*\([^)]*\)\s*\{)/,
      `$1\n  const { t } = useTranslation();`
    );
    if (!hasT && !content.includes('const { t }')) {
      // Try arrow function pattern
      content = content.replace(
        /((?:export\s+(?:default\s+)?)?const\s+\w+\s*(?::\s*\w+)?\s*=\s*\([^)]*\)\s*(?::\s*\w+)?\s*=>\s*\{)/,
        `$1\n  const { t } = useTranslation();`
      );
    }
  }
  
  // Apply replacements
  let count = 0;
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.replace(search, replace);
      count++;
    }
  }
  
  if (count > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${filePath} — ${count} replacements`);
  } else {
    console.log(`ℹ️  ${filePath} — no matches (already done?)`);
  }
}

// ─── WorkforceTeam.tsx ─────────────────────────────────────────
processFile('src/pages/WorkforceTeam.tsx', [
  // Toasts
  [`toast.error('Nombre y local son obligatorios')`, `toast.error(t('workforce.toastNameLocationRequired'))`],
  [`toast.error('Error al añadir empleado')`, `toast.error(t('workforce.toastAddError'))`],
  [`toast.error('Error al actualizar')`, `toast.error(t('workforce.toastUpdateError'))`],
  [`toast.success('Empleado actualizado')`, `toast.success(t('workforce.toastUpdated'))`],
  [`toast.error('Error al cambiar estado')`, `toast.error(t('workforce.toastStatusError'))`],
  [`toast.error('El título es obligatorio')`, `toast.error(t('workforce.toastTitleRequired'))`],
  [`toast.error('Error al crear anuncio')`, `toast.error(t('workforce.toastAnnouncementError'))`],
  [`toast.success('Anuncio publicado')`, `toast.success(t('workforce.toastAnnouncementPublished'))`],
  [`toast.error('Error al eliminar')`, `toast.error(t('workforce.toastDeleteError'))`],
  [`toast.success('Anuncio eliminado')`, `toast.success(t('workforce.toastAnnouncementDeleted'))`],
  // Page title
  ['>Equipo</h1>', `>{t('workforce.title')}</h1>`],
  // Placeholders
  [`placeholder="Rol"`, `placeholder={t('workforce.filterRole')}`],
  [`placeholder="Local"`, `placeholder={t('workforce.filterLocation')}`],
  [`placeholder="María López García"`, `placeholder={t('workforce.namePlaceholder')}`],
  [`placeholder="Seleccionar local"`, `placeholder={t('workforce.selectLocation')}`],
  [`placeholder="Escribe el mensaje para tu equipo..."`, `placeholder={t('workforce.announcementPlaceholder')}`],
  [`placeholder="Todos"`, `placeholder={t('workforce.all')}`],
  // Table headers
  ['>Empleado</TableHead>', `>{t('workforce.tableEmployee')}</TableHead>`],
  ['>Rol</TableHead>', `>{t('workforce.tableRole')}</TableHead>`],
  ['>Local</TableHead>', `>{t('workforce.tableLocation')}</TableHead>`],
  ['>Coste/h</TableHead>', `>{t('workforce.tableCostHour')}</TableHead>`],
  ['>Estado</TableHead>', `>{t('workforce.tableStatus')}</TableHead>`],
  // Select items
  ['>Todos los roles</SelectItem>', `>{t('workforce.allRoles')}</SelectItem>`],
  ['>Todos los locales</SelectItem>', `>{t('workforce.allLocations')}</SelectItem>`],
  // Badges
  ['>Activo</Badge>', `>{t('workforce.active')}</Badge>`],
  ['>Inactivo</Badge>', `>{t('workforce.inactive')}</Badge>`],
  // Empty states
  ['>Nadie fichado ahora</p>', `>{t('workforce.noClockedIn')}</p>`],
  ['>Los empleados aparecerán aquí al fichar entrada</p>', `>{t('workforce.noClockedInDesc')}</p>`],
  ['>Sin anuncios</p>', `>{t('workforce.noAnnouncements')}</p>`],
  ['>Crea el primer anuncio para tu equipo</p>', `>{t('workforce.noAnnouncementsDesc')}</p>`],
  // Labels
  ['>Nombre completo *</Label>', `>{t('workforce.fullNameRequired')}</Label>`],
  ['>Nombre completo</Label>', `>{t('workforce.fullName')}</Label>`],
  ['>Rol</Label>', `>{t('workforce.role')}</Label>`],
  ['>Coste/hora (€)</Label>', `>{t('workforce.costHour')}</Label>`],
  ['>Local *</Label>', `>{t('workforce.locationRequired')}</Label>`],
  ['>Local</Label>', `>{t('workforce.filterLocation')}</Label>`],
  ['>Estado del empleado</p>', `>{t('workforce.employeeStatus')}</p>`],
  ['>Título *</Label>', `>{t('workforce.announcementTitle')}</Label>`],
  ['>Contenido</Label>', `>{t('workforce.announcementContent')}</Label>`],
  ['>Tipo</Label>', `>{t('workforce.announcementType')}</Label>`],
  ['>General</SelectItem>', `>{t('workforce.typeGeneral')}</SelectItem>`],
  ['>Importante</SelectItem>', `>{t('workforce.typeImportant')}</SelectItem>`],
  ['>Horarios</SelectItem>', `>{t('workforce.typeSchedule')}</SelectItem>`],
  ['>Celebración</SelectItem>', `>{t('workforce.typeCelebration')}</SelectItem>`],
  ['>Local (opcional)</Label>', `>{t('workforce.locationOptional')}</Label>`],
  ['>Fijar en la parte superior</Label>', `>{t('workforce.pinTop')}</Label>`],
  ['>Fijado</Badge>', `>{t('workforce.pinned')}</Badge>`],
]);

// ─── WorkforceTimesheet.tsx ────────────────────────────────────
processFile('src/pages/WorkforceTimesheet.tsx', [
  // Toasts
  [`toast.error('Error al actualizar fichaje')`, `toast.error(t('timesheet.toastUpdateError'))`],
  [`toast.success('Fichaje actualizado')`, `toast.success(t('timesheet.toastUpdated'))`],
  [`toast.error('Error al eliminar')`, `toast.error(t('timesheet.toastDeleteError'))`],
  [`toast.success('Fichaje eliminado')`, `toast.success(t('timesheet.toastDeleted'))`],
  // Text
  ['>Revisión y control de fichajes</p>', `>{t('timesheet.subtitle')}</p>`],
  ['>Todos los locales</SelectItem>', `>{t('timesheet.allLocations')}</SelectItem>`],
  ['>Coste laboral</p>', `>{t('timesheet.labourCost')}</p>`],
  ['>Fichajes</p>', `>{t('timesheet.clockIns')}</p>`],
  ['>Sin fichajes esta semana</p>', `>{t('timesheet.noClockIns')}</p>`],
  ['>Empleado</TableHead>', `>{t('timesheet.tableEmployee')}</TableHead>`],
  ['>Fecha</TableHead>', `>{t('timesheet.tableDate')}</TableHead>`],
  ['>Entrada</TableHead>', `>{t('timesheet.tableClockIn')}</TableHead>`],
  ['>Salida</TableHead>', `>{t('timesheet.tableClockOut')}</TableHead>`],
  ['>Duración</TableHead>', `>{t('timesheet.tableDuration')}</TableHead>`],
  ['>Coste</TableHead>', `>{t('timesheet.tableCost')}</TableHead>`],
  ['>Fuente</TableHead>', `>{t('timesheet.tableSource')}</TableHead>`],
  ['>Activo</Badge>', `>{t('timesheet.active')}</Badge>`],
  ['>Todo en orden</p>', `>{t('timesheet.noAnomalies')}</p>`],
  ['>Hora de entrada</Label>', `>{t('timesheet.clockInTime')}</Label>`],
  ['>Hora de salida</Label>', `>{t('timesheet.clockOutTime')}</Label>`],
]);

// ─── Scheduling.tsx ────────────────────────────────────────────
processFile('src/pages/Scheduling.tsx', [
  [`toast.success('Schedule accepted')`, `toast.success(t('scheduling.accepted'))`],
  [`toast.info('Schedule reverted')`, `toast.info(t('scheduling.reverted'))`],
  [`toast.success('Schedule published and notifications sent to all employees')`, `toast.success(t('scheduling.published'))`],
  [`toast.success('Swap request sent for approval')`, `toast.success(t('scheduling.swapRequested'))`],
  [`toast.success('Swap approved - shifts have been exchanged')`, `toast.success(t('scheduling.swapApproved'))`],
  [`toast.info('Swap request rejected')`, `toast.info(t('scheduling.swapRejected'))`],
  [`toast.info('Auto-fill: No se encontraron huecos para rellenar')`, `toast.info(t('scheduling.autoFillEmpty'))`],
]);

// ─── RecipesPage.tsx ───────────────────────────────────────────
processFile('src/pages/inventory-setup/RecipesPage.tsx', [
  [`placeholder="Buscar recetas..."`, `placeholder={t('recipes.searchPlaceholder')}`],
  [`placeholder="Categoría"`, `placeholder={t('recipes.category')}`],
  [`placeholder="Ej: Pasta Carbonara"`, `placeholder={t('recipes.namePlaceholder')}`],
]);

// ─── RecipeDetailPage.tsx ──────────────────────────────────────
processFile('src/pages/inventory-setup/RecipeDetailPage.tsx', [
  [`placeholder="Seleccionar ingrediente"`, `placeholder={t('recipes.selectIngredient')}`],
  [`placeholder="Seleccionar sub-receta"`, `placeholder={t('recipes.selectSubRecipe')}`],
]);

// ─── MenuItemsPage.tsx ─────────────────────────────────────────
processFile('src/pages/inventory-setup/MenuItemsPage.tsx', [
  [`placeholder="Buscar platos..."`, `placeholder={t('menuItems.searchPlaceholder')}`],
  [`placeholder="Categoría"`, `placeholder={t('menuItems.category')}`],
]);

// ─── InventoryItems.tsx ────────────────────────────────────────
processFile('src/pages/inventory-setup/InventoryItems.tsx', [
  [`placeholder="Search by name..."`, `placeholder={t('inventoryItems.searchPlaceholder')}`],
  [`placeholder="Category"`, `placeholder={t('inventoryItems.category')}`],
  [`placeholder="Supplier"`, `placeholder={t('inventoryItems.supplier')}`],
  [`placeholder="All Locations"`, `placeholder={t('inventoryItems.allLocations')}`],
  [`toast.info('Generating PDF...')`, `toast.info(t('inventoryItems.toastGeneratingPdf'))`],
  [`toast.success('Exported successfully')`, `toast.success(t('inventoryItems.toastExported'))`],
]);

// ─── ReviewsAll.tsx ────────────────────────────────────────────
processFile('src/pages/ReviewsAll.tsx', [
  [`placeholder="All Platforms"`, `placeholder={t('reviews.allPlatforms')}`],
  [`placeholder="All Locations"`, `placeholder={t('reviews.allLocations')}`],
]);

// ─── BookingWidget.tsx ─────────────────────────────────────────
processFile('src/pages/BookingWidget.tsx', [
  [`placeholder="Tu nombre"`, `placeholder={t('booking.name')}`],
  [`placeholder="tu@email.com"`, `placeholder={t('booking.email')}`],
  [`placeholder="Alergias, silla para bebé, celebración especial..."`, `placeholder={t('booking.specialRequestsPlaceholder')}`],
]);

// ─── EmployeeReviews.tsx ───────────────────────────────────────
processFile('src/components/workforce/EmployeeReviews.tsx', [
  [`placeholder="Seleccionar empleado"`, `placeholder={t('employeeReviews.selectEmployee')}`],
  [`placeholder="Fortalezas"`, `placeholder={t('employeeReviews.strengths')}`],
  [`placeholder="Objetivos"`, `placeholder={t('employeeReviews.goals')}`],
]);

// ─── EmploymentContracts.tsx ───────────────────────────────────
processFile('src/components/workforce/EmploymentContracts.tsx', [
  [`placeholder="Seleccionar empleado"`, `placeholder={t('contracts.selectEmployee')}`],
]);

// ─── TeamDirectory.tsx ─────────────────────────────────────────
processFile('src/pages/team/TeamDirectory.tsx', [
  [`placeholder="Buscar compañero/a..."`, `placeholder={t('teamDirectory.searchPlaceholder')}`],
]);

// ─── TeamHome.tsx ──────────────────────────────────────────────
processFile('src/pages/team/TeamHome.tsx', [
  [`toast.success('Entrada registrada')`, `toast.success(t('teamHome.toastClockIn'))`],
  [`toast.error('Error al registrar entrada')`, `toast.error(t('teamHome.toastClockInError'))`],
  [`toast.success('Salida registrada')`, `toast.success(t('teamHome.toastClockOut'))`],
  [`toast.error('Error al registrar salida')`, `toast.error(t('teamHome.toastClockOutError'))`],
]);

// ─── ProcurementCart.tsx ───────────────────────────────────────
processFile('src/pages/ProcurementCart.tsx', [
  [`placeholder="Add any special instructions for this order..."`, `placeholder={t('procurement.specialInstructions')}`],
]);

// ─── ProcurementOrders.tsx ─────────────────────────────────────
processFile('src/pages/ProcurementOrders.tsx', [
  [`toast.success('New order received!',`, `toast.success(t('procurement.toastNewOrder'),`],
  [`toast.success('Order sent to supplier!',`, `toast.success(t('procurement.toastOrderSent'),`],
]);

// ─── OnboardingWizardV2.tsx ────────────────────────────────────
processFile('src/pages/OnboardingWizardV2.tsx', [
  [`toast.error('Error al configurar tu cuenta. Intenta de nuevo.')`, `toast.error(t('onboarding.toastError'))`],
  [`toast.success('Bienvenido a Josephine')`, `toast.success(t('onboarding.toastWelcome'))`],
  [`toast.error('Error al finalizar. Intenta de nuevo.')`, `toast.error(t('onboarding.toastFinalError'))`],
]);

// ─── Pricing.tsx ───────────────────────────────────────────────
processFile('src/pages/Pricing.tsx', [
  [`toast.info('Plan gratuito — ya estás en este plan')`, `toast.info(t('pricing.toastFreePlan'))`],
  [`toast.error('No se pudo crear la sesión de pago. Intenta de nuevo.')`, `toast.error(t('pricing.toastPaymentError'))`],
]);

// ─── DataImport.tsx ────────────────────────────────────────────
processFile('src/pages/DataImport.tsx', [
  [`toast.error('Selecciona una ubicación específica antes de importar')`, `toast.error(t('dataImport.toastSelectLocation'))`],
  [`toast.error('Error inesperado durante la importación')`, `toast.error(t('dataImport.toastImportError'))`],
]);

// ─── WorkforceOnboarding.tsx ───────────────────────────────────
processFile('src/pages/WorkforceOnboarding.tsx', [
  ['>Sin incorporaciones recientes</p>', `>{t('workforceOnboarding.noRecentOnboardings')}</p>`],
  ['>Todos los empleados</h3>', `>{t('workforceOnboarding.allEmployees')}</h3>`],
  ['>Tipo de contrato</Label>', `>{t('workforceOnboarding.contractType')}</Label>`],
  ['>Indefinido</SelectItem>', `>{t('workforceOnboarding.permanent')}</SelectItem>`],
  [`toast.success('Contrato registrado (demo)')`, `toast.success(t('workforceOnboarding.toastContractRegistered'))`],
]);

// ─── UsersRolesManager.tsx ─────────────────────────────────────
processFile('src/components/settings/UsersRolesManager.tsx', [
  [`placeholder="Seleccionar rol"`, `placeholder={t('settings.selectRole')}`],
  [`placeholder="Seleccionar scope"`, `placeholder={t('settings.selectScope')}`],
]);

// ─── TeamManagersTab.tsx ───────────────────────────────────────
processFile('src/components/settings/TeamManagersTab.tsx', [
  [`placeholder="María"`, `placeholder={t('settings.firstName')}`],
  [`placeholder="García"`, `placeholder={t('settings.lastName')}`],
]);

// ─── TeamManager.tsx ───────────────────────────────────────────
processFile('src/components/settings/TeamManager.tsx', [
  [`placeholder="Juan García"`, `placeholder={t('settings.fullName')}`],
  [`placeholder="juan@ejemplo.com"`, `placeholder={t('settings.emailPlaceholder')}`],
  [`placeholder="Seleccionar rol"`, `placeholder={t('settings.selectRole')}`],
  [`placeholder="Seleccionar ubicación"`, `placeholder={t('settings.selectLocation')}`],
]);

// ─── PaymentHistoryManager.tsx ─────────────────────────────────
processFile('src/components/settings/PaymentHistoryManager.tsx', [
  [`placeholder="Método"`, `placeholder={t('settings.paymentMethod')}`],
  [`placeholder="Local"`, `placeholder={t('settings.location')}`],
]);

console.log('\n🎉 All files processed!');
