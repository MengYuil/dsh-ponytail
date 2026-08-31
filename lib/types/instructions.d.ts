/**
 * Structured ponytail ruleset composition. Each intensity is built from
 * explicit fragments — common rules, a never-cut safety boundary list, and
 * the mode's own rules — instead of filtering one Markdown body with regexes.
 * The three intensities therefore differ in their actual instructions, not
 * just in a table row.
 *
 * @module @mengyuly/dsh-ponytail
 */
import { type PonytailRuntimeMode } from './modes.ts';
/**
 * The injected ruleset for one intensity, composed from the structured
 * fragments above. Returns an empty string for `off` (ponytail contributes
 * nothing). Renders are pure per mode and cached so every turn's bytes stay
 * identical.
 */
export declare function getPonytailInstructions(mode: PonytailRuntimeMode | null | undefined): string;
