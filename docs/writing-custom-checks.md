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

## When NOT to write a new check

If your idea is a variation of an existing check, prefer extending the existing check (and giving it a config knob) over creating a new category. Each new category is one more concept the user has to learn, disable, or tune.
