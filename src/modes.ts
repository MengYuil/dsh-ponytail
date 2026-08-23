/**
 * Ponytail mode resolution: the default level comes from the
 * `PONYTAIL_DEFAULT_MODE` environment variable, then the optional config file
 * `~/.config/ponytail/config.json` (`defaultMode`), then `full`. Setting a
 * level via the `/ponytail` command is session-scoped and lives in an
 * in-memory, per-agent {@link ModeStore}.
 *
 * @module @mengyuly/dsh-ponytail
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  const normalized = raw.trim().toLowerCase().replace(/[.!?\s]+$/, '')
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
 * Read the configured default for this host: environment variable first, then
 * the config file, then `full`.
 */
export function readDefaultMode(env: NodeJS.ProcessEnv = process.env): PonytailRuntimeMode {
  const path = configPath(env)
  let configText: string | undefined
  try {
    configText = readFileSync(path, 'utf8')
  } catch {
    configText = undefined
  }
  return resolveDefaultMode(env.PONYTAIL_DEFAULT_MODE, configText)
}

/**
 * Persist a new default level to the config file, preserving other fields.
 * Returns the normalized mode, or `null` when the value is not a runtime mode.
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
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
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
 * Compile `PONYTAIL_SUBAGENT_MATCHER` into a case-insensitive regex, or `null`
 * — for "no matcher" and for invalid patterns, both of which mean the ruleset
 * applies to every agent (fail open, like upstream).
 */
export function compileSubagentMatcher(raw: string | undefined): RegExp | null {
  if (!raw) return null
  try {
    return new RegExp(raw, 'i')
  } catch {
    return null
  }
}

/** Whether a session is a subagent child (origin, or any delegation depth with no origin). */
export function isSubagentSession(header: {
  origin?: 'subagent'
  delegationDepth?: number
}): boolean {
  return header.origin === 'subagent' || (header.delegationDepth ?? 0) > 0
}

