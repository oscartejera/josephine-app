---
description: Log a lesson after a bug, regression, or non-obvious fix
---

# /log-lesson

Record a new lesson in `memory/lessons.md` after something went wrong or a non-obvious pattern was discovered.

## Steps

1. Identify what happened — the bug, regression, or gotcha.
2. Read `memory/lessons.md` to check for duplicates.
3. Classify the area: UI / Data / Auth / Demo / DB / i18n / Edge Functions / Tooling / Testing / Security
4. Append a new entry under `## New Entries` using this template:

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

5. Commit the change: `git add memory/lessons.md && git commit -m "docs: add lesson - <title>"`
6. Push: `git push origin main`

## Rules

- Be specific and technical, not vague.
- Prevention must be actionable.
- Validation must be a concrete command or check.
- Do not duplicate existing lessons.
- Only log things that actually happened.
