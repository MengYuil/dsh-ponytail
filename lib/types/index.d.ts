/**
 * Ponytail: the "lazy senior developer" persona as a DeepSeek Harness plugin.
 *
 * One system-prompt section injects the mode-filtered ruleset every turn (the
 * always-on adapter), six runtime skills surface the review/audit/debt/gain/
 * help one-shots, six slash commands drive them from the command plane, and an
 * `agent/pre-step` listener honors the plain-text deactivation phrases.
 *
 * Mode is session-scoped and held in memory; the configured default resolves
 * from `PONYTAIL_DEFAULT_MODE` then `~/.config/ponytail/config.json` (see
 * {@link readDefaultMode}).
 *
 * @module @mengyuil/dsh-ponytail
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "ponytail";
export declare const inject: string[];
/** Extract the plain text of one user message (only its text blocks). */
export declare function messageText(message: {
    content: readonly {
        type: string;
        text?: string;
    }[];
}): string;
/** Whether any message in a claimed batch is exactly a deactivation command. */
export declare function containsDeactivation(messages: readonly {
    content: readonly {
        type: string;
        text?: string;
    }[];
}[]): boolean;
/**
 * Register the always-on ruleset section, the runtime skills, the slash
 * commands, and the plain-text deactivation listener.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map