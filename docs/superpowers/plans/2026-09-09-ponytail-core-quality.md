# Ponytail Core Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve evidence quality and Chinese control UX while preserving the always-on prompt bytes and public API.

**Architecture:** Keep the existing system-prompt and runtime-skill architecture. Add a stdlib-only core regression script, then change only the deactivation predicate and one-shot skill bodies in both source and shipped bundle.

**Tech Stack:** Node.js 22/24, TypeScript, assert-based `.mjs` verification, prebuilt ESM bundle.

**Spec:** `docs/superpowers/specs/2026-09-09-ponytail-core-quality-design.md`

## Global Constraints

- Lite/Full/Ultra/off prompt output must remain byte-identical.
- No public export, package entry-point, or dependency changes.
- Whole-message matching only for deactivation commands.
- Do not invent benchmark, savings, or removable-line figures.

---

### Task 1: Core regression gate

**Files:**
- Create: `scripts/test-core.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.dev.json`

**Interfaces:**
- Consumes: exports from `src/instructions.ts`, `src/modes.ts`, and `src/content.ts`.
- Produces: `node scripts/test-core.mjs`, a zero-dependency CI check.

- [ ] Write assertions for exact prompt byte budgets, mode distinction, required safety phrases, off-mode emptiness, skill names, and English/Chinese deactivation.
- [ ] Run `node scripts/test-core.mjs`; expect failure because Chinese commands are not recognized.
- [ ] Keep the failing test for Task 2 and confirm every existing assertion passes up to that point.

### Task 2: Chinese deactivation

**Files:**
- Modify: `src/modes.ts`
- Modify: `lib/index.js`

**Interfaces:**
- Consumes: `isDeactivationCommand(text: unknown): boolean`.
- Produces: the same function signature with four additional exact commands.

- [ ] Add `停止 ponytail`, `关闭 ponytail`, `普通模式`, and `正常模式` to the exact-match predicate.
- [ ] Run `node scripts/test-core.mjs`; expect all deactivation cases to pass.

### Task 2b: Session override controls

**Files:**
- Modify: `src/modes.ts`
- Modify: `src/index.ts`
- Modify: `lib/index.js`
- Modify: `lib/types/modes.d.ts`

**Interfaces:**
- Consumes: `ModeStore`, the `/ponytail` command handler, and the configured default resolver.
- Produces: `ModeStore.has(agentId)`, `/ponytail reset`, and source-aware `/ponytail status` output.

- [ ] Add a failing test for detecting, setting, and clearing a session override.
- [ ] Add `ModeStore.has()` and mirror its declaration and bundle implementation.
- [ ] Add `/ponytail reset`; clear the override and steer the effective configured mode only when state changed.
- [ ] Make `/ponytail status` report `session override` or `configured default` without modifying state.
- [ ] Update command hints, Help, README, and bundle markers.
- [ ] Run `node scripts/test-core.mjs`; expect the override and Help checks to pass.

### Task 3: Evidence-backed one-shot skills

**Files:**
- Modify: `src/content.ts`
- Modify: `lib/index.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: existing `REVIEW_SKILL_BODY`, `AUDIT_SKILL_BODY`, `DEBT_SKILL_BODY`, and `HELP_SKILL_BODY` exports.
- Produces: unchanged skill registrations with tighter instructions.

- [ ] Update review guidance to require caller/usage evidence and count only concrete removable ranges.
- [ ] Update audit guidance to separate `safe-delete` from `verify-first` findings and cap output to the highest-value findings.
- [ ] Replace the debt scan example with `rg` plus `git grep` fallback and explicit exclusions.
- [ ] Clarify in Help that `full` is the fallback and `/ponytail status` reports the effective session mode.
- [ ] Mirror the same string changes into `lib/index.js` and document the user-visible behavior in README.

### Task 4: CI and release verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `scripts/verify-dist.mjs` only if the new core check reveals source/bundle drift not covered by existing validation.

**Interfaces:**
- Consumes: all repository verification scripts.
- Produces: a release-ready, clean working tree diff.

- [ ] Record the behavior changes and explicit prompt-preservation guarantee in `CHANGELOG.md`.
- [ ] Run `node scripts/test-core.mjs` and every existing CI command.
- [ ] Run `node scripts/measure-prompt.mjs`; require 1920/3052/2839/0 bytes.
- [ ] Run `git diff --check` and inspect the final diff for unrelated changes.
