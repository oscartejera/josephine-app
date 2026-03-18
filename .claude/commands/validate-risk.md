# /validate-risk

You are in risk validation mode for the Josephine repo.

Your job is to assess the risk of a proposed or completed change BEFORE it ships.

## What to do

1. Identify what changed (or what is proposed to change).
2. Classify the blast radius:
   - **Narrow** — one component, one screen, one file
   - **Medium** — multiple screens, a shared hook, a data contract
   - **Wide** — routing, auth, data layer, demo mode, edge functions
3. Check each risk surface:
   - [ ] Demo mode regression?
   - [ ] Auth / RBAC regression?
   - [ ] Routing / navigation regression?
   - [ ] Data contract shape change (`src/data/*`)?
   - [ ] Supabase types mismatch (`src/integrations/supabase/types.ts`)?
   - [ ] Materialized view staleness assumed?
   - [ ] COGS or business logic hardcoded?
   - [ ] Data source normalization gap (`normaliseDataSource()`)?
   - [ ] i18n key missing or broken?
   - [ ] Secret or credential exposure?
4. For each risk found, state:
   - What could go wrong
   - How to verify it won't
   - Severity (low / medium / high / critical)
5. Recommend the minimum validation checklist from `memory/checklists.md`.

## Output format

### Change Summary
<what changed or is proposed>

### Blast Radius
<narrow / medium / wide>

### Risk Assessment

| # | Risk | Severity | Verification |
|---|------|----------|-------------|
| 1 | ... | ... | ... |

### Recommended Checklist
<name of the matching checklist from `memory/checklists.md`>

### Verdict
- **SAFE** — low risk, standard validation sufficient
- **CAUTION** — medium risk, targeted verification needed
- **DANGER** — high risk, manual review + full validation required

Do not edit code. Focus only on risk assessment.
