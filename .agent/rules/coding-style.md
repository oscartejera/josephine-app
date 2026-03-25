# Coding Style Rules

## TypeScript / React

- **Immutability**: Prefer `const` over `let`. Never use `var`.
- **Explicit types**: Avoid `any`. Use generics or `unknown` instead.
- **Function components**: Always use function components, never class components.
- **Named exports**: Prefer named exports over default exports.
- **Barrel exports**: Use index.ts files for public APIs of feature folders.
- **No magic numbers**: Extract constants with descriptive names.
- **No nested ternaries**: Use early returns or switch statements.

## File Organization

- One component per file (exceptions: small helper components used only by parent).
- Test files colocated next to source: `Component.tsx` → `Component.test.tsx`
- Hooks in `hooks/`, utilities in `lib/`, types in `types/`.

## Naming Conventions

- **Components**: PascalCase (`SalesChart.tsx`)
- **Hooks**: camelCase with `use` prefix (`useSalesData.ts`)
- **Utils**: camelCase (`formatCurrency.ts`)
- **Types**: PascalCase with descriptive suffix (`SalesDataResponse`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **Event handlers**: `handle` prefix (`handleSubmit`, `handleClick`)

## Import Order

1. React / framework imports
2. Third-party libraries
3. Internal absolute imports (`@/components/...`)
4. Relative imports
5. Type imports (at the end)

Separate each group with a blank line.
