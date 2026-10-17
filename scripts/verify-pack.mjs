#!/usr/bin/env node
/**
 * Pack the release tarball and verify it end to end:
 *
 *  1. `npm pack --json` succeeds and the packed version equals package.json.
 *  2. The tarball contains the full expected surface (LICENSE, README,
 *     CHANGELOG, dist-provenance.json, cordis.patch.yml, package.json, both
 *     runtime bundles, and every declaration file) and NOTHING under `src/`.
 *  3. The tarball installs into a clean temp dir and the installed bundle
 *     loads with the expected plugin shape — proving it does not secretly
 *     depend on the authoritative source tree.
 *
 * Honest dependency reporting: npm auto-installs the declared peerDependencies
 * (cordis and schemastery; optional DSH contracts are host-provided). The
 * installed dependency list is printed so the claim stays factual: the bundle
 * imports `@deepseek-ai/cordis` and `@deepseek-ai/schemastery` at runtime (an independent externals
 * check), while the manifest peers are host-contract declarations.
 *
 * Exits non-zero on any failure. Temporary files are removed unless
 * `PONYTAIL_VERIFY_KEEP_TEMP=1` is set.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, watchFile, unwatchFile } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { runNpm, tempWork } from './lib/run-command.mjs'
import { readTar } from './check-release-consistency.mjs'
import { getPonytailInstructions } from '../src/instructions.ts'
import { ponytailSkills } from '../src/content.ts'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

const work = tempWork('ponytail-pack-')
const formatWork = tempWork('ponytail-v4-format-')
try {
  const packed = runNpm(['pack', '--json', '--pack-destination', work.dir], repoRoot)
  const packJson = JSON.parse(packed.stdout)
  const [entry] = Array.isArray(packJson) ? packJson : [packJson]
  const tgz = isAbsolute(entry.filename) ? entry.filename : join(work.dir, entry.filename)

  check(entry.version === pkg.version, `packed version ${entry.version} != package.json version ${pkg.version}`)
  const required = [
    'LICENSE', 'README.md', 'README_EN.md', 'CHANGELOG.md', 'dist-provenance.json', 'cordis.patch.yml', 'package.json',
    'lib/index.js', 'lib/client.js', 'lib/invariant.js',
    'lib/types/index.d.ts', 'lib/types/modes.d.ts', 'lib/types/instructions.d.ts',
    'lib/types/content.d.ts', 'lib/types/invariant.d.ts',
  ]
  const paths = new Set(entry.files.map(f => f.path))
  for (const file of required) check(paths.has(file), `tarball missing ${file}`)
  // Development-only content must never ship in the tarball.
  const DEV_DIRS = ['scripts', 'src', 'tests', 'test', 'tools', '.github']
  for (const dir of DEV_DIRS) {
    check(![...paths].some(p => p === dir || p.startsWith(`${dir}/`)),
      `tarball must not contain development directory: ${dir}/`)
  }

  // The published package.json must not expose repository-maintainer commands:
  // scripts/ is excluded from the tarball, so any `scripts` entry that invokes
  // scripts/ would be an unavailable command after installation. No install
  // lifecycle hooks may exist either.
  const tarEntries = readTar(gunzipSync(readFileSync(tgz)))
  const packedManifest = JSON.parse(tarEntries.get('package/package.json').data.toString('utf8'))
  const packedScripts = packedManifest.scripts ?? {}
  const lifecycle = ['preinstall', 'install', 'postinstall']
  for (const name of lifecycle) {
    check(packedScripts[name] === undefined,
      `tarball package.json must not define install lifecycle script: ${name}`)
  }
  for (const [name, command] of Object.entries(packedScripts)) {
    check(typeof command === 'string' && !/\bscripts\//.test(command),
      `tarball package.json script "${name}" references scripts/ which is not published: ${command}`)
  }
  // Every main/types/exports target must exist inside the tarball.
  const entryTargets = []
  const collect = (value) => {
    if (typeof value === 'string') entryTargets.push(value)
    else if (value && typeof value === 'object') for (const v of Object.values(value)) collect(v)
  }
  collect(packedManifest.main)
  collect(packedManifest.types)
  collect(packedManifest.exports)
  const allowedTargets = new Set(['package.json', 'cordis.patch.yml'])
  for (const target of entryTargets) {
    const normalized = target.startsWith('./') ? target.slice(2) : target
    check(allowedTargets.has(normalized) || tarEntries.has(`package/${normalized}`),
      `tarball package.json entry target does not exist in the tarball: ${target}`)
  }

  // Install into a clean dir; npm will also auto-install the declared peers.
  // The bundle's runtime externals are cordis + schemastery, so both are
  // installed explicitly from the registry for the smoke.
  runNpm(['install', tgz, '@deepseek-ai/cordis@4', '@deepseek-ai/schemastery@3'], work.dir)

  // Optional host contracts must not pull a second DSH into a plugin-only install.
  const installedPkgDir = join(work.dir, 'node_modules', pkg.name)
  const scopedDir = join(work.dir, 'node_modules', '@deepseek-ai')
  const installed = existsSync(scopedDir) ? readdirSync(scopedDir).sort() : []
  const peers = Object.keys(pkg.peerDependencies ?? {}).sort()
  check(!installed.some(name => name.startsWith('dsh-')),
    'plugin-only npm installation must not automatically install DSH host contracts')
  console.log(`verify-pack: installed @deepseek-ai/* deps: ${installed.join(', ') || '(none)'}`)
  console.log(`verify-pack: declared peers: ${peers.join(', ')} (host-contract; the bundle imports @deepseek-ai/cordis + @deepseek-ai/schemastery at runtime)`)

  // Test-only dependency in a separate tree from the plugin-only installation.
  // Use the real V4 admission boundary, not a locally copied source predicate.
  runNpm(['install', '--ignore-scripts', '@deepseek-ai/dsh-session-format-v3-to-v4@0.1.7-alpha.1'], formatWork.dir)
  const { assertV4RowAdmission } = await import(pathToFileURL(join(formatWork.dir,
    'node_modules/@deepseek-ai/dsh-session-format-v3-to-v4/lib/index.js')).href)
  const admit = message => assertV4RowAdmission({ type: 'user/message', seq: 0, time: Date.now(), data: message })
  let preStep

  // The installed package (name read dynamically from package.json) must not
  // carry development scripts either.
  check(!existsSync(join(installedPkgDir, 'scripts')),
    `installed package contains scripts/ at ${join(installedPkgDir, 'scripts')}`)

  const mod = await import(pathToFileURL(join(installedPkgDir, 'lib', 'index.js')).href)
  check(mod.name === 'ponytail' && typeof mod.apply === 'function'
    && typeof mod.containsDeactivation === 'function' && typeof mod.messageText === 'function',
  'installed bundle does not expose the plugin shape')
  check(JSON.stringify(mod.inject) === JSON.stringify(['systemPrompt', 'skills']), 'installed bundle inject mismatch')
  check(typeof mod.Config === 'function', 'modern host must discover the plugin Config schema')
  check(mod.containsDeactivation([{ content: [{ type: 'text', text: '停止 ponytail。' }] }]),
    'installed bundle does not recognize Chinese deactivation')
  check(!mod.containsDeactivation([{ content: [{ type: 'text', text: '请增加“停止 ponytail”按钮' }] }]),
    'installed bundle deactivates on an embedded phrase')

  // Exercise the real installed command handler with a minimal Cordis-shaped
  // context: status must expose the source, and reset must clear an override.
  const commands = new Map()
  const skills = new Map()
  const cleanups = []
  let promptSection
  let preferences = { defaultMode: 'inherit', disabledSkills: [] }
  let refusePreferenceWrite = false
  let onPreferences = () => {}
  const settingsScope = {
    get: () => preferences,
    watch(listener) { onPreferences = listener; return () => { onPreferences = () => {} } },
    async update(patch) {
      if (refusePreferenceWrite) throw new Error('settings write refused')
      preferences = { ...preferences, ...patch }; onPreferences(preferences)
    },
  }
  const fakeCtx = {
    logger: { warn() {} },
    effect(factory) { cleanups.push(factory()) },
    on(event, listener) { if (event === 'agent/pre-step') preStep = listener },
    systemPrompt: { section(section) { promptSection = section } },
    skills: {
      register(skill) { skills.set(skill.name, skill); return () => skills.delete(skill.name) },
      async get(name) {
        const skill = skills.get(name)
        return skill && { ...skill, provider: 'ponytail' }
      },
    },
    inject(deps, install) {
      if (deps.includes('settings')) install({ ...fakeCtx, settings: { register() { return settingsScope } } })
      else install({ commands: { register(command) { commands.set(command.name, command.handler) } } })
    },
  }
  const previousDefault = process.env.PONYTAIL_DEFAULT_MODE
  const previousConfigHome = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = work.dir
  process.env.PONYTAIL_DEFAULT_MODE = 'lite'
  try {
    mod.apply(fakeCtx, {})
    for (const skill of ponytailSkills()) {
      check(skills.get(skill.name)?.content === skill.content,
        `installed ${skill.name} content must match the source mirror`)
    }
    const ponytail = commands.get('ponytail')
    check(typeof ponytail === 'function', 'installed bundle did not register /ponytail')
    const settingsAgent = { id: 'settings-session' }
    await settingsScope.update({ defaultMode: 'ultra', disabledSkills: ['ponytail-audit'] })
    check(!skills.has('ponytail-audit'), 'disabled skill must leave the actual catalog')
    check(promptSection.text({ agent: settingsAgent }) === getPonytailInstructions('lite'),
      'environment must still outrank settings')
    delete process.env.PONYTAIL_DEFAULT_MODE
    check(promptSection.text({ agent: settingsAgent }) === getPonytailInstructions('ultra'),
      'settings default must immediately reach the actual system prompt')
    process.env.PONYTAIL_DEFAULT_MODE = 'lite'
    await settingsScope.update({ defaultMode: 'inherit', disabledSkills: [] })
    check(skills.has('ponytail-audit'), 're-enabled skill must return to the actual catalog')
    const steered = []
    const injected = []
    const followed = []
    const agent = {
      id: 'verify-pack-session',
      session: { header: { cwd: work.dir } },
      steer(message) { steered.push(message) },
      inject(message) { injected.push(message) },
      followup(message) { followed.push(message) },
    }
    check(ponytail({ agent, rawInput: 'status' }).text.includes('configured default'),
      'status does not identify the configured default')
    ponytail({ agent, rawInput: 'ultra' })
    check(ponytail({ agent, rawInput: 'status' }).text.includes('session override'),
      'status does not identify a session override')
    check(ponytail({ agent, rawInput: 'reset' }).text.includes('Effective mode: lite'),
      'reset does not restore the configured default')
    check(ponytail({ agent, rawInput: 'status' }).text.includes('configured default'),
      'reset did not clear the session override')
    const runStatusCommand = async (rawInput, expectedNotice) => {
      const before = injected.length
      const result = await ponytail({ agent, rawInput })
      check(result.kind === 'success', `${rawInput || 'bare command'} must succeed`)
      check(injected.length === before + 1, `${rawInput || 'bare command'} must queue one non-waking notice`)
      check(injected.at(-1)?.content?.[0]?.text.includes(expectedNotice),
        `${rawInput || 'bare command'} must preserve its notice`)
      check(steered.length === 0 && followed.length === 0, 'mode/default notices must never request a model turn')
    }
    for (const mode of ['lite', 'full', 'ultra', 'off']) {
      await runStatusCommand(mode, mode === 'off' ? 'PONYTAIL MODE OFF' : `level: ${mode}`)
      const prompt = promptSection.text({ agent })
      check(prompt === getPonytailInstructions(mode),
        `installed ${mode} prompt must exactly match the source mirror`)
      check(mode === 'off' ? prompt === '' : prompt.includes(`level: ${mode}`),
        `${mode} must immediately affect the next system prompt`)
    }
    await runStatusCommand('', 'PONYTAIL MODE ACTIVE — level: lite')
    await runStatusCommand('', 'PONYTAIL MODE ACTIVE — level: lite')
    await runStatusCommand('full', 'level: full')
    await runStatusCommand('reset', 'level: lite')
    await runStatusCommand('default full', 'saved full, effective lite')
    delete process.env.PONYTAIL_DEFAULT_MODE
    await runStatusCommand('default off', 'new sessions start in off')
    await runStatusCommand('off', 'PONYTAIL MODE OFF')
    await runStatusCommand('', 'level: full')
    const noticeCount = injected.length
    ponytail({ agent, rawInput: 'status' })
    check(injected.length === noticeCount, 'status must not enqueue a notice')
    for (const skill of ['ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']) {
      const before = followed.length
      const result = await commands.get(skill)({ agent, rawInput: 'test notes' })
      check(result.kind === 'success' && followed.length === before + 1,
        `${skill} must still request an ordinary model turn`)
    }
    check(steered.length === 0, 'commands must never steer for a status notice')
    const beforeHelp = injected.length
    check(ponytail({ agent, rawInput: 'help' }).text.includes('/ponytail status'), 'help must be available without loading a model skill')
    check(injected.length === beforeHelp, 'help must not enqueue a model message')
    ponytail({ agent, rawInput: 'ultra' })
    const beforeSettings = injected.length
    await settingsScope.update({ defaultMode: 'lite', disabledSkills: ['ponytail-review'] })
    check(promptSection.text({ agent }) === getPonytailInstructions('ultra'), 'settings must not overwrite a session override')
    check(promptSection.text({ agent: settingsAgent }) === getPonytailInstructions('lite'), 'sessions without overrides must follow settings')
    const beforeFollowup = followed.length
    check((await commands.get('ponytail-review')({ agent, rawInput: '' })).kind === 'error', 'disabled skill invocation must be refused')
    check(followed.length === beforeFollowup, 'disabled skills must not request model work')
    check(injected.length === beforeSettings, 'settings changes must not enqueue messages')
    refusePreferenceWrite = true
    const failedSave = await ponytail({ agent, rawInput: 'default full' })
    check(failedSave.kind === 'error' && preferences.defaultMode === 'lite', 'failed saves must keep the previous default')
    check(injected.length === beforeSettings, 'failed saves must not enqueue a success notice')
    const legacyCommands = new Map()
    let legacyPrompt
    const legacyCtx = {
      ...fakeCtx,
      systemPrompt: { section(section) { legacyPrompt = section } },
      skills: { register() { return () => {} } },
      inject(deps, install) {
        if (deps.includes('commands')) install({ commands: { register(command) { legacyCommands.set(command.name, command.handler) } } })
      },
    }
    mod.apply(legacyCtx, { defaultMode: 'full' })
    const legacy = legacyCommands.get('ponytail')
    check(legacy({ agent, rawInput: 'default lite' }).kind === 'success', 'hosts without Settings must retain file persistence')
    check(legacyPrompt.text({ agent: settingsAgent }) === getPonytailInstructions('full'), 'profile must outrank a saved legacy default')
    check(legacy({ agent, rawInput: 'status' }).text.includes('profile configuration'), 'status must expose the overriding profile source')
    // Cover the file-backed default notice both with and without an override.
    mod.apply(legacyCtx, {})
    check(legacyCommands.get('ponytail')({ agent, rawInput: 'default full' }).kind === 'success',
      'legacy default without a profile override must succeed')
    // Profile-backed forms must refresh the effective rules, not only the UI.
    const liveEvents = new Map()
    const liveSkills = new Map()
    const liveCommands = new Map()
    let livePrompt, liveMode = 'ultra', disabled = ['ponytail']
    const volatile = get => ({ get, [Symbol.for('cosmokit.volatile.write')]: true })
    mod.apply({ ...fakeCtx,
      on(event, callback) { liveEvents.set(event, callback) },
      systemPrompt: { section(section) { livePrompt = section } },
      skills: { register(skill) { liveSkills.set(skill.name, skill); return () => liveSkills.delete(skill.name) } },
      inject(deps, install) {
        if (deps.includes('commands')) install({ commands: { register(command) { liveCommands.set(command.name, command.handler) } } })
      },
    }, { defaultMode: volatile(() => liveMode), disabledSkills: volatile(() => disabled) })
    check(liveSkills.has('ponytail'), 'profile settings must never disable the core pointer')
    const liveAgent = { id: 'live-profile-override', inject: admit }
    liveCommands.get('ponytail')({ agent: liveAgent, rawInput: 'lite' })
    // Wait for the real shared StatWatcher, not an assumed wall-clock delay.
    const liveFile = join(work.dir, 'ponytail/config.json')
    await new Promise((resolveChanged, reject) => {
      const done = () => { clearTimeout(timer); unwatchFile(liveFile, changed) }
      const changed = () => { done(); resolveChanged() }
      const timer = setTimeout(() => { done(); reject(new Error('legacy config watcher did not observe the edit')) }, 5000)
      watchFile(liveFile, { interval: 1000 }, changed)
      writeFileSync(liveFile, JSON.stringify({ defaultMode: 'full' }))
    })
    liveMode = 'inherit'
    disabled = ['ponytail-audit']
    liveEvents.get('loader/volatile-update')()
    check(livePrompt.text({ agent: settingsAgent }) === getPonytailInstructions('full'),
      'resetting a volatile profile mode must not retain its cached former mode')
    check(livePrompt.text({ agent: liveAgent }) === getPonytailInstructions('lite'),
      'live profile edits must preserve explicit session overrides')
    check(!liveSkills.has('ponytail-audit') && liveSkills.has('ponytail'),
      'volatile skill edits must take effect without disabling core rules')
    for (const text of ['stop ponytail', '普通模式']) {
      const decision = await preStep({ agent, messages: [{ content: [{ type: 'text', text }] }] },
        async () => ({ kind: 'enter', messages: [] }))
      check(decision.kind === 'enter' && decision.messages.length === 1,
        'plain-text deactivation must append its notice')
      injected.push(...decision.messages)
    }
    // All nine producer sites, including bare reactivation and both persistence
    // paths, must emit durable V4 messages without waking a model turn.
    for (const message of injected) {
      admit(message)
      check(message.source.kind === 'ponytail', 'mode notices must identify Ponytail as their producer')
    }
    for (const message of followed) {
      admit(message)
      check(message.source.kind === 'skill-invocation', 'explicit skill invocation attribution must remain unchanged')
    }
    // Also mount the shipped entry through real Cordis injection/lifecycle.
    // Host services remain controlled; the Context and V4 admission are real.
    const { Context } = await import(pathToFileURL(join(work.dir,
      'node_modules/@deepseek-ai/cordis/lib/index.js')).href)
    const ctx = new Context()
    const realCommands = new Map()
    ctx.provide('systemPrompt', { section() {} })
    ctx.provide('skills', { register() { return () => {} } })
    ctx.provide('commands', { register(command) { realCommands.set(command.name, command.handler) } })
    const fiber = ctx.plugin(mod, { defaultMode: 'full' })
    try {
      await fiber
      const handler = realCommands.get('ponytail')
      check(typeof handler === 'function', 'real Cordis must mount the Ponytail commands')
      const realAgent = { id: 'v4-cordis-session', inject: admit }
      for (const rawInput of ['lite', 'full', 'ultra', 'off', '', 'reset', 'default lite']) {
        check((await handler({ agent: realAgent, rawInput })).kind === 'success',
          `real Cordis ${rawInput || 'bare command'} must emit an admitted notice`)
      }
    } finally {
      await fiber.dispose()
    }
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup?.()
    if (previousDefault === undefined) delete process.env.PONYTAIL_DEFAULT_MODE
    else process.env.PONYTAIL_DEFAULT_MODE = previousDefault
    if (previousConfigHome === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = previousConfigHome
  }
  check(existsSync(join(installedPkgDir, 'lib', 'types', 'modes.d.ts')), 'installed package missing modes.d.ts')
} finally {
  work.cleanup()
  formatWork.cleanup()
}

if (failures.length > 0) {
  console.error(`verify-pack: FAILED\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`verify-pack: OK (${pkg.version}: contents, version match, installed smoke passed)`)
