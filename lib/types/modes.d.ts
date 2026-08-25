/**
 * Ponytail mode resolution: the default level comes from the
 * `PONYTAIL_DEFAULT_MODE` environment variable, then the optional config file
 * `~/.config/ponytail/config.json` (`defaultMode`), then `full`. Setting a
 * level via the `/ponytail` command is session-scoped and lives in an
 * in-memory, per-agent {@link ModeStore}.
 *
 * @module @deepseek-ai/dsh-ponytail
 */
/** One settable runtime intensity. `review` is command-only and never a default. */
export type PonytailRuntimeMode = 'off' | 'lite' | 'full' | 'ultra';
export declare const DEFAULT_MODE: PonytailRuntimeMode;
/**
 * Normalize free-form input to a runtime intensity. `null` for anything that
 * is not exactly `off`, `lite`, `full`, or `ultra`.
 */
export declare function normalizeRuntimeMode(mode: unknown): PonytailRuntimeMode | null;
/**
 * Deactivation commands only match when the whole message is the command,
 * ignoring case and trailing punctuation. Matching the phrase anywhere would
 * turn ponytail off mid-task for ordinary requests like "add a normal mode
 * toggle".
 */
export declare function isDeactivationCommand(text: unknown): boolean;
/** Config directory: `$XDG_CONFIG_HOME/ponytail`, `%APPDATA%\ponytail`, else `~/.config/ponytail`. */
export declare function configDir(env?: NodeJS.ProcessEnv): string;
/** Absolute path of the optional `config.json`. */
export declare function configPath(env?: NodeJS.ProcessEnv): string;
/**
 * Resolve a default from the environment value, then a parsed config document,
 * then {@link DEFAULT_MODE}. Pure so callers can supply fixtures.
 */
export declare function resolveDefaultMode(envMode: unknown, configText: string | undefined): PonytailRuntimeMode;
/**
 * One configuration problem worth surfacing exactly once. `read` covers
 * permission/IO failures, `json` malformed documents, `shape` a root that is
 * not an object, and `value` a `defaultMode` that is not a runtime level.
 */
export type DefaultModeIssueKind = 'read' | 'json' | 'shape' | 'value';
export interface DefaultModeIssue {
    readonly kind: DefaultModeIssueKind;
    readonly detail: string;
}
/** The resolved default plus the first config problem found, if any. */
export interface DefaultModeResolution {
    readonly mode: PonytailRuntimeMode;
    readonly issue?: DefaultModeIssue;
}
/**
 * Read the configured default with diagnostics. Priority:
 * `PONYTAIL_DEFAULT_MODE` → Cordis profile `defaultMode` → user config file →
 * `full`. A missing config file is normal and yields no issue; a broken one
 * yields the fallback mode plus one issue for the caller to warn about once.
 * @param env - the process environment to read.
 * @param profileMode - the validated Cordis profile `defaultMode`, or `null`
 *   when the profile config is absent or invalid (invalid values are reported
 *   by the caller; this function only consumes valid ones).
 */
export declare function readDefaultModeInfo(env?: NodeJS.ProcessEnv, profileMode?: PonytailRuntimeMode | null): DefaultModeResolution;
/**
 * Read the configured default for this host: environment variable first, then
 * the Cordis profile `defaultMode`, then the user config file, then `full`.
 */
export declare function readDefaultMode(env?: NodeJS.ProcessEnv, profileMode?: PonytailRuntimeMode | null): PonytailRuntimeMode;
/**
 * Why a `saved` default is not the effective one — for the `/ponytail default`
 * result message. `null` means the saved value is effective.
 */
export declare function defaultOverrideReason(env: NodeJS.ProcessEnv, profileMode: PonytailRuntimeMode | null): 'PONYTAIL_DEFAULT_MODE' | 'profile configuration' | null;
/**
 * Persist a new default level to the config file, preserving other fields.
 * Returns the normalized mode, or `null` when the value is not a runtime mode.
 * Throws when the write itself fails, so callers never report success for a
 * file that was not written.
 */
export declare function writeDefaultMode(mode: unknown, env?: NodeJS.ProcessEnv): PonytailRuntimeMode | null;
/**
 * Session-scoped live mode. The absence of an entry means "use the configured
 * default", which matches the upstream behavior where each session starts from
 * the default until the user switches it.
 */
export declare class ModeStore {
    private readonly modes;
    /** The mode in force for one agent, or the configured default. */
    modeFor(agentId: string, fallback: PonytailRuntimeMode): PonytailRuntimeMode;
    /** Set the mode for one agent's session (session-scoped, survives until changed or disposal). */
    set(agentId: string, mode: PonytailRuntimeMode): void;
    /** Forget a session-scoped override so the next lookup returns the default. */
    clear(agentId: string): void;
}
/**
 * Compile `PONYTAIL_SUBAGENT_MATCHER` into a case-insensitive regex. An unset
 * matcher yields `null`; an invalid pattern stays fail-open (every agent gets
 * the ruleset) but is reported so the caller can warn exactly once.
 */
export declare function compileSubagentMatcher(raw: string | undefined): {
    matcher: RegExp | null;
    invalid: boolean;
};
/**
 * The stable per-session identity backing every mode override. DSH's `Agent`
 * type documents `id` as "the single identity shared with session", so the
 * agent id IS the SessionId: one entry per live session, never shared between
 * two sessions, and stable across the session's lifetime. Centralized so the
 * key choice lives in exactly one place.
 */
export declare function sessionKey(agent: {
    readonly id: string;
}): string;
/** Whether a session is a subagent child (origin, or any delegation depth with no origin). */
export declare function isSubagentSession(header: {
    origin?: 'subagent';
    delegationDepth?: number;
}): boolean;
