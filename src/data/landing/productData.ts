/**
 * Product Page Data — Content configuration for all 4 product module pages
 * 
 * Single source of truth. ES + EN content.
 * Referenced by ProductBI, ProductInventory, ProductWorkforce, ProductPayroll pages.
 */
import type { ProductPageConfig } from '@/components/landing/ProductPageTemplate';

export const productBI: ProductPageConfig = {
  badge: 'Business Intelligence',
  badgeEs: 'Business Intelligence',
  badgeColor: 'red',
  heroHeadline: 'Decisions powered by data, not guesswork.',
  heroHeadlineEs: 'Decisiones basadas en datos, no en suposiciones.',
  heroBody: 'Access AI-predictive analytics that guide your restaurant teams toward smarter, faster, more profitable decisions — every single day.',
  heroBodyEs: 'Accede a analítica predictiva con IA que guía a tu equipo hacia decisiones más inteligentes, rápidas y rentables — cada día.',
  heroBg: '#15131C',
  heroTextColor: '#BEB1F0',
  heroImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
  valuePropHeadline: 'See the full picture. Act on what matters.',
  valuePropHeadlineEs: 'Ve el panorama completo. Actúa sobre lo que importa.',
  valuePropBody: 'Real-time dashboards, AI forecasting, and actionable alerts that help operators make confident decisions without drowning in spreadsheets.',
  valuePropBodyEs: 'Dashboards en tiempo real, previsiones IA y alertas accionables que ayudan a los operadores a tomar decisiones seguras sin ahogarse en hojas de cálculo.',
  metrics: [
    { value: '5-15min', label: 'real-time sales update', labelEs: 'actualización de ventas en tiempo real', bg: 'var(--l-surface-white)' },
    { value: '90-95%', label: 'sales forecast accuracy', labelEs: 'precisión de previsión de ventas', bg: 'var(--l-accent-lavender)' },
  ],
  featureHeadline: 'Why operators love Josephine BI',
  featureHeadlineEs: 'Por qué los operadores eligen Josephine BI',
  features: [
    { title: 'AI-powered daily briefings', titleEs: 'Briefings diarios con IA', description: 'Start every day knowing exactly what to focus on: alerts, targets, and AI recommendations delivered before you open.', descriptionEs: 'Empieza cada día sabiendo exactamente en qué enfocarte: alertas, objetivos y recomendaciones IA antes de abrir.' },
    { title: 'Multi-location dashboards', titleEs: 'Dashboards multi-local', description: 'Compare P&L, labour costs, and sales across all venues from a single screen.', descriptionEs: 'Compara P&L, costes laborales y ventas de todos los locales desde una sola pantalla.' },
    { title: 'Flash P&L reporting', titleEs: 'Informes Flash P&L', description: 'See your profitability in real-time — no more waiting until month-end for accountant reports.', descriptionEs: 'Ve tu rentabilidad en tiempo real — sin esperar a los informes de fin de mes.' },
    { title: 'Custom alerts', titleEs: 'Alertas personalizadas', description: 'Set thresholds for labour %, food cost, and sales. Get notified instantly when something needs attention.', descriptionEs: 'Define umbrales para % laboral, coste de comida y ventas. Recibe notificaciones instantáneas cuando algo necesite atención.' },
    { title: 'Sales forecasting', titleEs: 'Previsión de ventas', description: 'Machine learning models trained on your historical data predict tomorrow\'s sales with 90-95% accuracy.', descriptionEs: 'Modelos de machine learning entrenados con tus datos históricos predicen las ventas de mañana con 90-95% de precisión.' },
  ],
  faqs: [
    { question: 'How accurate is the sales forecasting?', questionEs: '¿Qué precisión tiene la previsión de ventas?', answer: 'Our ensemble model (Prophet + XGBoost) achieves 90-95% accuracy on average across all venue types, even during seasonal fluctuations.', answerEs: 'Nuestro modelo ensemble (Prophet + XGBoost) logra un 90-95% de precisión media en todos los tipos de local, incluso durante fluctuaciones estacionales.' },
    { question: 'Can I see all my locations in one dashboard?', questionEs: '¿Puedo ver todos mis locales en un solo dashboard?', answer: 'Yes. Our multi-location dashboard lets you compare KPIs across venues, drill down into individual locations, and export reports.', answerEs: 'Sí. Nuestro dashboard multi-local te permite comparar KPIs entre locales, hacer drill-down a locales individuales y exportar informes.' },
    { question: 'How quickly do I see data?', questionEs: '¿Con qué rapidez veo los datos?', answer: 'Sales data updates every 5-15 minutes via POS integration. Labour and inventory data sync in real-time.', answerEs: 'Los datos de ventas se actualizan cada 5-15 minutos vía integración POS. Los datos laborales y de inventario se sincronizan en tiempo real.' },
  ],
};

export const productInventory: ProductPageConfig = {
  badge: 'Inventory',
  badgeEs: 'Inventario',
  badgeColor: 'blue',
  heroHeadline: 'Every euro saved is a euro earned.',
  heroHeadlineEs: 'Cada euro ahorrado es un euro ganado.',
  heroBody: 'AI-driven inventory management that maximises margins, reduces waste, and takes the guesswork out of ordering — automatically.',
  heroBodyEs: 'Gestión de inventario con IA que maximiza márgenes, reduce merma y elimina las adivinanzas en los pedidos — automáticamente.',
  heroBg: '#0B2414',
  heroTextColor: '#B8F724',
  heroImage: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
  valuePropHeadline: 'Control every ingredient. Protect every margin.',
  valuePropHeadlineEs: 'Controla cada ingrediente. Protege cada margen.',
  valuePropBody: 'From automated ordering to real-time stock tracking, Josephine gives you complete visibility into your supply chain.',
  valuePropBodyEs: 'Desde pedidos automáticos hasta seguimiento de stock en tiempo real, Josephine te da visibilidad completa de tu cadena de suministro.',
  metrics: [
    { value: '2-5%', label: 'increase in GP margins', labelEs: 'aumento de márgenes GP', bg: 'var(--l-surface-white)' },
    { value: '50%', label: 'reduction in waste', labelEs: 'reducción de merma', bg: '#B8F724' },
  ],
  featureHeadline: 'Why operators love Josephine Inventory',
  featureHeadlineEs: 'Por qué los operadores eligen Josephine Inventario',
  features: [
    { title: 'AI-powered auto ordering', titleEs: 'Pedidos automáticos con IA', description: 'Smart ordering suggestions based on forecasted demand, current stock levels, and supplier schedules.', descriptionEs: 'Sugerencias de pedido inteligentes basadas en demanda prevista, niveles de stock actuales y calendarios de proveedores.' },
    { title: 'Recipe costing', titleEs: 'Costeo de recetas', description: 'Know the exact cost and GP% of every dish on your menu, updated in real-time as ingredient prices change.', descriptionEs: 'Conoce el coste exacto y GP% de cada plato de tu menú, actualizado en tiempo real al cambiar los precios de ingredientes.' },
    { title: 'Waste tracking', titleEs: 'Control de merma', description: 'Log waste by category, track trends, and get AI recommendations to reduce unaccounted losses.', descriptionEs: 'Registra merma por categoría, sigue tendencias y recibe recomendaciones IA para reducir pérdidas no contabilizadas.' },
    { title: 'Supplier management', titleEs: 'Gestión de proveedores', description: 'Compare prices across suppliers, set preferred vendors, and streamline your procurement workflow.', descriptionEs: 'Compara precios entre proveedores, establece proveedores preferidos y optimiza tu flujo de compras.' },
  ],
  faqs: [
    { question: 'Does it integrate with my existing suppliers?', questionEs: '¿Se integra con mis proveedores actuales?', answer: 'Yes, Josephine integrates with major food distributors and allows manual supplier setup for local vendors.', answerEs: 'Sí, Josephine se integra con los principales distribuidores de alimentación y permite configurar proveedores locales manualmente.' },
    { question: 'How does AI ordering work?', questionEs: '¿Cómo funcionan los pedidos con IA?', answer: 'Our AI analyses your sales forecast, current stock, par levels, and supplier lead times to generate optimal order suggestions daily.', answerEs: 'Nuestra IA analiza tu previsión de ventas, stock actual, niveles par y tiempos de entrega del proveedor para generar sugerencias de pedido óptimas cada día.' },
    { question: 'Can I track waste in real-time?', questionEs: '¿Puedo rastrear la merma en tiempo real?', answer: 'Yes, with our mobile-first waste entry system that categorises by reason, location, and period.', answerEs: 'Sí, con nuestro sistema de registro de merma móvil que categoriza por razón, local y periodo.' },
  ],
};

export const productWorkforce: ProductPageConfig = {
  badge: 'Workforce Management',
  badgeEs: 'Gestión de Personal',
  badgeColor: 'green',
  heroHeadline: 'Happy teams deliver exceptional experiences.',
  heroHeadlineEs: 'Equipos felices crean experiencias excepcionales.',
  heroBody: 'Onboard, schedule, engage, and reward your team — all from one platform designed for hospitality.',
  heroBodyEs: 'Incorpora, programa, motiva y recompensa a tu equipo — todo desde una plataforma diseñada para hostelería.',
  heroBg: '#BEB1F0',
  heroTextColor: '#2B0E14',
  heroImage: 'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?w=800&q=80',
  valuePropHeadline: 'Build great teams. Keep great teams.',
  valuePropHeadlineEs: 'Construye grandes equipos. Retén grandes equipos.',
  valuePropBody: 'From onboarding to scheduling to performance reviews, manage your entire workforce lifecycle in one place.',
  valuePropBodyEs: 'Desde onboarding hasta horarios y evaluaciones de rendimiento, gestiona todo el ciclo de tu equipo en un solo lugar.',
  metrics: [
    { value: '15-20%', label: 'lower labour costs', labelEs: 'reducción de costes laborales', bg: 'var(--l-surface-white)' },
    { value: '4.5h', label: 'saved per week on scheduling', labelEs: 'ahorradas por semana en horarios', bg: '#2B0E14' },
  ],
  featureHeadline: 'Why operators love Josephine Workforce',
  featureHeadlineEs: 'Por qué los operadores eligen Josephine Personal',
  features: [
    { title: 'Smart scheduling', titleEs: 'Horarios inteligentes', description: 'AI-optimised schedules that balance labour costs, demand forecasts, and employee preferences.', descriptionEs: 'Horarios optimizados con IA que equilibran costes laborales, previsiones de demanda y preferencias de empleados.' },
    { title: 'Digital onboarding', titleEs: 'Onboarding digital', description: 'Paperless onboarding with document collection, training checklists, and compliance tracking.', descriptionEs: 'Onboarding sin papel con recogida de documentos, checklists de formación y seguimiento de cumplimiento.' },
    { title: 'Time & attendance', titleEs: 'Fichajes y asistencia', description: 'GPS-verified clock-in/out with automated timesheet generation and break compliance.', descriptionEs: 'Fichaje con verificación GPS, generación automática de hojas de tiempo y cumplimiento de descansos.' },
    { title: 'Team portal', titleEs: 'Portal del empleado', description: 'Employees access schedules, swap shifts, request time off, and view payslips from their phone.', descriptionEs: 'Los empleados acceden a horarios, intercambian turnos, solicitan vacaciones y ven sus nóminas desde su móvil.' },
  ],
  faqs: [
    { question: 'Can employees swap shifts?', questionEs: '¿Pueden los empleados intercambiar turnos?', answer: 'Yes, team members can request shift swaps through the mobile portal, pending manager approval.', answerEs: 'Sí, los miembros del equipo pueden solicitar intercambio de turnos a través del portal móvil, pendiente de aprobación del gerente.' },
    { question: 'Does it handle different contract types?', questionEs: '¿Gestiona diferentes tipos de contrato?', answer: 'Absolutely, from full-time and part-time to zero-hours, seasonal, and agency workers.', answerEs: 'Por supuesto, desde jornada completa y parcial hasta contratos por horas, temporales y trabajadores de agencia.' },
    { question: 'How does labour cost optimisation work?', questionEs: '¿Cómo funciona la optimización de costes laborales?', answer: 'Our AI compares forecasted demand with your labour budget to suggest optimal staffing levels, flagging over-scheduling before it happens.', answerEs: 'Nuestra IA compara la demanda prevista con tu presupuesto laboral para sugerir niveles óptimos de personal, señalando sobre-programación antes de que ocurra.' },
  ],
};

export const productPayroll: ProductPageConfig = {
  badge: 'Payroll',
  badgeEs: 'Nóminas',
  badgeColor: 'yellow',
  heroHeadline: 'Pay day, sorted. Every time.',
  heroHeadlineEs: 'Día de nómina, resuelto. Siempre.',
  heroBody: 'Automate the entire payroll process from timesheets to pay runs — seamlessly, accurately, and compliantly.',
  heroBodyEs: 'Automatiza todo el proceso de nóminas desde hojas de hora hasta ejecución de pagos — sin fricciones, con precisión y cumpliendo la normativa.',
  heroBg: '#FAF9F6',
  heroTextColor: '#1A1A1A',
  heroImage: 'https://images.unsplash.com/photo-1554224154-22dec7ec8818?w=800&q=80',
  valuePropHeadline: 'From timesheets to payslips. Zero friction.',
  valuePropHeadlineEs: 'De hojas de hora a nóminas. Sin fricciones.',
  valuePropBody: 'Connect scheduling, time tracking, and payroll in one flow. No more manual exports, re-keying, or month-end panic.',
  valuePropBodyEs: 'Conecta horarios, fichajes y nóminas en un solo flujo. Sin más exportaciones manuales, re-entrada de datos ni pánico a fin de mes.',
  metrics: [
    { value: '8h', label: 'saved per pay cycle', labelEs: 'ahorradas por ciclo de nómina', bg: 'var(--l-surface-white)' },
    { value: '99.9%', label: 'payroll accuracy', labelEs: 'precisión de nómina', bg: '#FBBF24' },
  ],
  featureHeadline: 'Why operators love Josephine Payroll',
  featureHeadlineEs: 'Por qué los operadores eligen Josephine Nóminas',
  features: [
    { title: 'Automated pay runs', titleEs: 'Ejecución de pagos automatizada', description: 'One-click payroll that pulls verified timesheets, applies rates, and generates payslips.', descriptionEs: 'Nómina con un clic que extrae fichajes verificados, aplica tarifas y genera recibos de pago.' },
    { title: 'Compliance built-in', titleEs: 'Cumplimiento integrado', description: 'Automatic handling of tax, national insurance, pensions, and statutory payments.', descriptionEs: 'Gestión automática de impuestos, seguridad social, pensiones y pagos estatutarios.' },
    { title: 'Employee self-service', titleEs: 'Autoservicio del empleado', description: 'Staff view payslips, tax documents, and payment history from their mobile portal.', descriptionEs: 'El personal ve recibos de nómina, documentos fiscales e historial de pagos desde su portal móvil.' },
    { title: 'Multi-venue payroll', titleEs: 'Nómina multi-local', description: 'Run payroll across multiple locations with different pay rates, contracts, and schedules.', descriptionEs: 'Ejecuta nóminas en múltiples locales con diferentes tarifas, contratos y horarios.' },
  ],
  faqs: [
    { question: 'Does it work with my existing accountant?', questionEs: '¿Funciona con mi contable actual?', answer: 'Yes, Josephine Payroll exports to all major accounting packages (Xero, Sage, QuickBooks).', answerEs: 'Sí, Josephine Nóminas exporta a los principales programas de contabilidad (Xero, Sage, QuickBooks).' },
    { question: 'Is payroll compliant in my country?', questionEs: '¿La nómina cumple la normativa de mi país?', answer: 'We currently support UK and EU payroll regulations, with more jurisdictions coming soon.', answerEs: 'Actualmente soportamos normativa de nóminas del Reino Unido y la UE, con más jurisdicciones próximamente.' },
    { question: 'How does it connect to scheduling?', questionEs: '¿Cómo se conecta con los horarios?', answer: 'Timesheets flow directly from our scheduling module to payroll — no re-keying, no exports, no errors.', answerEs: 'Las hojas de hora fluyen directamente desde nuestro módulo de horarios a nóminas — sin re-entrada de datos, sin exportaciones, sin errores.' },
  ],
};
