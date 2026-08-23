/**
 * Build the mode-filtered ponytail ruleset. Ported from the upstream
 * `hooks/ponytail-instructions.js`, so the injected text is byte-for-byte the
 * same ruleset every other host emits, filtered to the active intensity.
 *
 * @module @mengyuil/dsh-ponytail
 */
import { type PonytailRuntimeMode } from './modes.ts';
/**
 * Keep a line of the skill body only when it belongs to every mode or to the
 * active one. Both shape-sensitive spots (the intensity table rows and the
 * quoted worked examples) are keyed by a mode name; ordinary rules survive
 * verbatim, even ones whose prose starts with a mode-looking word.
 */
export declare function filterSkillBodyForMode(body: string, mode: PonytailRuntimeMode | null | undefined): string;
/** Minimal instruction set if the skill body can't be read (parity fallback). */
export declare function fallbackInstructions(mode: PonytailRuntimeMode): string;
/**
 * The full injected ruleset for one intensity: the "PONYTAIL MODE ACTIVE"
 * header plus the body filtered down to that mode's rows and examples.
 * Returns an empty string for `off` (ponytail contributes nothing).
 */
export declare function getPonytailInstructions(mode: PonytailRuntimeMode | null | undefined): string;
//# sourceMappingURL=instructions.d.ts.map