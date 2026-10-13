#!/usr/bin/env node
// Linux-only, real published DSH core; no user profiles, keys or paid requests.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve, isAbsolute } from 'node:path'
import { runNpm, tempWork, formatSpawnFailure } from './lib/run-command.mjs'

assert.equal(process.platform, 'linux', 'run this persistence integration on Linux or WSL')
const repoRoot = resolve(import.meta.dirname, '..')
const work = tempWork('ponytail-persistence-')
const output = join(work.dir, 'evidence')
try {
  for (const dir of ['runtime', 'plugin', 'evidence']) mkdirSync(join(work.dir, dir))
  writeFileSync(join(work.dir, 'cordis.yml'), '[]\n')
  const [packed] = JSON.parse(runNpm(['pack', '--json', '--pack-destination', work.dir], repoRoot).stdout)
  const tarball = isAbsolute(packed.filename) ? packed.filename : join(work.dir, packed.filename)
  runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '@deepseek-ai/dsh@0.2.0-rc.2'], join(work.dir, 'runtime'))
  runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], join(work.dir, 'plugin'))
  const results = []
  for (const phase of ['write', 'resume', 'crash', 'recover']) {
    const args = [join(repoRoot, 'scripts/lib/persistence-host.mjs'), work.dir, phase]
    const child = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 30000, cwd: work.dir })
    writeFileSync(join(output, `${phase}.log`), (child.stdout ?? '') + (child.stderr ?? ''))
    if (phase === 'crash') assert.equal(child.signal, 'SIGKILL', formatSpawnFailure(child, process.execPath, args, work.dir))
    else assert.equal(child.status, 0, formatSpawnFailure(child, process.execPath, args, work.dir))
    assert.ok(!/background write.*failed|cache stays stale|format v4 message requires|This turn failed/i.test(child.stdout + child.stderr))
    const result = JSON.parse(readFileSync(join(output, `${phase}-result.json`), 'utf8'))
    results.push(result)
    console.log(`test-persistence: ${phase}: V4 ${result.eventCount} events, ${result.calls.length} offline replies`)
  }
  assert.equal(new Set(results.map(result => result.pid)).size, 4, 'four independent host processes required')
  const sessionId = results.at(-1).sessionId
  const sessionRoot = join(work.dir, 'home/sessions')
  const groups = readdirSync(sessionRoot)
  assert.equal(groups.length, 1)
  const artifact = readFileSync(join(sessionRoot, groups[0], sessionId, 'session.v4.jsonl'), 'utf8')
  const [header, ...events] = artifact.trim().split('\n').map(line => JSON.parse(line))
  assert.equal(header.version, 4)
  assert.deepEqual(events, JSON.parse(readFileSync(join(output, 'recover-events.json'), 'utf8')))
  for (const [index, event] of events.entries()) assert.equal(event.seq, index)
  const completedTurns = events.filter(event => event.type === 'turn/end').length
  assert.equal(completedTurns, 12)
  const savedDefault = JSON.parse(readFileSync(join(work.dir, 'legacy-config/ponytail/config.json'), 'utf8'))
  assert.equal(savedDefault.defaultMode, 'ultra')
  writeFileSync(join(output, 'session.v4.jsonl'), artifact)
  writeFileSync(join(output, 'projection-checkpoint.json'), readFileSync(join(work.dir,
    `home/storages/session_projcache/sessions/${sessionId}.json`)))
  writeFileSync(join(output, 'summary.json'), JSON.stringify({ hostVersion: '0.2.0-rc.2',
    pluginVersion: packed.version, results, durableEventCount: events.length, completedTurns,
    externalModelCalls: 0, verdict: 'passed' }, null, 2))
  console.log('test-persistence: OK (real V4 writes, restart, SIGKILL after flush, exact-prefix recovery, continuation and cache)')
} finally {
  work.cleanup()
}
