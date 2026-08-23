/**
 * Ponytail mode resolution: the default level comes from the
 * `PONYTAIL_DEFAULT_MODE` environment variable, then the optional config file
 * `~/.config/ponytail/config.json` (`defaultMode`), then `full`. Setting a
 * level via the `/ponytail` command is session-scoped and lives in an
 * in-memory, per-agent {@link ModeStore}.
 *
 * @module @mengyuly/dsh-ponytail
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
 * Read the configured default for this host: environment variable first, then
 * the config file, then `full`.
 */
export declare function readDefaultMode(env?: NodeJS.ProcessEnv): PonytailRuntimeMode;
/**
 * Persist a new default level to the config file, preserving other fields.
 * Returns the normalized mode, or `null` when the value is not a runtime mode.
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
 * Compile `PONYTAIL_SUBAGENT_MATCHER` into a case-insensitive regex, or `null`
 * — for "no matcher" and for invalid patterns, both of which mean the ruleset
 * applies to every agent (fail open, like upstream).
 */
export declare function compileSubagentMatcher(raw: string | undefined): RegExp | null;
/** Whether a session is a subagent child (origin, or any delegation depth with no origin). */
export declare function isSubagentSession(header: {
    origin?: 'subagent';
    delegationDepth?: number;
}): boolean;
//# sourceMappingURL=modes.d.ts.map