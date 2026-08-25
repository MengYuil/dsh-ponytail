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
 * @module @mengyuly/dsh-ponytail
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { renderSkillContent } from '@deepseek-ai/dsh-skill'
import { unwatchFile, watchFile } from 'node:fs'
import { ponytailSkills } from './content.ts'
import { getPonytailInstructions } from './instructions.ts'
import {
  compileSubagentMatcher,
  configPath,
  defaultOverrideReason,
  isDeactivationCommand,
  isSubagentSession,
  ModeStore,
  normalizeRuntimeMode,
  readDefaultMode,
  readDefaultModeInfo,
  sessionKey,
  writeDefaultMode,
  type PonytailRuntimeMode,
} from './modes.ts'

export const name = 'ponytail'
export const inject = ['systemPrompt', 'skills']

/**
 * Cordis profile-level configuration (set per profile via the bundle row's
 * `config` in a profile patch). `defaultMode` sits between the environment
 * variable and the user config file in the default-resolution chain.
 *
 * No `Config` schema is exported on purpose: cordis passes the raw config
 * through unvalidated then, so an invalid `defaultMode` falls back with a
 * one-time warning instead of failing the plugin mount.
 */
export interface PonytailConfig {
  /** Profile-scoped default intensity, e.g. `web → full`, `tui → lite`. */
  defaultMode?: unknown
}

/** Prompt-section order: after the deployment persona (0), before tool guidance (100–199). */
const SECTION_ORDER = 40

/** Build the one text-line notification a mode switch leaves for the model. */
function modeNotice(mode: PonytailRuntimeMode): string {
  return mode === 'off' ? 'PONYTAIL MODE OFF' : `PONYTAIL MODE CHANGED — level: ${mode}`
}

/** Extract the plain text of one user message (only its text blocks). */
export function messageText(message: { content: readonly { type: string; text?: string }[] }): string {
  const parts: string[] = []
  for (const block of message.content) {
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n')
}

/** Whether any message in a claimed batch is exactly a deactivation command. */
export function containsDeactivation(messages: readonly { content: readonly { type: string; text?: string }[] }[]): boolean {
  return messages.some(message => isDeactivationCommand(messageText(message)))
}

interface CommandDeps {
  readonly ctx: Context
  readonly store: ModeStore
  /** Validated Cordis profile `defaultMode`, or `null`. */
  readonly profileMode: PonytailRuntimeMode | null
  readonly defaultMode: () => PonytailRuntimeMode
  readonly setDefault: (mode: PonytailRuntimeMode) => void
}

/** Mode visible to one agent: its session override, else the configured default. */
function modeFor(deps: CommandDeps, agent: Agent): PonytailRuntimeMode {
  return deps.store.modeFor(sessionKey(agent), deps.defaultMode())
}

/**
 * Queue one skill's full `<skill_content>` rendering as the model's next
 * ordinary turn, with the same user-explicit `skill-invocation` source the
 * built-in gesture boundary uses.
 */
async function queueSkill(deps: CommandDeps, invocation: CommandInvocation, skill: string): Promise<CommandResult> {
  const loaded = await deps.ctx.skills.get(skill, {
    cwd: invocation.agent.session.header.cwd,
    signal: invocation.signal,
  })
  if (loaded === undefined) {
    return { kind: 'error', text: `skill "${skill}" is not available` }
  }
  const notes = invocation.rawInput.trim()
  const text = renderSkillContent(loaded) + (notes === '' ? '' : `\n\n${notes}`)
  invocation.agent.followup(createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'skill-invocation', name: skill, form: 'instructions' },
  }))
  return { kind: 'success', text: `Queued ${skill} for the agent.` }
}

function registerCommands(deps: CommandDeps, commandCtx: Context): void {
  commandCtx.commands.register({
    name: 'ponytail',
    description: 'Set or show Ponytail lazy senior dev intensity',
    input: { hint: '[status|default <mode>|lite|full|ultra|off]' },
    handler: ({ agent, rawInput }): CommandResult => {
      const input = rawInput.trim().toLowerCase()
      const [head, ...rest] = input.split(/\s+/).filter(Boolean)
      const partsHead = head ?? ''

      // `/ponytail default <mode>` persists the default for future sessions.
      // The env var (and the profile config) still outrank the saved value, so
      // the effective default is recomputed after the write instead of
      // trusting the saved one.
      if (partsHead === 'default') {
        let written: PonytailRuntimeMode | null
        try {
          written = writeDefaultMode(rest[0])
        } catch (error) {
          return { kind: 'error', text: `Failed to save default: ${(error as Error).message}` }
        }
        if (!written) {
          return { kind: 'error', text: 'Usage: /ponytail default [lite|full|ultra|off]' }
        }
        const effective = readDefaultMode(process.env, deps.profileMode)
        deps.setDefault(effective)
        if (written === effective) {
          agent.steer(createUserMessage({
            content: [{ type: 'text', text: `PONYTAIL DEFAULT SET — new sessions start in ${written}.` }],
            source: { kind: 'plugin', plugin: name },
          }))
          return { kind: 'success', text: `Ponytail default set — new sessions start in ${written}.` }
        }
        const reason = defaultOverrideReason(process.env, deps.profileMode) ?? 'PONYTAIL_DEFAULT_MODE'
        agent.steer(createUserMessage({
          content: [{ type: 'text', text: `PONYTAIL DEFAULT SET — saved ${written}, effective ${effective} (${reason}).` }],
          source: { kind: 'plugin', plugin: name },
        }))
        return { kind: 'success', text: `Saved default: ${written}. Effective default: ${effective}, overridden by ${reason}.` }
      }

      // `/ponytail status` is a pure query: report, never modify.
      if (input === 'status') {
        const current = modeFor(deps, agent)
        return { kind: 'success', text: `Ponytail mode: ${current}. Use /ponytail lite|full|ultra|off.` }
      }

      // Bare `/ponytail` reports the mode in force; when the session is off it
      // re-enables to the effective default (or `full` when that is off too).
      if (input === '') {
        const current = modeFor(deps, agent)
        const effectiveDefault = deps.defaultMode()
        if (current === 'off') {
          if (effectiveDefault === 'off') {
            deps.store.set(sessionKey(agent), 'full')
            agent.steer(createUserMessage({
              content: [{ type: 'text', text: 'PONYTAIL MODE CHANGED — level: full' }],
              source: { kind: 'plugin', plugin: name },
            }))
            return { kind: 'success', text: 'Ponytail re-enabled at full (the effective default is off).' }
          }
          deps.store.clear(sessionKey(agent))
          agent.steer(createUserMessage({
            content: [{ type: 'text', text: `PONYTAIL MODE ACTIVE — level: ${effectiveDefault}` }],
            source: { kind: 'plugin', plugin: name },
          }))
          return { kind: 'success', text: `Ponytail re-enabled. Effective default: ${effectiveDefault}.` }
        }
        agent.steer(createUserMessage({
          content: [{ type: 'text', text: `PONYTAIL MODE ACTIVE — level: ${current}` }],
          source: { kind: 'plugin', plugin: name },
        }))
        return { kind: 'success', text: `Ponytail mode: ${current}. Use /ponytail lite|full|ultra|off.` }
      }

      const mode = normalizeRuntimeMode(input)
      if (!mode) {
        return { kind: 'error', text: 'Usage: /ponytail [status|default <mode>|lite|full|ultra|off]' }
      }
      deps.store.set(sessionKey(agent), mode)
      agent.steer(createUserMessage({
        content: [{ type: 'text', text: modeNotice(mode) }],
        source: { kind: 'plugin', plugin: name },
      }))
      return { kind: 'success', text: mode === 'off' ? 'Ponytail mode off.' : `Ponytail mode set to ${mode}.` }
    },
  })

  for (const skill of ['ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']) {
    commandCtx.commands.register({
      name: skill,
      description: descriptionFor(skill),
      input: { hint: '[notes]' },
      handler: invocation => queueSkill(deps, invocation, skill),
    })
  }
}

/** One-line command catalog copy, kept beside the skills for discovery parity. */
function descriptionFor(skill: string): string {
  switch (skill) {
    case 'ponytail-review': return 'Over-engineering review of the current changes'
    case 'ponytail-audit': return 'Whole-repo over-engineering audit (what can be deleted)'
    case 'ponytail-debt': return 'Harvest ponytail: comments into a tracked debt ledger'
    case 'ponytail-gain': return 'Show ponytail measured-impact scoreboard (less code, cost, time)'
    case 'ponytail-help': return 'Quick reference for ponytail levels, skills, and commands'
    default: return `Run the ${skill} skill`
  }
}

/**
 * Register the always-on ruleset section, the runtime skills, the slash
 * commands, and the plain-text deactivation listener.
 */
export function apply(ctx: Context, config: PonytailConfig = {}): void {
  // Cordis profile-level default (set per profile via the bundle row's
  // `config`). Read once at mount: cordis exposes no stable public config-
  // change event (only the internal update waterfall), so profile changes
  // apply on the next profile start — the user config file keeps its
  // hot-reload behavior.
  const profileMode = normalizeRuntimeMode(config.defaultMode)
  if (config.defaultMode !== undefined && profileMode === null) {
    ctx.logger.warn(`[ponytail] profile config defaultMode is not lite|full|ultra|off: ${JSON.stringify(config.defaultMode)}; falling back`)
  }

  // Process-level effective default, resolved lazily so a broken config warns
  // once (not per request); `/ponytail default` and the watcher refresh it.
  let defaultMode: PonytailRuntimeMode | null = null
  const warned = new Set<string>()
  const warnOnce = (key: string, message: string): void => {
    if (warned.has(key)) return
    warned.add(key)
    ctx.logger.warn(`[ponytail] ${message}`)
  }
  const refreshDefault = (): PonytailRuntimeMode => {
    const resolution = readDefaultModeInfo(process.env, profileMode)
    if (resolution.issue) {
      warnOnce(`default:${resolution.issue.kind}`, `${resolution.issue.detail}; using ${resolution.mode}`)
    }
    defaultMode = resolution.mode
    return defaultMode
  }
  const readDefault = (): PonytailRuntimeMode => (defaultMode ?? refreshDefault())
  const setDefault = (mode: PonytailRuntimeMode): void => { defaultMode = mode }

  const store = new ModeStore()
  const matcherResult = compileSubagentMatcher(process.env.PONYTAIL_SUBAGENT_MATCHER)
  const matcher = matcherResult.matcher
  if (matcherResult.invalid) {
    warnOnce(
      'matcher:invalid',
      'PONYTAIL_SUBAGENT_MATCHER is not a valid regular expression; ignoring it (fail-open).',
    )
  }

  // Hot-reload the config-file default: edits apply to sessions without an
  // override on their next request, no restart. A transiently invalid file
  // keeps the last known good default instead of snapping back to `full`.
  // Env-var changes still require a restart, since the environment is fixed
  // once the process starts.
  const configFile = configPath()
  const onConfigChange = (): void => {
    const resolution = readDefaultModeInfo(process.env, profileMode)
    if (resolution.issue) {
      warnOnce(`config:${resolution.issue.kind}`, `${resolution.issue.detail}; keeping the previous default`)
      return
    }
    defaultMode = resolution.mode
  }
  watchFile(configFile, { interval: 1000 }, onConfigChange).unref()
  ctx.effect(() => () => { unwatchFile(configFile, onConfigChange) }, 'ponytail: config hot reload')

  // Session-scoped overrides live only as long as their session: an agent's
  // disposal releases its entry so a long-running host never accumulates
  // stale keys.
  ctx.on('agent/disposed', ({ agent }) => { store.clear(sessionKey(agent)) })

  // Always-on ruleset for the session's own agent. The built-in spawn subagent
  // tool runs fresh, isolated children that do not carry the persona; the
  // optional matcher suppresses the section for subagent sessions (those the
  // harness does surface it to) whose preset does not match.
  ctx.systemPrompt.section({
    name: 'ponytail',
    order: SECTION_ORDER,
    text: ({ agent }) => {
      if (agent && matcher && isSubagentSession(agent.session.header)) {
        const preset = agent.session.header.agentPreset
        if (preset && !matcher.test(preset)) return ''
      }
      const mode = agent ? store.modeFor(sessionKey(agent), readDefault()) : readDefault()
      return getPonytailInstructions(mode)
    },
  })

  // Six runtime skills: discoverable in the model catalog and the slash menu.
  for (const skill of ponytailSkills()) {
    ctx.skills.register(skill)
  }

  // Human slash commands; the child activates only when the TUI/web mounts a
  // command registry (headless automation never composes it).
  ctx.inject(['commands'], (commandCtx) => {
    registerCommands({ ctx, store, profileMode, defaultMode: readDefault, setDefault }, commandCtx)
  })

  // Plain-text "stop ponytail" / "normal mode" deactivation, matched on the
  // whole message only, before the step's request derives.
  ctx.on('agent/pre-step', async (payload, next): Promise<PreStepDecision> => {
    const deactivated = containsDeactivation(payload.messages)
    if (deactivated) store.set(sessionKey(payload.agent), 'off')
    const decision = await next()
    if (deactivated && decision.kind === 'enter') {
      return {
        kind: 'enter',
        messages: [
          ...decision.messages,
          createUserMessage({
            content: [{ type: 'text', text: 'PONYTAIL MODE OFF' }],
            source: { kind: 'plugin', plugin: name },
          }),
        ],
      }
    }
    return decision
  })
}
