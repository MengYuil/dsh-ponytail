# Ponytail Core Quality Design

## Goal

Improve Ponytail's one-shot review/audit/debt guidance and Chinese control UX
without changing the always-on Lite, Full, or Ultra prompts.

## Boundaries

- Keep `getPonytailInstructions()` byte-identical for every mode.
- Keep all public exports and package entry points unchanged.
- Require review and audit findings to cite observable code evidence.
- Do not claim exact removable-line totals when they cannot be counted from a
  concrete diff or file range.
- Match deactivation phrases only when they occupy the whole user message.
- Keep `src/` and the shipped `lib/` behavior aligned.

## Changes

1. Add deterministic core checks for mode identity, safety invariants, prompt
   byte budgets, English/Chinese deactivation, and runtime skill registration.
2. Add exact Chinese deactivation commands: `停止 ponytail`, `关闭 ponytail`,
   `普通模式`, and `正常模式`.
3. Add `/ponytail reset` and make `/ponytail status` report whether its value
   comes from a session override or the configured default.
4. Tighten `ponytail-review` and `ponytail-audit`: inspect consumers first,
   report only evidence-backed findings, distinguish safe deletion from
   verify-first candidates, and avoid invented precision.
5. Make `ponytail-debt` use `rg`/`git grep` with explicit generated-directory
   exclusions.
6. Clarify that `full` is the built-in fallback, not necessarily the effective
   configured default.

## Verification

- Core checks fail before each behavior change and pass afterwards.
- Existing distribution, bundle, pack, consumer, and release checks pass.
- `measure-prompt.mjs` output exactly matches the pre-change baseline:
  Lite 1920 bytes, Full 3052 bytes, Ultra 2839 bytes, Off 0 bytes.
