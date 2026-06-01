# Writing a custom check

Each check in `plc-st-review` is a self-contained module under `src/engine/checks/`. To add a new one:

1. **Pick a category name.** It must be a unique uppercase identifier (e.g. `MY_NEW_CHECK`). Add it to the `Category` union and to the `ALL_CATEGORIES` array in `src/engine/types.ts`.

2. **Write the check module.** It exports an object implementing the [`Check`](https://github.com/HeytalePazguato/plc-st-review/blob/main/src/engine/types.ts) interface:

   ```ts
   import type { Check } from '../types.js';

   export const myNewCheck: Check = {
     category: 'MY_NEW_CHECK',
     defaultSeverity: 'warn',
     run(ctx) {
       const findings = [];
       // Walk ctx.before / ctx.after symbol tables, compare,
       // and push Finding objects. Don't bake severity in stone, // the engine applies `severity_overrides` from the user's
       // config on top of whatever you return.
       return findings;
     },
   };
   ```

3. **Register it.** Add the import and entry to `src/engine/checks/index.ts`'s `allChecks()` function.

4. **Add a test.** Create `test/checks/<my-new-check>.test.ts` and exercise it with the AST fixture builder in `test/helpers/ast-fixtures.ts`. Aim for one test per branch (positive, negative, edge case).

5. **Document the check.** Add a row to the check table in the README and a short blurb explaining when it fires.

## Anatomy of the `ReviewContext`

The check function receives a `ReviewContext`:

| Field | What's in it |
|---|---|
| `ctx.config` | Resolved `.plc-st-review.yml`. Use `config.safetyCriticalPrefixes` etc. when your check's severity depends on user config. |
| `ctx.pairs` | One `FilePair` per changed file with `before` and `after` AST. |
| `ctx.before` | A `SymbolTable` aggregated across all "before" files: POUs, globals, enums, timers, call sites, CASE statements, array decls, FOR loops, pragmas, etc. |
| `ctx.after` | Same shape as `ctx.before`, for the "after" snapshot. |

Most checks just diff the two symbol tables. For checks that need raw ASTs (`COMMENT_ONLY`, `UNREACHABLE_CODE`), use `ctx.pairs` directly.

A few `SymbolTable` semantics worth knowing before you write a check:

- **`globals` / `enums` / `pous` / `pouLocals` are case-aware.** They're backed by a `CaseMap` whose `set` / `get` / `has` normalize the key based on the resolved `config.caseSensitive` setting (default insensitive). You don't need to lowercase keys yourself; just pass identifiers verbatim. Iteration (`.values()`, `for…of`) yields the original-cased keys the author wrote.
- **`globalDecls: GlobalVar[]`** is the source of truth when you need *every* global declaration (e.g. detecting two files declaring the same global). `globals.get(name)` returns the last-write-wins entry by name and is fine for "is this name a global?" predicates; `globalDecls` is what you want when you need to count, group, or anchor a finding to a specific declaration site.
- **Scopes are qualified names.** `cs.scope`, `p.qualifiedName`, `pouContainingLine(...)`'s return — all of them use the full `Namespace.FB_X.Method1` form (or `__global` / `<file>` for top-level / unattributed). Don't compare with bare names; either pass the qualified name through or use the [`scopeChain`](https://github.com/HeytalePazguato/plc-st-review/blob/main/src/engine/scope.ts) helper to walk outward.

## When NOT to write a new check

If your idea is a variation of an existing check, prefer extending the existing check (and giving it a config knob) over creating a new category. Each new category is one more concept the user has to learn, disable, or tune.
