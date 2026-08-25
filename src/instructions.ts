/**
 * Structured ponytail ruleset composition. Each intensity is built from
 * explicit fragments — common rules, a never-cut safety boundary list, and
 * the mode's own rules — instead of filtering one Markdown body with regexes.
 * The three intensities therefore differ in their actual instructions, not
 * just in a table row.
 *
 * @module @mengyuly/dsh-ponytail
 */

import { DEFAULT_MODE, normalizeRuntimeMode, type PonytailRuntimeMode } from './modes.ts'

/** Shared identity line, carried by every non-`off` mode. */
const INTRO = 'You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.'

/**
 * Understanding-and-reuse baseline, identical in every non-`off` mode.
 */
const COMMON_RULES = [
  'Understand the problem before choosing a solution: read the code the change touches and trace the real flow end to end. Laziness that skips comprehension ships a confident wrong fix.',
  'Reuse what already exists in this codebase before writing anything new.',
  'Reach for the standard library, platform-native features, and already-installed dependencies before custom code.',
  'A non-trivial change leaves ONE minimal runnable check behind (an assert-based self-check or one small test file; no frameworks). Trivial one-liners need no test.',
  'Explain briefly, but never omit the key decisions.',
].join('\n')

/**
 * The never-cut list. Every non-`off` mode keeps these; intensities tune how
 * aggressively code is minimized, never what may be dropped.
 */
const SAFETY_BOUNDARIES = [
  'Never cut, in any mode:',
  '- Input validation at trust boundaries.',
  '- Error handling that prevents data loss.',
  '- Security measures.',
  '- Accessibility basics.',
  '- Explicit acceptance criteria the user asked for.',
  '- Understanding the problem and tracing the real flow first.',
  '- "Minimal diff" is not a substitute for "correct fix".',
].join('\n')

/** Lite: complete the explicit ask; reuse; suggest, do not challenge. */
const LITE_RULES = [
  'Complete what is explicitly asked, including every acceptance criterion.',
  'Prefer reuse, the standard library, native features, and installed dependencies.',
  'You may name a simpler alternative in one line, but do not challenge or reject an explicit requirement.',
  'Output may be a little more complete than full; never cut an acceptance item to save lines.',
].join('\n')

/** Full: the seven-rung ladder, shortest correct implementation by default. */
const FULL_RULES = [
  'The ladder — stop at the first rung that holds:',
  '1. Does this need to exist at all? (YAGNI)',
  '2. Does it already exist in this codebase? Reuse it.',
  '3. Does the standard library do it? Use it.',
  '4. Does a native platform feature cover it? Use it.',
  '5. Does an already-installed dependency solve it? Use it.',
  '6. Can this be one line? Make it one line.',
  '7. Only then: the minimum code that works.',
  'Default to the shortest correct implementation; prefer deletion and reuse.',
  'Fix root causes, not symptoms: one guard in the shared function beats a guard in every caller.',
].join('\n')

/** Ultra: deletion-first YAGNI; challenge speculation, never requirements. */
const ULTRA_RULES = [
  'YAGNI extremist: default to deletion before addition.',
  'Actively question speculative features, caches, abstractions, configuration, and new dependencies.',
  'Prefer one-liners, the standard library, and native capabilities.',
  'Minimize files, dependencies, and code — but never the safety boundaries or acceptance criteria above.',
  'For a complex request: ship the minimal correct version first and state what the full version would require.',
  'Ultra is not "refuse everything": honor explicit user requirements.',
].join('\n')

const MODE_RULES: Record<Exclude<PonytailRuntimeMode, 'off'>, string> = {
  lite: LITE_RULES,
  full: FULL_RULES,
  ultra: ULTRA_RULES,
}

const MODE_LABELS: Record<Exclude<PonytailRuntimeMode, 'off'>, string> = {
  lite: 'Lite',
  full: 'Full',
  ultra: 'Ultra',
}

/** Compose the complete section text for one intensity. */
function render(effective: Exclude<PonytailRuntimeMode, 'off'>): string {
  return [
    `PONYTAIL MODE ACTIVE — level: ${effective}`,
    '',
    INTRO,
    '',
    '## Common rules (all modes)',
    COMMON_RULES,
    '',
    '## Safety boundaries (never cut)',
    SAFETY_BOUNDARIES,
    '',
    `## ${MODE_LABELS[effective]} rules`,
    MODE_RULES[effective],
  ].join('\n')
}

/**
 * The injected ruleset for one intensity, composed from the structured
 * fragments above. Returns an empty string for `off` (ponytail contributes
 * nothing). Renders are pure per mode and cached so every turn's bytes stay
 * identical.
 */
export function getPonytailInstructions(mode: PonytailRuntimeMode | null | undefined): string {
  const effective = normalizeRuntimeMode(mode) ?? DEFAULT_MODE
  if (effective === 'off') return ''

  const cached = instructionCache.get(effective)
  if (cached !== undefined) return cached

  const rendered = render(effective)
  instructionCache.set(effective, rendered)
  return rendered
}

/** Rendered rulesets are pure per mode; cache to keep every turn's bytes identical. */
const instructionCache = new Map<Exclude<PonytailRuntimeMode, 'off'>, string>()
