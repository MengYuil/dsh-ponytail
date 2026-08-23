/**
 * Build the mode-filtered ponytail ruleset. Ported from the upstream
 * `hooks/ponytail-instructions.js`, so the injected text is byte-for-byte the
 * same ruleset every other host emits, filtered to the active intensity.
 *
 * @module @mengyuly/dsh-ponytail
 */

import { PONYTAIL_SKILL_BODY } from './content.ts'
import { DEFAULT_MODE, type PonytailRuntimeMode, normalizeRuntimeMode } from './modes.ts'

/**
 * Keep a line of the skill body only when it belongs to every mode or to the
 * active one. Both shape-sensitive spots (the intensity table rows and the
 * quoted worked examples) are keyed by a mode name; ordinary rules survive
 * verbatim, even ones whose prose starts with a mode-looking word.
 */
export function filterSkillBodyForMode(
  body: string,
  mode: PonytailRuntimeMode | null | undefined,
): string {
  const effective = normalizeRuntimeMode(mode) ?? DEFAULT_MODE

  return body
    .split(/\r?\n/)
    .filter((line) => {
      const tableLabel = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/)
      if (tableLabel) {
        const labelMode = normalizeRuntimeMode(tableLabel[1])
        if (labelMode) return labelMode === effective
      }

      // Require a quoted value: every worked example is `- lite: "..."`.
      // Without this, an ordinary rule bullet that happens to start with a
      // mode word (e.g. "- Full: ...") is silently dropped in every other
      // mode — prose meant to survive verbatim.
      const exampleLabel = line.match(/^-\s*([^:]+):\s*"/)
      if (exampleLabel) {
        const labelMode = normalizeRuntimeMode(exampleLabel[1])
        if (labelMode) return labelMode === effective
      }

      return true
    })
    .join('\n')
}

/** Minimal instruction set if the skill body can't be read (parity fallback). */
export function fallbackInstructions(mode: PonytailRuntimeMode): string {
  return 'PONYTAIL MODE ACTIVE — level: ' + mode + '\n\n'
    + 'You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.\n\n'
    + '## Persistence\n\n'
    + 'ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if unsure. Off only: "stop ponytail" / "normal mode".\n\n'
    + 'Current level: **' + mode + '**. Switch: `/ponytail lite|full|ultra`.\n\n'
    + '## The ladder\n\n'
    + 'Before any code, stop at the first rung that holds (the ladder runs after you understand the problem, not instead of it — read the code it touches and trace the real flow first):\n'
    + '1. Does this need to be built at all? (YAGNI)\n'
    + '2. Does it already exist in this codebase? Reuse what is already here, do not re-write it.\n'
    + '3. Does the standard library do this? Use it.\n'
    + '4. Does a native platform feature cover it? Use it.\n'
    + '5. Does an already-installed dependency solve it? Use it.\n'
    + '6. Can this be one line? Make it one line.\n'
    + '7. Only then: write the minimum code that works.\n\n'
    + 'Bug fix = root cause, not symptom: grep every caller of the function you touch and fix the shared function once (a smaller diff than one guard per caller); patching only the path the ticket names leaves a sibling caller broken.\n\n'
    + '## Rules\n\n'
    + 'No abstractions that were not requested. No avoidable dependencies. No boilerplate nobody asked for. '
    + 'Deletion over addition. Boring over clever. Fewest files possible. '
    + 'Ship the lazy version and question the complex request in the same response — never stall. '
    + 'Between two same-size stdlib options, pick the one correct on edge cases. '
    + 'Mark deliberate simplifications that cut a real corner with a known ceiling, using a `ponytail:` comment that names the ceiling and upgrade path.\n\n'
    + '## Output\n\n'
    + 'Code first. Then at most three short lines: what was skipped, when to add it. '
    + 'If the explanation is longer than the code, delete the explanation. '
    + 'Explanation the user explicitly asked for is not debt, give it in full.\n\n'
    + '## When NOT to be lazy\n\n'
    + 'Never simplify away: understanding the problem (read it fully and trace the real flow before picking a rung — a small diff you do not understand is just laziness dressed up as efficiency), input validation at trust boundaries, error handling that prevents data loss, '
    + 'security measures, accessibility basics, the calibration real hardware needs (the platform is never the spec ideal), anything the user explicitly asked to keep. '
    + 'Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind (assert-based demo/self-check or one small test file; no frameworks). Trivial one-liners need no test.\n\n'
    + '## Boundaries\n\n'
    + 'Ponytail governs what you build, not how you talk. "stop ponytail" or "normal mode": revert. Level persists until changed.'
}

/**
 * The full injected ruleset for one intensity: the "PONYTAIL MODE ACTIVE"
 * header plus the body filtered down to that mode's rows and examples.
 * Returns an empty string for `off` (ponytail contributes nothing).
 */
export function getPonytailInstructions(mode: PonytailRuntimeMode | null | undefined): string {
  const effective = normalizeRuntimeMode(mode) ?? DEFAULT_MODE
  if (effective === 'off') return ''

  const cached = instructionCache.get(effective)
  if (cached !== undefined) return cached

  let body: string
  try {
    body = filterSkillBodyForMode(PONYTAIL_SKILL_BODY, effective)
  } catch {
    return fallbackInstructions(effective)
  }
  const rendered = 'PONYTAIL MODE ACTIVE — level: ' + effective + '\n\n' + body
  instructionCache.set(effective, rendered)
  return rendered
}

/** Rendered rulesets are pure per mode; cache to keep every turn's bytes identical. */
const instructionCache = new Map<PonytailRuntimeMode, string>()
