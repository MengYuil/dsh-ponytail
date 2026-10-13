// Test-only real DSH kernel. The only test double is the offline LLM adapter.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const [root, phase] = process.argv.slice(2)
assert.ok(root && ['write', 'resume', 'crash', 'recover'].includes(phase))
const output = join(root, 'evidence')
process.env.DSH_HOME = join(root, 'home')
process.env.XDG_CONFIG_HOME = join(root, 'legacy-config')
delete process.env.PONYTAIL_DEFAULT_MODE
delete process.env.PONYTAIL_SUBAGENT_MATCHER
process.env.DSH_TELEMETRY_DISABLED = '1'
process.chdir(root)
const load = name => import(pathToFileURL(join(root, 'runtime/node_modules/@deepseek-ai', name, 'lib/index.js')).href)
const { boot, loadOverlayPatches } = await load('dsh-app-boot')
const { LlmAdapter, createUserMessage } = await load('dsh-llm')
const base = loadOverlayPatches('ponytail-persistence-test', join(root, 'runtime/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml'))
const ids = new Set(['timer', 'llm', 'session', 'session-log-deepseek', 'typert', 'agent',
  'session-persistence-jsonl', 'storage', 'storage-json', 'storage-domain',
  'session-projection', 'session-projection-cache', 'commands', 'skill', 'tools',
  'system-prompt', 'agent-loop', 'deepseek-llm-api-extensions'])
const rows = base.flatMap(patch => patch.insert ?? []).filter(row => ids.has(row.id))
const patches = [{ insert: rows },
  { id: 'session-persistence-jsonl', config: { root: join(root, 'home/sessions'), compression: 'none' } },
  { id: 'storage-json', config: { root: join(root, 'home/storages') } },
  { id: 'session-projection-cache', config: { writeEveryEvents: 200, writeIntervalMs: 100 } },
  { insert: [{ id: 'ponytail-test', name: join(root, 'plugin/node_modules/@mengyuly/dsh-ponytail/lib/index.js') }] },
]
const ctx = await boot('ponytail-persistence-test', join(root, 'cordis.yml'), patches, undefined,
  pathToFileURL(join(root, 'runtime/package.json')).href)
const calls = []
class OfflineAdapter extends LlmAdapter {
  async *stream(options) {
    calls.push({ provider: options.provider, model: options.model })
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: 'persistence-check-ok' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'persistence-check-ok' } }
    yield { type: 'finish', reason: 'stop' }
  }
}
ctx.llm.registerAdapter(['ponytail-offline-test'], new OfflineAdapter())
for (const service of ['agents', 'commands', 'sessions', 'skills', 'sessionPersistence', 'sessionProjectionCache']) {
  assert.ok(ctx.get(service), `${service} must be mounted`)
}
const agentOptions = { provider: 'ponytail-offline-test', model: 'fixed-response' }
const sessionId = 'ponytail-persistence-flow'
const handle = phase === 'write'
  ? await ctx.agents.create({ sessionId, meta: { cwd: root }, agentOptions })
  : await ctx.agents.resume({ resumeSessionId: sessionId, agentOptions })
const agent = handle.agent
const executions = []
const command = async line => {
  const execution = await ctx.commands.execute(agent, line, [], new AbortController().signal)
  assert.equal(execution?.result.kind, 'success', JSON.stringify(execution))
  executions.push({ line, result: execution.result })
  return execution.result
}
const turn = async text => {
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
  await agent.whenIdle()
  assert.equal(agent.status, 'idle')
}
const inspect = async () => {
  assert.equal(await ctx.sessions.flush(agent.session), true, 'real durability listener must participate')
  const stored = await ctx.sessionPersistence.open(sessionId, 'read')
  try { return await stored.read() } finally { await stored.close() }
}
try {
  if (phase === 'write') {
    for (const mode of ['lite', 'full', 'ultra', 'off']) await command(`/ponytail ${mode}`)
    await command('/ponytail')
    await command('/ponytail reset')
    await command('/ponytail default ultra')
    await command('/ponytail full')
    await turn('ordinary-before-restart')
    await turn('普通模式')
    assert.match((await command('/ponytail status')).text, /off \(session override\)/)
    await turn('ordinary-after-deactivation')
  } else {
    assert.match((await command('/ponytail status')).text, /ultra \(configured default\)/)
    const restored = await inspect()
    const previousPhase = { resume: 'write', crash: 'resume', recover: 'crash' }[phase]
    const previousEvents = JSON.parse(readFileSync(join(output, `${previousPhase}-events.json`), 'utf8'))
    assert.deepEqual(restored.events.slice(0, previousEvents.length), previousEvents,
      'every committed event, identity and source must survive restart')
    await command('/ponytail lite')
    await turn(`ordinary-after-${phase}`)
    await turn('stop ponytail')
    await command('/ponytail reset')
    await turn(`continuation-after-${phase}`)
  }
  const stored = await inspect()
  const cachePath = join(root, `home/storages/session_projcache/sessions/${sessionId}.json`)
  let checkpoint
  const deadline = Date.now() + 5000
  do {
    try { checkpoint = JSON.parse(readFileSync(cachePath, 'utf8')).record } catch {}
    if (checkpoint && Object.values(checkpoint.rows).every(row => row.seq >= stored.events.length - 1)) break
    await delay(50)
  } while (Date.now() < deadline)
  assert.ok(checkpoint, 'projection checkpoint must reach disk')
  assert.ok(Object.values(checkpoint.rows).every(row => row.seq >= stored.events.length - 1),
    'checkpoint must advance through the final event, not remain stale')
  assert.equal(agent.session.header.version, 4)
  assert.ok(stored.events.some(event => event.type === 'assistant/message'))
  for (const event of stored.events.filter(event => event.type === 'turn/end')) {
    assert.equal(event.data.reason.kind, 'completed', 'every real loop turn must complete')
  }
  const sources = stored.events.flatMap(event => event.type === 'user/message' ? [event.data.source]
    : event.type === 'agent/inbox/spliced' ? event.data.inserted.map(message => message.source) : [])
  assert.ok(sources.some(source => source.kind === 'ponytail'))
  assert.ok(sources.every(source => source.kind !== 'plugin'), 'retired sources must never reach storage')
  const result = { phase, sessionId, pid: process.pid, formatVersion: 4, eventCount: stored.events.length,
    executions, calls, checkpointWatermarks: Object.fromEntries(Object.entries(checkpoint.rows).map(([key, row]) => [key, row.seq])) }
  writeFileSync(join(output, `${phase}-events.json`), JSON.stringify(stored.events, null, 2))
  writeFileSync(join(output, `${phase}-result.json`), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
  // Kill only this test-owned process, AFTER the real durability barrier.
  if (phase === 'crash') process.kill(process.pid, 'SIGKILL')
} finally {
  await handle.dispose()
  await ctx.fiber.dispose()
}
