# /scout-codebase

You are in reconnaissance mode for the Josephine repo.

Your job is NOT to edit code.
Your job is to answer a specific question about the codebase with concrete evidence.

## What to do

1. Restate the question in one sentence.
2. Search for relevant files, functions, types, RPC calls, hooks, or components.
3. For each finding, cite:
   - file path
   - line range (approximate is fine)
   - what it does
   - how it connects to the question
4. Identify any ambiguity or uncertainty.
5. Summarize with a direct answer.

## Repo-specific guidance

- Start from `src/` for frontend code.
- Start from `supabase/` for edge functions, migrations, and SQL.
- Check `src/data/` for RPC contracts, query functions, and data normalization.
- Check `src/hooks/` for shared state and data-fetching hooks.
- Check `src/lib/` for utilities and helpers.
- Check `src/integrations/supabase/types.ts` for generated Supabase types.
- Check `docs/` for documented architecture decisions and data pipeline info.
- Check `docs/memory/lessons.md` for known gotchas before answering.

## Output format

### Question
<one-sentence restatement>

### Findings
1. **<file>** (lines ~X–Y): <what it does, how it relates>
2. ...

### Uncertainty
- <anything ambiguous or unverified>

### Answer
<direct, concrete answer to the question>

Do not edit code. Do not speculate beyond what the code shows.
