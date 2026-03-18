# /log-lesson

You are in lesson-logging mode for the Josephine repo.

Your job is to record a new lesson in `memory/lessons.md`.

## When to use

Use this after:
- A bug revealed a reusable pattern
- A regression exposed a fragile surface
- A fix required non-obvious investigation
- Code, schema, or tooling drift caused confusion
- A repo-specific gotcha should be remembered for future sessions

## What to do

1. Ask the user (or infer from context) what happened.
2. Classify the area: UI / Data / Auth / Demo / DB / i18n / Edge Functions / Tooling / Testing / Security
3. Identify root cause, what failed, and how to prevent it.
4. Write the entry using the exact template from `memory/lessons.md`.
5. Append it under the `## New Entries` section at the bottom of the file.

## Entry template

```markdown
### <Lesson Title>

**Date:** YYYY-MM-DD
**Area:** <area>
**Root cause:** <short explanation>
**What failed:** <short explanation>
**Prevention:** <specific rule>
**Validation:** <specific checks>
**Notes:** <optional concise note>
```

## Rules

- Be specific and technical, not vague.
- The prevention rule must be actionable.
- The validation must be concrete (a command, a check, a verification step).
- Do not duplicate an existing lesson — check the file first.
- Use today's date.
- Keep it concise. One lesson per invocation.

## Output

After appending the lesson to the file, confirm:
- The title of the lesson added
- The area
- The prevention rule

Do not add speculative lessons. Only log things that actually happened.
