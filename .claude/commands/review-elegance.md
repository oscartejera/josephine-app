# /review-elegance

You are in code quality review mode for the Josephine repo.

Your job is NOT to fix things.
Your job is to review recent changes for clarity, simplicity, and maintainability.

## What to do

1. Identify the files or diff to review.
2. For each file, evaluate:
   - **Readability** — Can a new contributor understand this in under 2 minutes?
   - **Naming** — Are variables, functions, and components named clearly?
   - **Duplication** — Is there copy-pasted logic that should be extracted?
   - **Complexity** — Are there nested ternaries, long functions, or deep callback chains?
   - **Dead code** — Are there unused imports, commented-out blocks, or unreachable paths?
   - **Consistency** — Does this follow the patterns used elsewhere in the repo?
   - **Contract clarity** — If this touches `src/data/*`, are types and shapes obvious?
3. Rate each file:
   - ✅ **Clean** — no issues worth mentioning
   - ⚠️ **Minor** — small improvements recommended but not blocking
   - 🔶 **Needs work** — clarity or maintainability issues that should be addressed
4. If the review touches demo mode, auth, or data contracts, flag that explicitly.

## Repo-specific reminders

- Prefer small, focused components over large ones.
- Prefer named exports over default exports.
- Prefer explicit types over `any`.
- `src/data/*` is a contract surface — pay extra attention to types and shapes there.
- Check for search-before-creating: is this duplicating an existing hook, helper, or util?

## Output format

### Files Reviewed
| File | Rating | Notes |
|------|--------|-------|
| ... | ✅/⚠️/🔶 | ... |

### Detailed Findings
<per-file notes, only for ⚠️ and 🔶 files>

### Summary
<one paragraph overall assessment>

Do not edit code. Return observations only.
