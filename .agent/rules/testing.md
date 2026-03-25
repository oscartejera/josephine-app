# Testing Rules

## Philosophy

- Every behavior change SHOULD have a test
- Tests document intent — they answer "why does this work this way?"
- Prefer integration tests over unit tests for data flows
- Prefer unit tests for pure logic (calculations, formatting, validation)

## TDD Cycle (Mandatory for Logic Changes)

1. **RED** — Write a failing test that describes the desired behavior
2. **GREEN** — Write minimum code to make it pass
3. **REFACTOR** — Clean up without changing behavior
4. **VERIFY** — Run full validation suite

## Test Anti-Patterns (NEVER do these)

- ❌ Testing implementation details (internal state, private methods)
- ❌ Tests that pass when the feature is broken
- ❌ Tests that break when refactoring without behavior change
- ❌ Snapshot tests for logic (use them only for UI structure)
- ❌ Mocking everything — prefer real dependencies when feasible
- ❌ Tests without assertions

## File Naming

- `[name].test.ts` for unit tests
- `[name].test.tsx` for component tests
- `e2e/[flow].spec.ts` for E2E tests

## Commands

```bash
# Run all tests
npm test -- --run

# Run specific test
npx vitest run src/data/__tests__/rpc-contracts.test.ts

# Run E2E
npm run test:e2e

# Type check
npx tsc --noEmit
```

## Coverage

- Critical paths (auth, payments, COGS, analytics): MUST have tests
- UI presentational components: tests optional, manual verification OK
- New hooks and utilities: MUST have tests
