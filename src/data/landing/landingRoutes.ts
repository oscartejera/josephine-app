/**
 * Landing Routes — Centralized Configuration
 * 
 * Single source of truth for all landing page routes,
 * mega-menu navigation items, and SEO metadata.
 */

export interface LandingNavItem {
  title: string;
  titleEs: string;
  href: string;
  description: string;
  descriptionEs: string;
  icon?: string;
}

export interface LandingNavSection {
  label: string;
  labelEs: string;
  items: LandingNavItem[];
}

export interface LandingMegaMenuItem {
  key: string;
  label: string;
  labelEs: string;
  href?: string; // If link only (no dropdown)
  sections?: LandingNavSection[];
  columns: 2 | 3;
}

export interface LandingPageMeta {
  path: string;
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  layout: 'standard' | 'isolated'; // isolated = no navbar/footer
}

// --- Mega Menu Structure ---

export const megaMenuItems: LandingMegaMenuItem[] = [
  {
    key: 'product',
    label: 'Product',
    labelEs: 'Producto',
    columns: 3,
    sections: [
      {
        label: 'Product',
        labelEs: 'Producto',
        items: [
          {
            title: 'The system',
            titleEs: 'El sistema',
            href: '/product',
            description: 'Everything you need to grow your margins, all on one platform.',
            descriptionEs: 'Todo lo que necesitas para mejorar tus márgenes, en una sola plataforma.',
            icon: '🏗️',
          },
          {
            title: 'Integrations',
            titleEs: 'Integraciones',
            href: '/integrations',
            description: 'Bring all your data together through our integrations ecosystem.',
            descriptionEs: 'Unifica todos tus datos a través de nuestro ecosistema de integraciones.',
            icon: '🔗',
          },
          {
            title: 'How we manage change',
            titleEs: 'Cómo gestionamos el cambio',
            href: '/change-management',
            description: 'Smooth transitions, minimal interruptions, and big wins.',
            descriptionEs: 'Transiciones suaves, interrupciones mínimas, y grandes resultados.',
            icon: '🔄',
          },
          {
            title: 'Capital',
            titleEs: 'Capital',
            href: '/capital',
            description: 'Access a financing solution custom-built for restaurant growth.',
            descriptionEs: 'Accede a una solución de financiación diseñada para el crecimiento de restaurantes.',
            icon: '💰',
          },
        ],
      },
      {
        label: 'Modules',
        labelEs: 'Módulos',
        items: [
          {
            title: 'Business Intelligence',
            titleEs: 'Business Intelligence',
            href: '/product/business-intelligence',
            description: 'Access AI insights to guide restaurant teams toward success.',
            descriptionEs: 'Accede a insights de IA para guiar a tu equipo hacia el éxito.',
            icon: '📊',
          },
          {
            title: 'Inventory',
            titleEs: 'Inventario',
            href: '/product/inventory',
            description: 'Maximise margins, reduce waste, and streamline supply chain.',
            descriptionEs: 'Maximiza márgenes, reduce merma y optimiza la cadena de suministro.',
            icon: '📦',
          },
          {
            title: 'Workforce',
            titleEs: 'Personal',
            href: '/product/workforce-management',
            description: 'Onboard, engage, and reward your team effectively.',
            descriptionEs: 'Incorpora, motiva y recompensa a tu equipo de forma eficaz.',
            icon: '👥',
          },
          {
            title: 'Payroll',
            titleEs: 'Nóminas',
            href: '/product/payroll',
            description: 'Automate the entire payroll process seamlessly.',
            descriptionEs: 'Automatiza todo el proceso de nóminas sin fricciones.',
            icon: '💵',
          },
        ],
      },
    ],
  },
  {
    key: 'solutions',
    label: 'Solutions',
    labelEs: 'Soluciones',
    columns: 2,
    sections: [
      {
        label: 'Solutions',
        labelEs: 'Soluciones',
        items: [
          {
            title: 'Independent brands',
            titleEs: 'Marcas independientes',
            href: '/solutions/independent-brands',
            description: 'Control and forecast day-to-day operations in one place.',
            descriptionEs: 'Controla y pronostica tus operaciones diarias en un solo lugar.',
            icon: '🏪',
          },
          {
            title: 'Franchise Networks',
            titleEs: 'Redes de Franquicias',
            href: '/solutions/franchise-networks',
            description: 'Guide front-line franchise teams to increase performance.',
            descriptionEs: 'Guía a tus equipos de franquicia para mejorar el rendimiento.',
            icon: '🌐',
          },
          {
            title: 'Multi-Location Brands',
            titleEs: 'Marcas Multi-local',
            href: '/solutions/multi-location-brands',
            description: 'Focus on growing your multi-location restaurant.',
            descriptionEs: 'Enfócate en hacer crecer tu restaurante multi-local.',
            icon: '📍',
          },
          {
            title: 'Enterprise Groups',
            titleEs: 'Grupos Enterprise',
            href: '/solutions/enterprise-groups',
            description: 'Drive consistent results and maximise your group\'s potential.',
            descriptionEs: 'Obtén resultados consistentes y maximiza el potencial de tu grupo.',
            icon: '🏢',
          },
        ],
      },
    ],
  },
  {
    key: 'about',
    label: 'About',
    labelEs: 'Nosotros',
    columns: 2,
    sections: [
      {
        label: 'About',
        labelEs: 'Nosotros',
        items: [
          {
            title: 'About Josephine',
            titleEs: 'Sobre Josephine',
            href: '/about',
            description: "We're serving up the Restaurant Revolution.",
            descriptionEs: 'Estamos liderando la Revolución de la Restauración.',
            icon: '✨',
          },
          {
            title: 'Partner Program',
            titleEs: 'Programa de Partners',
            href: '/partner-program',
            description: 'Growing through partnerships with like-minded businesses.',
            descriptionEs: 'Creciendo a través de alianzas con negocios afines.',
            icon: '🤝',
          },
          {
            title: 'Careers',
            titleEs: 'Trabaja con Nosotros',
            href: '/careers',
            description: 'Ready to join the ranks?',
            descriptionEs: '¿Listo para unirte al equipo?',
            icon: '🚀',
          },
        ],
      },
    ],
  },
  {
    key: 'success-stories',
    label: 'Success Stories',
    labelEs: 'Casos de Éxito',
    href: '/success-stories',
    columns: 2,
  },
  {
    key: 'resources',
    label: 'Resources',
    labelEs: 'Recursos',
    columns: 2,
    sections: [
      {
        label: 'Resources',
        labelEs: 'Recursos',
        items: [
          {
            title: 'Blog',
            titleEs: 'Blog',
            href: '/blog',
            description: 'Operator insights and ideas.',
            descriptionEs: 'Ideas e insights para operadores.',
            icon: '📝',
          },
          {
            title: 'Podcast',
            titleEs: 'Podcast',
            href: '/podcasts',
            description: "What's Cooking? podcast.",
            descriptionEs: 'Podcast ¿Qué se cuece?',
            icon: '🎙️',
          },
          {
            title: 'Benchmark',
            titleEs: 'Benchmark',
            href: '/benchmark',
            description: 'Discover how your venues perform against the industry.',
            descriptionEs: 'Descubre cómo rinden tus locales frente a la industria.',
            icon: '📈',
          },
          {
            title: 'ROI Calculator',
            titleEs: 'Calculadora ROI',
            href: '/roi-calculator',
            description: 'Calculate your potential savings with Josephine.',
            descriptionEs: 'Calcula tus ahorros potenciales con Josephine.',
            icon: '🧮',
          },
          {
            title: 'Content Library',
            titleEs: 'Biblioteca de Contenido',
            href: '/content-library',
            description: 'Guides, playbooks, and explainers.',
            descriptionEs: 'Guías, playbooks y explicadores.',
            icon: '📚',
          },
        ],
      },
    ],
  },
];

// --- Success Story for mega-menu sidebar ---
export const megaMenuSuccessStory = {
  imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
  titleEn: 'La Piazza doubles profitability with Josephine in 6 months',
  titleEs: 'La Piazza duplica su rentabilidad con Josephine en 6 meses',
  linkText: 'Read success story →',
  linkTextEs: 'Leer caso de éxito →',
  href: '/success-stories',
};

// --- Page SEO Metadata ---
export const landingPagesMeta: LandingPageMeta[] = [
  // Homepage
  { path: '/', titleEn: 'Josephine — AI-Powered Restaurant Management', titleEs: 'Josephine — Gestión de Restaurantes con IA', descriptionEn: 'Streamline operations, boost margins, reduce waste. The all-in-one AI platform for modern restaurants.', descriptionEs: 'Optimiza operaciones, mejora márgenes, reduce merma. La plataforma IA todo-en-uno para restaurantes modernos.', layout: 'standard' },
  // Product
  { path: '/product/business-intelligence', titleEn: 'Business Intelligence — Josephine', titleEs: 'Business Intelligence — Josephine', descriptionEn: 'AI-powered analytics for smarter restaurant decisions.', descriptionEs: 'Analítica potenciada por IA para decisiones más inteligentes.', layout: 'standard' },
  { path: '/product/inventory', titleEn: 'Inventory Management — Josephine', titleEs: 'Gestión de Inventario — Josephine', descriptionEn: 'Maximise margins and reduce waste with AI-driven inventory.', descriptionEs: 'Maximiza márgenes y reduce merma con inventario inteligente.', layout: 'standard' },
  { path: '/product/workforce-management', titleEn: 'Workforce Management — Josephine', titleEs: 'Gestión de Personal — Josephine', descriptionEn: 'Onboard, schedule, and reward your team seamlessly.', descriptionEs: 'Incorpora, programa y recompensa a tu equipo sin fricciones.', layout: 'standard' },
  { path: '/product/payroll', titleEn: 'Payroll — Josephine', titleEs: 'Nóminas — Josephine', descriptionEn: 'Automate payroll and save hours every week.', descriptionEs: 'Automatiza nóminas y ahorra horas cada semana.', layout: 'standard' },
  // Solutions
  { path: '/solutions/independent-brands', titleEn: 'For Independent Restaurants — Josephine', titleEs: 'Para Restaurantes Independientes — Josephine', descriptionEn: 'Full operational control for independent restaurants.', descriptionEs: 'Control operativo total para restaurantes independientes.', layout: 'standard' },
  { path: '/solutions/franchise-networks', titleEn: 'For Franchise Networks — Josephine', titleEs: 'Para Redes de Franquicias — Josephine', descriptionEn: 'Scale franchise performance with data-driven management.', descriptionEs: 'Escala el rendimiento de franquicias con gestión basada en datos.', layout: 'standard' },
  { path: '/solutions/multi-location-brands', titleEn: 'For Multi-Location Brands — Josephine', titleEs: 'Para Marcas Multi-local — Josephine', descriptionEn: 'Unified operations for growing multi-location restaurants.', descriptionEs: 'Operaciones unificadas para restaurantes multi-local en crecimiento.', layout: 'standard' },
  { path: '/solutions/enterprise-groups', titleEn: 'For Enterprise Groups — Josephine', titleEs: 'Para Grupos Enterprise — Josephine', descriptionEn: 'Enterprise-grade restaurant management at scale.', descriptionEs: 'Gestión de restaurantes a escala empresarial.', layout: 'standard' },
  // About
  { path: '/about', titleEn: 'About Josephine — Our Mission', titleEs: 'Sobre Josephine — Nuestra Misión', descriptionEn: 'We\'re serving up the Restaurant Revolution.', descriptionEs: 'Estamos liderando la Revolución de la Restauración.', layout: 'standard' },
  { path: '/partner-program', titleEn: 'Partner Program — Josephine', titleEs: 'Programa de Partners — Josephine', descriptionEn: 'Grow your business through strategic partnerships.', descriptionEs: 'Haz crecer tu negocio a través de alianzas estratégicas.', layout: 'standard' },
  { path: '/careers', titleEn: 'Careers at Josephine', titleEs: 'Trabaja con Nosotros — Josephine', descriptionEn: 'Join the team building the future of restaurants.', descriptionEs: 'Únete al equipo que construye el futuro de los restaurantes.', layout: 'standard' },
  // Resources
  { path: '/blog', titleEn: 'Blog — Josephine', titleEs: 'Blog — Josephine', descriptionEn: 'Industry insights, operator tips, and product updates.', descriptionEs: 'Insights de la industria, consejos y novedades de producto.', layout: 'standard' },
  { path: '/podcasts', titleEn: 'Podcast — Josephine', titleEs: 'Podcast — Josephine', descriptionEn: 'What\'s Cooking? Conversations with hospitality leaders.', descriptionEs: '¿Qué se cuece? Conversaciones con líderes de hostelería.', layout: 'standard' },
  { path: '/benchmark', titleEn: 'Benchmark Your Restaurant — Josephine', titleEs: 'Compara tu Restaurante — Josephine', descriptionEn: 'See how your venue performs vs industry benchmarks.', descriptionEs: 'Mira cómo rinde tu local frente a benchmarks de la industria.', layout: 'standard' },
  { path: '/roi-calculator', titleEn: 'ROI Calculator — Josephine', titleEs: 'Calculadora ROI — Josephine', descriptionEn: 'Calculate your potential savings with Josephine.', descriptionEs: 'Calcula tus ahorros potenciales con Josephine.', layout: 'isolated' },
  { path: '/content-library', titleEn: 'Content Library — Josephine', titleEs: 'Biblioteca de Contenido — Josephine', descriptionEn: 'Guides, playbooks, and explainers for operators.', descriptionEs: 'Guías, playbooks y explicadores para operadores.', layout: 'standard' },
  // Conversion
  { path: '/success-stories', titleEn: 'Success Stories — Josephine', titleEs: 'Casos de Éxito — Josephine', descriptionEn: 'See how restaurants transform with Josephine.', descriptionEs: 'Descubre cómo los restaurantes se transforman con Josephine.', layout: 'standard' },
  { path: '/book-a-chat', titleEn: 'Book a Chat — Josephine', titleEs: 'Reserva una Demo — Josephine', descriptionEn: 'See Josephine in action. Book a personalised demo.', descriptionEs: 'Descubre Josephine en acción. Reserva una demo personalizada.', layout: 'isolated' },
];

// --- Footer Links ---
export const footerLinks = {
  main: [
    {
      heading: 'Home',
      headingEs: 'Inicio',
      links: [
        { label: 'Home', labelEs: 'Inicio', href: '/' },
        { label: 'Product tour', labelEs: 'Tour del producto', href: '/product' },
        { label: 'Login', labelEs: 'Acceder', href: '/login' },
      ],
    },
    {
      heading: 'Product',
      headingEs: 'Producto',
      links: [
        { label: 'The system', labelEs: 'El sistema', href: '/product' },
        { label: 'Integrations', labelEs: 'Integraciones', href: '/integrations' },
        { label: 'Capital', labelEs: 'Capital', href: '/capital' },
      ],
    },
    {
      heading: 'Modules',
      headingEs: 'Módulos',
      links: [
        { label: 'Business Intelligence', labelEs: 'Business Intelligence', href: '/product/business-intelligence' },
        { label: 'Inventory', labelEs: 'Inventario', href: '/product/inventory' },
        { label: 'Workforce', labelEs: 'Personal', href: '/product/workforce-management' },
        { label: 'Payroll', labelEs: 'Nóminas', href: '/product/payroll' },
      ],
    },
    {
      heading: 'About',
      headingEs: 'Nosotros',
      links: [
        { label: 'About Josephine', labelEs: 'Sobre Josephine', href: '/about' },
        { label: 'Partner Program', labelEs: 'Programa de Partners', href: '/partner-program' },
        { label: 'Careers', labelEs: 'Trabaja con Nosotros', href: '/careers' },
      ],
    },
  ],
  secondary: [
    {
      heading: 'Get in touch',
      headingEs: 'Contacto',
      links: [
        { label: 'Book a chat', labelEs: 'Reserva una demo', href: '/book-a-chat' },
        { label: 'Contact', labelEs: 'Contactar', href: '/book-a-chat' },
      ],
    },
    {
      heading: 'Resources',
      headingEs: 'Recursos',
      links: [
        { label: 'Success stories', labelEs: 'Casos de éxito', href: '/success-stories' },
        { label: 'Blog', labelEs: 'Blog', href: '/blog' },
        { label: 'ROI Calculator', labelEs: 'Calculadora ROI', href: '/roi-calculator' },
      ],
    },
    {
      heading: 'Follow us',
      headingEs: 'Síguenos',
      links: [
        { label: 'X', labelEs: 'X', href: 'https://x.com/josephine' },
        { label: 'Instagram', labelEs: 'Instagram', href: 'https://instagram.com/josephine' },
        { label: 'LinkedIn', labelEs: 'LinkedIn', href: 'https://linkedin.com/company/josephine' },
      ],
    },
    {
      heading: 'Solutions',
      headingEs: 'Soluciones',
      links: [
        { label: 'Independent brands', labelEs: 'Marcas independientes', href: '/solutions/independent-brands' },
        { label: 'Franchise networks', labelEs: 'Redes de franquicias', href: '/solutions/franchise-networks' },
        { label: 'Multi-location', labelEs: 'Multi-local', href: '/solutions/multi-location-brands' },
        { label: 'Enterprise groups', labelEs: 'Grupos Enterprise', href: '/solutions/enterprise-groups' },
      ],
    },
  ],
};
