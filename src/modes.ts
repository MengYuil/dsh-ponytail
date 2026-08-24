/**
 * Ponytail mode resolution: the default level comes from the
 * `PONYTAIL_DEFAULT_MODE` environment variable, then the optional config file
 * `~/.config/ponytail/config.json` (`defaultMode`), then `full`. Setting a
 * level via the `/ponytail` command is session-scoped and lives in an
 * in-memory, per-agent {@link ModeStore}.
 *
 * @module @mengyuly/dsh-ponytail
 */

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** One settable runtime intensity. `review` is command-only and never a default. */
export type PonytailRuntimeMode = 'off' | 'lite' | 'full' | 'ultra'

export const DEFAULT_MODE: PonytailRuntimeMode = 'full'

const RUNTIME_MODES: readonly PonytailRuntimeMode[] = ['off', 'lite', 'full', 'ultra']

/** Strip a UTF-8 BOM that Windows editors prepend before JSON.parse. */
function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '')
}

/**
 * Normalize free-form input to a runtime intensity. `null` for anything that
 * is not exactly `off`, `lite`, `full`, or `ultra`.
 */
export function normalizeRuntimeMode(mode: unknown): PonytailRuntimeMode | null {
  if (typeof mode !== 'string') return null
  const normalized = mode.trim().toLowerCase()
  return (RUNTIME_MODES as readonly string[]).includes(normalized)
    ? normalized as PonytailRuntimeMode
    : null
}

/**
 * Deactivation commands only match when the whole message is the command,
 * ignoring case and trailing punctuation. Matching the phrase anywhere would
 * turn ponytail off mid-task for ordinary requests like "add a normal mode
 * toggle".
 */
export function isDeactivationCommand(text: unknown): boolean {
  const raw = typeof text === 'string' ? text : ''
  // ASCII and CJK sentence enders are all ignorable trailing punctuation.
  const normalized = raw.trim().toLowerCase().replace(/[\s.!?。？！]+$/, '')
  return normalized === 'stop ponytail' || normalized === 'normal mode'
}

/** Config directory: `$XDG_CONFIG_HOME/ponytail`, `%APPDATA%\ponytail`, else `~/.config/ponytail`. */
export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, 'ponytail')
  if (process.platform === 'win32') {
    return join(env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'ponytail')
  }
  return join(homedir(), '.config', 'ponytail')
}

/** Absolute path of the optional `config.json`. */
export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), 'config.json')
}

/**
 * Resolve a default from the environment value, then a parsed config document,
 * then {@link DEFAULT_MODE}. Pure so callers can supply fixtures.
 */
export function resolveDefaultMode(
  envMode: unknown,
  configText: string | undefined,
): PonytailRuntimeMode {
  const fromEnv = normalizeRuntimeMode(envMode)
  if (fromEnv) return fromEnv

  if (configText !== undefined) {
    try {
      const config: unknown = JSON.parse(stripBom(configText))
      if (config && typeof config === 'object' && !Array.isArray(config)) {
        const fromConfig = normalizeRuntimeMode((config as { defaultMode?: unknown }).defaultMode)
        if (fromConfig) return fromConfig
      }
    } catch {
      // Missing or invalid config falls through to the built-in default.
    }
  }
  return DEFAULT_MODE
}

/**
 * One configuration problem worth surfacing exactly once. `read` covers
 * permission/IO failures, `json` malformed documents, `shape` a root that is
 * not an object, and `value` a `defaultMode` that is not a runtime level.
 */
export type DefaultModeIssueKind = 'read' | 'json' | 'shape' | 'value'

export interface DefaultModeIssue {
  readonly kind: DefaultModeIssueKind
  readonly detail: string
}

/** The resolved default plus the first config problem found, if any. */
export interface DefaultModeResolution {
  readonly mode: PonytailRuntimeMode
  readonly issue?: DefaultModeIssue
}

/**
 * Read the configured default with diagnostics: environment variable first,
 * then the config file, then `full`. A missing config file is normal and
 * yields no issue; a broken one yields the fallback mode plus one issue for
 * the caller to warn about once.
 */
export function readDefaultModeInfo(env: NodeJS.ProcessEnv = process.env): DefaultModeResolution {
  const path = configPath(env)
  const envMode = normalizeRuntimeMode(env.PONYTAIL_DEFAULT_MODE)

  let configText: string | undefined
  try {
    configText = readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // No config file is the normal state.
      return { mode: envMode ?? DEFAULT_MODE }
    }
    return {
      mode: envMode ?? DEFAULT_MODE,
      issue: { kind: 'read', detail: `${path}: ${(error as Error).message}` },
    }
  }

  // The config is inspected even when the env wins, so a broken file still
  // surfaces one warning instead of being silently ignored.
  let configIssue: DefaultModeIssue | undefined
  let fromConfig: PonytailRuntimeMode | null = null
  try {
    const parsed: unknown = JSON.parse(stripBom(configText))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      configIssue = { kind: 'shape', detail: `${path}: root must be a JSON object` }
    } else if ('defaultMode' in parsed) {
      fromConfig = normalizeRuntimeMode((parsed as { defaultMode?: unknown }).defaultMode)
      if (!fromConfig) {
        configIssue = { kind: 'value', detail: `${path}: defaultMode is not lite|full|ultra|off` }
      }
    }
  } catch (error) {
    configIssue = { kind: 'json', detail: `${path}: ${(error as Error).message}` }
  }

  if (envMode) return { mode: envMode, ...(configIssue ? { issue: configIssue } : {}) }
  if (configIssue) return { mode: DEFAULT_MODE, issue: configIssue }
  return { mode: fromConfig ?? DEFAULT_MODE }
}

/**
 * Read the configured default for this host: environment variable first, then
 * the config file, then `full`.
 */
export function readDefaultMode(env: NodeJS.ProcessEnv = process.env): PonytailRuntimeMode {
  return readDefaultModeInfo(env).mode
}

/**
 * Persist a new default level to the config file, preserving other fields.
 * Returns the normalized mode, or `null` when the value is not a runtime mode.
 * Throws when the write itself fails, so callers never report success for a
 * file that was not written.
 */
export function writeDefaultMode(mode: unknown, env: NodeJS.ProcessEnv = process.env): PonytailRuntimeMode | null {
  const normalized = normalizeRuntimeMode(mode)
  if (!normalized) return null

  const path = configPath(env)
  let config: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(stripBom(readFileSync(path, 'utf8')))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed as Record<string, unknown>
  } catch {
    // Missing or invalid config — start a fresh document.
  }
  config.defaultMode = normalized
  const text = `${JSON.stringify(config, null, 2)}\n`

  mkdirSync(dirname(path), { recursive: true })
  // Atomic replace: write a sibling temp file, then rename it over the target
  // so a crash mid-write never leaves a truncated config.json. The temp lives
  // in the target directory to stay on one filesystem (rename must not copy).
  // renameSync replaces existing files on POSIX and, via replace-if-exists
  // semantics, on Windows too; the pid+timestamp temp name keeps concurrent
  // writers from colliding on one temp path.
  const temp = join(dirname(path), `.config-${process.pid}-${Date.now()}.tmp`)
  try {
    writeFileSync(temp, text, 'utf8')
    renameSync(temp, path)
  } catch (error) {
    try { unlinkSync(temp) } catch { /* temp never created or already moved */ }
    throw new Error(`failed to write ${path}: ${(error as Error).message}`)
  }
  return normalized
}

/**
 * Session-scoped live mode. The absence of an entry means "use the configured
 * default", which matches the upstream behavior where each session starts from
 * the default until the user switches it.
 */
export class ModeStore {
  private readonly modes = new Map<string, PonytailRuntimeMode>()

  /** The mode in force for one agent, or the configured default. */
  modeFor(agentId: string, fallback: PonytailRuntimeMode): PonytailRuntimeMode {
    return this.modes.get(agentId) ?? fallback
  }

  /** Set the mode for one agent's session (session-scoped, survives until changed or disposal). */
  set(agentId: string, mode: PonytailRuntimeMode): void {
    this.modes.set(agentId, mode)
  }

  /** Forget a session-scoped override so the next lookup returns the default. */
  clear(agentId: string): void {
    this.modes.delete(agentId)
  }
}

/**
 * Compile `PONYTAIL_SUBAGENT_MATCHER` into a case-insensitive regex. An unset
 * matcher yields `null`; an invalid pattern stays fail-open (every agent gets
 * the ruleset) but is reported so the caller can warn exactly once.
 */
export function compileSubagentMatcher(raw: string | undefined): { matcher: RegExp | null; invalid: boolean } {
  if (!raw) return { matcher: null, invalid: false }
  try {
    return { matcher: new RegExp(raw, 'i'), invalid: false }
  } catch {
    return { matcher: null, invalid: true }
  }
}

/**
 * The stable per-session identity backing every mode override. DSH's `Agent`
 * type documents `id` as "the single identity shared with session", so the
 * agent id IS the SessionId: one entry per live session, never shared between
 * two sessions, and stable across the session's lifetime. Centralized so the
 * key choice lives in exactly one place.
 */
export function sessionKey(agent: { readonly id: string }): string {
  return agent.id
}

/** Whether a session is a subagent child (origin, or any delegation depth with no origin). */
export function isSubagentSession(header: {
  origin?: 'subagent'
  delegationDepth?: number
}): boolean {
  return header.origin === 'subagent' || (header.delegationDepth ?? 0) > 0
}

