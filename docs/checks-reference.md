# Checks reference

Every check `plc-st-review` ships with — what it catches, why it exists, how to configure it, an ST trigger, what the bot posts, and a suggested fix. See [`check-limitations.md`](check-limitations.md) for what each check deliberately *doesn't* catch.

**Live demo:** every check in this document fires at least once on [PR #1](https://github.com/HeytalePazguato/plc-st-review/pull/1), where you can see the exact inline comments the bot posts.

## Common settings (apply to every check)

Two knobs work on every check, set in `.plc-st-review.yml`:

```yaml
severity_overrides:
  CATEGORY_NAME: error      # raise / lower the severity for this category
disabled_checks:
  - CATEGORY_NAME           # turn the check off entirely
```

Each per-check page below only lists **additional** knobs (check-specific config, prefix lists, etc.).

## Diff-based checks

These compare the *before* and *after* trees of a PR. Every finding implies a change happened in this PR.

- [SIGNATURE_CHANGED](checks/diff-based/signature_changed.md)
- [CALL_SITE_OUTDATED](checks/diff-based/call_site_outdated.md)
- [TYPE_MISMATCH](checks/diff-based/type_mismatch.md)
- [ENUM_VALUE_REMOVED](checks/diff-based/enum_value_removed.md)
- [ENUM_VALUE_ADDED](checks/diff-based/enum_value_added.md)
- [TIMER_VALUE_CHANGED](checks/diff-based/timer_value_changed.md)
- [CONSTANT_VALUE_CHANGED](checks/diff-based/constant_value_changed.md)
- [COMMENT_ONLY](checks/diff-based/comment_only.md)
- [ARRAY_BOUNDS_CHANGED](checks/diff-based/array_bounds_changed.md)
- [STATE_UNHANDLED](checks/diff-based/state_unhandled.md)
- [UNREACHABLE_CODE](checks/diff-based/unreachable_code.md)
- [LOOP_BOUNDS_CHANGED](checks/diff-based/loop_bounds_changed.md)
- [POU_DELETED](checks/diff-based/pou_deleted.md)
- [POU_RENAMED](checks/diff-based/pou_renamed.md)
- [METHOD_ADDED_TO_INTERFACE](checks/diff-based/method_added_to_interface.md)
- [INHERITANCE_CHANGED](checks/diff-based/inheritance_changed.md)
- [PRAGMA_CHANGED](checks/diff-based/pragma_changed.md)
- [UNUSED_VAR_INTRODUCED](checks/diff-based/unused_var_introduced.md)
- [COUNTER_VALUE_CHANGED](checks/diff-based/counter_value_changed.md)

## Static integrity checks

These run on the *after* tree alone and surface bugs that compile but mis-behave. Each one filters out findings already present in the *before* tree so the check only flags **new** problems introduced in the PR.

- [ENUM_VALUE_UNUSED](checks/static-integrity/enum_value_unused.md)
- [ENUM_MEMBER_UNKNOWN](checks/static-integrity/enum_member_unknown.md)
- [ARRAY_INDEX_OUT_OF_BOUNDS](checks/static-integrity/array_index_out_of_bounds.md)
- [DIVISION_BY_ZERO](checks/static-integrity/division_by_zero.md)
- [INFINITE_LOOP](checks/static-integrity/infinite_loop.md)
- [LOOP_BOUNDS_REVERSED](checks/static-integrity/loop_bounds_reversed.md)

## FB-instance checks

These target standard IEC 61131-3 function-block patterns (`TON`, `CTU`, `R_TRIG`, `SR`/`RS`, etc.) — wiring mistakes that won't trip a normal compiler but produce wrong runtime behavior.

- [COUNTER_PV_ZERO](checks/fb-instance/counter_pv_zero.md)
- [TIMER_PT_ZERO](checks/fb-instance/timer_pt_zero.md)
- [TIMER_NOT_DRIVEN](checks/fb-instance/timer_not_driven.md)
- [EDGE_TRIG_REUSED](checks/fb-instance/edge_trig_reused.md)
- [FB_INSTANCE_DOUBLE_CALL](checks/fb-instance/fb_instance_double_call.md)
- [FB_INSTANCE_NEVER_CALLED](checks/fb-instance/fb_instance_never_called.md)
- [BISTABLE_DOMINANCE_MISMATCH](checks/fb-instance/bistable_dominance_mismatch.md)

## Code-quality and style checks

These are stylistic / hygiene checks. Most ship at `info` severity and stay off your blocking gate by default; raise them in `.plc-st-review.yml` once your team agrees on a convention.

- [EMPTY_STATEMENT](checks/code-quality/empty_statement.md)
- [UNUSED_RETURN_VALUE](checks/code-quality/unused_return_value.md)
- [ARRAY_SINGLE_ELEMENT](checks/code-quality/array_single_element.md)
- [VARIABLE_SHADOWING](checks/code-quality/variable_shadowing.md)
- [UNQUALIFIED_ENUM_CONSTANT](checks/code-quality/unqualified_enum_constant.md)
- [IDENTIFIER_CASE_MISMATCH](checks/code-quality/identifier_case_mismatch.md)
- [UNUSED_INPUT_VAR](checks/code-quality/unused_input_var.md)
- [INPUT_VAR_WRITTEN](checks/code-quality/input_var_written.md)
- [BOOL_COMPARISON](checks/code-quality/bool_comparison.md)
- [REAL_EQUALITY](checks/code-quality/real_equality.md)
- [MULTIPLE_EXIT_POINTS](checks/code-quality/multiple_exit_points.md)
- [ASSIGNMENT_IN_CONDITION](checks/code-quality/assignment_in_condition.md)
- [COMMENTED_OUT_CODE](checks/code-quality/commented_out_code.md)
- [RECURSIVE_CALL](checks/code-quality/recursive_call.md)
- [FORBIDDEN_SYMBOL](checks/code-quality/forbidden_symbol.md)
- [ADDRESS_OF_CONSTANT](checks/code-quality/address_of_constant.md)
- [UNUSED_OUTPUT_VAR](checks/code-quality/unused_output_var.md)
- [OUTPUT_VAR_READ_INTERNALLY](checks/code-quality/output_var_read_internally.md)
- [NESTED_COMMENTS](checks/code-quality/nested_comments.md)
- [NAMING_CONVENTION](checks/code-quality/naming_convention.md)

## Using a check in your PR

`plc-st-review` runs automatically once you've set up the GitLab or GitHub integration (see [`gitlab-setup.md`](gitlab-setup.md) / [`github-setup.md`](github-setup.md)). Every check above lands as either an inline comment on the relevant `.st` line or as part of the summary issue / discussion comment when the affected line falls outside the PR's diff hunks.

To suppress a check for a single repo, add it to `disabled_checks` in `.plc-st-review.yml`. To raise or lower its severity, use `severity_overrides`. See [`tuning-severities.md`](tuning-severities.md) for the tuning ramp.

To compose policy across many repos — naming conventions, severity profiles, forbidden symbols — use `extends:` to pull from shared preset files. See [`preset-packs.md`](preset-packs.md).
