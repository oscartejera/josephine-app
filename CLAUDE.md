# CLAUDE.md

## Project Overview

Josephine is an AI-powered operations platform for restaurants. It connects to existing POS systems (Square, Lightspeed, Toast) via OAuth + webhooks and provides intelligent insights, forecasting, recommendations, and automated operations management.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite 5, React Router v6
- **Styling:** Tailwind CSS 3 with CSS variables for theming, shadcn/ui (Radix primitives)
- **State:** React Context (auth, app globals, demo mode), Zustand (notifications, availability), TanStack React Query (server state)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Forms:** react-hook-form + Zod validation
- **i18n:** i18next (Spanish default, English, Catalan)
- **Charts:** Recharts
- **Mobile:** Capacitor (iOS/Android)
- **AI/ML:** Prophet (forecasting via Modal Labs), Claude API (narratives + recommendations)

## Commands

```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint check
npm test             # Run tests once (vitest run)
npm run test:watch   # Run tests in watch mode
npm run preview      # Preview production build
```

## Project Structure

```
src/
  components/        # Feature-organized React components (~187 components)
    ui/              # shadcn/ui library components (48)
    layout/          # DashboardLayout, AppSidebar, TopBar
    [feature]/       # Domain components (sales, labour, inventory, ai, etc.)
  pages/             # Page-level route components
  contexts/          # AuthContext, AppContext, DemoModeContext
  hooks/             # Custom hooks (29) - data fetching, permissions, domain logic
  stores/            # Zustand stores (notifications, availability)
  lib/               # Utilities, forecast client, data generators
  integrations/      # Supabase client and auto-generated DB types
  types/             # Shared TypeScript types
  i18n/              # i18next config and locale files (es, en, ca)
  test/              # Test setup and test files
supabase/
  functions/         # Edge Functions (21) - forecast, AI, POS sync, payroll, etc.
  migrations/        # Database schema migrations
scripts/             # Helper scripts (data seeding, simulation)
```

## Code Conventions

### TypeScript

- Path alias: `@/*` maps to `./src/*`
- Strict mode is disabled (`noImplicitAny: false`, `strictNullChecks: false`)
- Target: ES2020 for app code, ES2022 for build tooling

### Components

- **UI primitives** go in `src/components/ui/` (shadcn/ui pattern)
- **Feature components** go in `src/components/[feature-name]/`
- **Pages** go in `src/pages/`
- Components use Tailwind classes for styling (no CSS modules or styled-components)

### State Management Pattern

```
Supabase DB -> React Query hooks -> Custom data hooks -> Components
Context API for auth/app state, Zustand for UI state (notifications)
```

### Styling

- Tailwind CSS with CSS variable-based theming
- Dark mode support via class strategy
- Custom fonts: Inter (sans), Plus Jakarta Sans (display)
- Use `cn()` utility (clsx + tailwind-merge) for conditional classes

### Internationalization

- All user-facing strings should use i18next translation keys
- Locale files: `src/i18n/locales/{es,en,ca}.json`
- Spanish is the default language

### Linting

- ESLint with typescript-eslint, react-hooks, and react-refresh plugins
- Unused variables rule is disabled
- `react-refresh/only-export-components` set to warn

### Testing

- Vitest with jsdom environment
- Testing Library for component tests
- Setup file mocks `window.matchMedia`

## Key Architecture Notes

- **Demo Mode:** Toggle between real Supabase data and simulated mock data via DemoModeContext
- **RBAC:** Role-based access (Owner, Manager, Supervisor, Employee) with location-scoped permissions
- **POS Integration:** Square POS via OAuth + incremental webhook sync
- **AI Integration:** Prophet forecasting and Claude API insights both run as Supabase Edge Functions
- **Feature Store:** Facts tables for time-series aggregation (15min, hourly, daily)
