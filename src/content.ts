/**
 * Ponytail skill bodies, ported from github.com/DietrichGebert/ponytail and
 * lightly adapted to the DeepSeek Harness surface (slash commands and the
 * `skill` tool). The `ponytail` skill is a mode-aware pointer card: the actual
 * ruleset is injected per session as the mode-filtered `PONYTAIL MODE ACTIVE`
 * section (see `instructions.ts`) and must not be duplicated here. The other
 * five skills ship verbatim as runtime skills.
 *
 * @module @mengyuly/dsh-ponytail
 */

import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

/** The always-on lazy-senior-dev ruleset: also registered as a loadable skill. */
export const PONYTAIL_SKILL_BODY = `
You are the ponytail persona — the lazy senior developer. Your active ruleset
is ALREADY injected every turn as the "PONYTAIL MODE ACTIVE — level: <mode>"
system-prompt section, filtered to this session's intensity. Follow exactly
that section; do NOT reload, replace, or re-derive the ruleset from anywhere
else — the section is the single source of truth and it is mode-aware.

- Switch level: \`/ponytail lite|full|ultra|off\` (session-scoped)
- Query: \`/ponytail status\`
- Deactivate: "stop ponytail" / "normal mode"
- One-shot skills: \`/ponytail-review\`, \`/ponytail-audit\`, \`/ponytail-debt\`,
  \`/ponytail-gain\`, \`/ponytail-help\`
- Reference: https://github.com/DietrichGebert/ponytail
`

export const PONYTAIL_DESCRIPTION
  = 'Ponytail activation, modes, configuration, and help reference. The '
  + 'active ruleset is injected every turn by the system prompt; this skill '
  + 'is a pointer card. Use only when the user asks about Ponytail '
  + 'activation, modes, configuration, or help. Coding tasks already receive '
  + 'the active ruleset from the system prompt.'
export const REVIEW_SKILL_BODY = `
Review the current diff for unnecessary complexity. Inspect affected callers
and tests first. Report only when code evidence shows the replacement preserves
required behavior.

## Format

\`<file>:L<start>-<end>: <tag> <what>. Replacement: <simpler form>. Evidence: <observable reason>.\`

Tags:

- \`delete:\` dead code, unused flexibility, speculative feature. Replacement: nothing.
- \`stdlib:\` hand-rolled thing the standard library ships. Name the function.
- \`native:\` dependency or code doing what the platform already does. Name the feature.
- \`yagni:\` abstraction with one implementation, config nobody sets, layer with one caller.
- \`shrink:\` same logic, fewer lines. Show the shorter form.

Evidence must name an actual caller count, unused export, duplicate branch, or
equivalent stdlib/native behavior. A name that merely looks abstract is not
evidence. If preserving behavior is uncertain, omit the finding.

## Scoring

End with \`net: -<N> lines countable.\` only when concrete ranges make the total
countable; otherwise say \`net: uncounted.\` Nothing to cut: \`Lean already. Ship.\`

## Boundaries

Scope: over-engineering and complexity only. Correctness bugs, security holes,
and performance are explicitly out of scope. Route them to a normal review
pass, not this one. A single smoke test or \`assert\`-based
self-check is the ponytail minimum, not bloat, never flag it for deletion.
Does not apply the fixes, only lists them.
"stop ponytail-review" or "normal mode": revert to verbose review style.
`

export const REVIEW_DESCRIPTION
  = 'Code review focused exclusively on over-engineering. Finds what to delete: '
  + 'reinvented standard library, unneeded dependencies, speculative '
  + 'abstractions, dead flexibility. One line per finding: location, what to '
  + 'cut, what replaces it. Use when the user says "review for '
  + 'over-engineering", "what can we delete", "is this over-engineered", '
  + '"simplify review", or invokes /ponytail-review. Complements correctness-'
  + 'focused review, this one only hunts complexity.'

export const AUDIT_SKILL_BODY = `
Audit repository complexity. Skip generated, vendored, dependency, and build
output. Inspect manifests, callers, and tests. Return the top 10 findings.

## Format

\`<safe-delete|verify-first> <tag> <what>. Replace: <simpler form>. Evidence: <path:line + observed use>.\`

- \`safe-delete\`: no required consumer or behavior is lost.
- \`verify-first\`: consumers may remain; name the check needed before deletion.

Tags:

- \`delete:\` dead code or speculative flexibility.
- \`stdlib:\` hand-rolled standard-library behavior.
- \`native:\` dependency or code replaced by a platform feature.
- \`yagni:\` one-use abstraction, unset config, or one-caller layer.
- \`shrink:\` identical behavior in fewer lines.

Count only concrete ranges and manifest entries. End with
\`net: -<N> lines, -<M> deps countable.\` Use \`uncounted\` for either unknown.
Nothing to cut: \`Lean already. Ship.\`

## Boundaries

Scope: over-engineering and complexity only. Correctness bugs, security holes,
and performance are explicitly out of scope. Route them to a normal review
pass. Lists findings, applies nothing. One-shot.
"stop ponytail-audit" or "normal mode" to revert.
`

export const AUDIT_DESCRIPTION
  = 'Whole-repo audit for over-engineering. Like ponytail-review, but scans the '
  + 'entire codebase instead of a diff: a ranked list of what to delete, '
  + 'simplify, or replace with stdlib/native equivalents. Use when the user '
  + 'says "audit this codebase", "audit for over-engineering", "what can I '
  + 'delete from this repo", "find bloat", "ponytail-audit", or '
  + '/ponytail-audit. One-shot report, does not apply fixes.'

export const DEBT_SKILL_BODY = `
Collect \`ponytail:\` shortcut comments into a debt ledger. Each should name its
ceiling and upgrade path.

## Scan

Prefer ripgrep and exclude generated or dependency trees:

\`rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!lib/**' --glob '!dist/**' --glob '!build/**' '(#|//) ?ponytail:' .\`

If \`rg\` is unavailable, scan tracked files only:
\`git grep -n -E '(#|//) ?ponytail:'\`

Each hit is one row; the comment prefix excludes prose mentions.

## Output

One row per marker, grouped by file:

\`<file>:<line>, <what was simplified>. ceiling: <the limit named>. upgrade: <the trigger to revisit>.\`

The convention is \`ponytail: <ceiling>, <upgrade path>\`; copy both from the
comment. Add an owner only when requested, using
\`git blame -L<line>,<line> <file>\`.

Flag the rot risk: any \`ponytail:\` comment that names no upgrade path or
trigger gets a \`no-trigger\` tag, those are the ones that silently rot.

End with \`<N> markers, <M> with no trigger.\` Nothing found: \`No ponytail: debt. Clean ledger.\`

## Boundaries

Reads and reports only, changes nothing. To persist it, ask and it writes the
ledger to a file (e.g. \`PONYTAIL-DEBT.md\`). One-shot. "stop ponytail-debt" or
"normal mode" to revert.
`

export const DEBT_DESCRIPTION
  = 'Harvest every \`ponytail:\` comment in the codebase into a debt ledger, so '
  + 'the deliberate shortcuts and deferrals ponytail leaves behind get tracked '
  + 'instead of rotting into "later means never". Use when the user says '
  + '"ponytail debt", "/ponytail-debt", "what did ponytail defer", "list the '
  + 'shortcuts", "ponytail ledger", or "what did we mark to do later". '
  + 'One-shot report, changes nothing.'

export const GAIN_SKILL_BODY = `
Display this scoreboard when invoked. One-shot: do NOT change mode, write flag
files, or persist anything.

These are upstream Ponytail results, not measured guarantees for this DSH
adapter.

Savings depend on model, workload, prompt caching, tool usage, and execution
path. Already-minimal tasks may show little or no savings. Some reasoning
models may become more expensive because prompt and reasoning overhead can
exceed the saved output.

## 1. Upstream agentic reference

Real Claude Code sessions on real repositories; 12 feature tasks:

- Source LOC: ~\u221254%
- Tokens: ~\u221222%
- Cost: ~\u221220%
- Time: ~\u221227%
- Over-build tasks: \u221260\u201394%
- Safety tests: 100%

## 2. Upstream single-shot reference

5 everyday tasks (email validator, debounce, CSV sum, countdown timer, rate
limiter); 3 Claude models; single generation per task:

- Lines of code: \u221280\u201394%
- Cost (Claude): \u221242\u201375%
- Latency: ~3.1\u20135.8\u00d7 faster

## 3. DSH adapter status

Current DSH smoke tests provide directional evidence only. Stable token,
cost, and latency savings have not been established.

See the repository's DSH smoke reports for limited, non-statistical
directional evidence (docs/dsh-smoke-summary.md).

## 4. Honesty boundary

These are upstream benchmark medians, not this repo and not this DSH
adapter. NEVER print a per-repo savings number ("you saved X lines/tokens
here"): the unbuilt version was never written, so there is no real baseline
to subtract from in a live repo. The only real per-repo figures come from
\`/ponytail-debt\` (a counted ledger), and this card points there instead of
inventing one. Never claim "Ponytail always saves tokens/cost" or that this
adapter reproduces the upstream percentages. A missing cost figure (null) is
not a zero cost.

## Boundaries

One-shot display. Edits nothing, changes no mode.
"stop ponytail" or "normal mode": revert.
`

export const GAIN_DESCRIPTION
  = 'Less unnecessary work; token, cost, and latency effects depend on model '
  + 'and workload. Upstream benchmark reference, not a DSH-adapter guarantee. '
  + 'One-shot display, not a persistent mode, and not a per-repo number. '
  + 'Trigger: /ponytail-gain, "ponytail gain", "what does ponytail save", '
  + '"show ponytail impact", "ponytail scoreboard".'

export const HELP_SKILL_BODY = `
Display this one-shot reference card. Do not change mode or persist anything.

## Levels

| Level | Trigger | What change |
|-------|---------|-------------|
| **Lite** | \`/ponytail lite\` | Build what's asked, name the lazier alternative in one line. |
| **Full** | \`/ponytail\` | The ladder enforced: YAGNI → stdlib → native → one line → minimum. Default. |
| **Ultra** | \`/ponytail ultra\` | YAGNI extremist: deletion first, questions speculation — never cuts explicit requirements. |
| **Off** | \`/ponytail off\` | Ponytail stops injecting its ruleset for this session. |

Level is session-scoped until changed.

## Choosing a level

- **Lite**: Use for small, explicit changes or when the implementation is
  already clear. Completes explicit requirements without actively
  challenging them.
  Lite：小改动、需求明确时使用。
- **Full**: Use for new features, refactors, root-cause bug fixes, or tasks
  likely to invite unnecessary abstractions, dependencies, or custom
  components.
  Full：新功能、重构、根因修复、容易过度设计时使用。
- **Ultra**: Use for deliberate code cleanup and over-engineering removal.
  It questions speculative scope, but never removes explicit requirements,
  security, validation, accessibility, or data-loss protection.
  Ultra：专门清理冗余和过度抽象时使用。
- **Off**: Use when the task is non-coding, already fully specified, or when
  the fixed prompt overhead is not worthwhile.
  Off：非编码任务或已经明确到无需额外编码判断的任务。

Ponytail is not a guaranteed token-saving switch. It trades a small fixed
prompt cost for a chance to reduce unnecessary work. Do not default every
task to Ultra.

## Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| **ponytail** | \`/ponytail\` | Lazy mode itself. Simplest solution that works. |
| **ponytail-review** | \`/ponytail-review\` | Over-engineering review: \`L42: yagni: factory, one product. Inline.\` |
| **ponytail-audit** | \`/ponytail-audit\` | Whole-repo over-engineering audit: ranked list of what to delete. |
| **ponytail-debt** | \`/ponytail-debt\` | Harvest \`ponytail:\` shortcut comments into a tracked ledger. |
| **ponytail-gain** | \`/ponytail-gain\` | Upstream benchmark reference: less unnecessary work; token/cost/latency effects depend on model and workload. |
| **ponytail-help** | \`/ponytail-help\` | This card. |

## Deactivate

Say "stop ponytail", "normal mode", "停止 ponytail", or "正常模式".
\`/ponytail\` re-enables at the effective default (or \`full\` if it is \`off\`).
\`/ponytail reset\` clears the session override and follows the configured default.
\`/ponytail status\` reports mode and source; \`/ponytail off\` disables it.

## Configure Default Mode

The built-in fallback is \`full\`; check the effective mode with
\`/ponytail status\`. Change the default:

**Environment variable** (highest priority):
\`\`\`bash
export PONYTAIL_DEFAULT_MODE=ultra
\`\`\`

**Config file** (\`~/.config/ponytail/config.json\`, Windows: \`%APPDATA%\\ponytail\\config.json\`):
\`\`\`json
{ "defaultMode": "lite" }
\`\`\`

**Profile config** (per DSH profile, via the bundle row's \`config\` — e.g.
\`tui\` → lite):

\`\`\`yaml
- insert:
    - id: ponytail
      name: '@mengyuly/dsh-ponytail'
      config:
        defaultMode: lite
\`\`\`

Set \`"off"\` to disable auto-activation on session start, activate manually
with \`/ponytail\` when wanted. \`/ponytail default <mode>\` persists a new
default to the user config file; an exported \`PONYTAIL_DEFAULT_MODE\` or a
profile \`defaultMode\` still outranks the saved value for new sessions.

Resolution: session override > env var > profile config > config file > \`full\`.

## More

Full docs + examples: https://github.com/DietrichGebert/ponytail
`

export const HELP_DESCRIPTION
  = 'Quick-reference card for all ponytail modes, skills, and commands. '
  + 'One-shot display, not a persistent mode. Trigger: /ponytail-help, '
  + '"ponytail help", "what ponytail commands", "how do I use ponytail".'

/** Ordered set of runtime skills surfaced to the model catalog and `/` menu. */
export function ponytailSkills(): readonly SkillRegistration[] {
  return [
    {
      name: 'ponytail',
      source: 'runtime',
      description: PONYTAIL_DESCRIPTION,
      whenToUse: 'Use only when the user asks about Ponytail activation, modes, configuration, or help. Coding tasks already receive the active ruleset from the system prompt.',
      content: PONYTAIL_SKILL_BODY,
      // modelInvocable:false keeps the pointer card OUT of the model-facing
      // skill catalog (no repeated auto-load on ordinary coding turns) while
      // userInvocable:true keeps /ponytail and the user command menu working
      // (commands load skills via ctx.skills.get, which is not gated by
      // modelInvocable — verified against @deepseek-ai/dsh-skill + tool-skill).
      invocation: { modelInvocable: false, userInvocable: true },
    },
    {
      name: 'ponytail-review',
      source: 'runtime',
      description: REVIEW_DESCRIPTION,
      content: REVIEW_SKILL_BODY,
      invocation: { modelInvocable: true, userInvocable: true },
    },
    {
      name: 'ponytail-audit',
      source: 'runtime',
      description: AUDIT_DESCRIPTION,
      content: AUDIT_SKILL_BODY,
      invocation: { modelInvocable: true, userInvocable: true },
    },
    {
      name: 'ponytail-debt',
      source: 'runtime',
      description: DEBT_DESCRIPTION,
      content: DEBT_SKILL_BODY,
      invocation: { modelInvocable: true, userInvocable: true },
    },
    {
      name: 'ponytail-gain',
      source: 'runtime',
      description: GAIN_DESCRIPTION,
      content: GAIN_SKILL_BODY,
      invocation: { modelInvocable: true, userInvocable: true },
    },
    {
      name: 'ponytail-help',
      source: 'runtime',
      description: HELP_DESCRIPTION,
      content: HELP_SKILL_BODY,
      invocation: { modelInvocable: true, userInvocable: true },
    },
  ]
}
