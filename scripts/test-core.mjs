#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { ponytailSkills } from '../src/content.ts'
import { getPonytailInstructions } from '../src/instructions.ts'
import { isDeactivationCommand, ModeStore } from '../src/modes.ts'

// Guard against accidental bloat, not against restoring required upstream rules.
const promptBudgets = { lite: 4000, full: 4900, ultra: 5100, off: 0 }
const prompts = Object.fromEntries(
  Object.keys(promptBudgets).map(mode => [mode, getPonytailInstructions(mode)]),
)

for (const [mode, budget] of Object.entries(promptBudgets)) {
  assert.ok(Buffer.byteLength(prompts[mode]) <= budget, `${mode} prompt must stay within its reviewed budget`)
}
assert.equal(prompts.off, '', 'off mode must inject nothing')
assert.equal(new Set([prompts.lite, prompts.full, prompts.ultra]).size, 3, 'active modes must remain distinct')
for (const mode of ['lite', 'full', 'ultra']) {
  assert.match(prompts[mode], /Input validation at trust boundaries/, `${mode} must preserve input validation`)
  assert.match(prompts[mode], /Error handling that prevents data loss/, `${mode} must preserve data-loss protection`)
  assert.match(prompts[mode], /one minimal runnable check/, `${mode} must require exactly one minimal check`)
  assert.match(prompts[mode], /no framework or fixtures, no per-function suites unless asked/, `${mode} must not overbuild test infrastructure`)
  assert.match(prompts[mode], /Root-cause fixes over symptom patches/, `${mode} must preserve root-cause fixes`)
  assert.match(prompts[mode], /observable done condition/, `${mode} must define an observable outcome before editing`)
  assert.match(prompts[mode], /Resolve uncertainty with evidence/, `${mode} must investigate instead of guess`)
  assert.match(prompts[mode], /inspect the final diff/, `${mode} must review its actual changes`)
  assert.match(prompts[mode], /Do not weaken a test/, `${mode} must diagnose failed validation honestly`)
  assert.match(prompts[mode], /Report only verified results/, `${mode} must not overclaim outcomes`)
  assert.match(prompts[mode], /ladder is a reflex, not a research project/, `${mode} must keep the ladder lightweight`)
  assert.match(prompts[mode], /grep every caller/, `${mode} must require checking sibling callers before a fix`)
  assert.match(prompts[mode], /same-size stdlib options.*edge cases/, `${mode} must not prefer a flimsier algorithm`)
  assert.match(prompts[mode], /ponytail: <ceiling>, <upgrade path>/, `${mode} must connect deliberate shortcuts to the debt skill`)
  assert.match(prompts[mode], /Hardware calibration/, `${mode} must preserve physical-world tuning`)
  assert.match(prompts[mode], /explicitly requested explanations in full/, `${mode} must not truncate requested explanations`)
  assert.match(prompts[mode], /coding tasks only/, `${mode} must not alter unrelated prose or translation`)
  assert.match(prompts[mode], /ACTIVE EVERY RESPONSE/, `${mode} must explicitly preserve the active rules across turns`)
  assert.match(prompts[mode], /Never add a dependency when a few lines suffice/, `${mode} must prohibit unnecessary new dependencies`)
  assert.match(prompts[mode], /fewest files/, `${mode} must minimize touched files without sacrificing correctness`)
  assert.match(prompts[mode], /insists on the full version.*without re-arguing/, `${mode} must respect the user's final scope decision`)
  assert.match(prompts[mode], /no per-function suites unless asked.*Trivial one-liners need no extra test/, `${mode} must preserve upstream testing limits`)
  const rungs = [...prompts[mode].matchAll(/^([1-7])\. /gm)].map(match => Number(match[1]))
  assert.deepEqual(rungs, [1, 2, 3, 4, 5, 6, 7], `${mode} must carry the complete ordered ladder once`)
}
assert.match(prompts.lite, /Execute the direct request without ceremony/, 'lite must optimize for direct execution')
assert.match(prompts.lite, /must name a simpler alternative in one line.*user chooses/i, 'lite must require, not merely permit, an alternative')
assert.match(prompts.lite, /ladder guides suggestions, not an override/, 'lite must not silently become full mode')
assert.match(prompts.full, /stop at the first rung that holds/, 'full must keep the reuse-first decision ladder')
assert.match(prompts.ultra, /Require evidence before adding/, 'ultra must make deletion-first decisions evidence-based')
for (const mode of ['full', 'ultra']) {
  assert.match(prompts[mode], /stop at the first rung that holds/, `${mode} must enforce ladder ordering`)
  assert.match(prompts[mode], /same response.*Never stall on a defaultable answer/, `${mode} must not turn simplification into a blocking interview`)
}

for (const command of [
  'stop ponytail', 'NORMAL MODE!',
  '停止 ponytail', '关闭 ponytail。', '普通模式', '正常模式！',
]) {
  assert.equal(isDeactivationCommand(command), true, `${JSON.stringify(command)} must deactivate Ponytail`)
}
for (const prose of [
  'add a normal mode toggle',
  '请增加“停止 ponytail”按钮',
  'normal mode should remain documented',
]) {
  assert.equal(isDeactivationCommand(prose), false, `${JSON.stringify(prose)} must not deactivate Ponytail`)
}

const store = new ModeStore()
assert.equal(store.has('session-1'), false, 'a new session must use the configured default')
store.set('session-1', 'ultra')
assert.equal(store.has('session-1'), true, 'an explicit mode must be identifiable as a session override')
store.clear('session-1')
assert.equal(store.has('session-1'), false, 'reset must remove the session override')

const skills = ponytailSkills()
assert.deepEqual(
  skills.map(skill => skill.name),
  ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help'],
  'the runtime skill surface must remain stable',
)
assert.equal(skills[0].invocation?.modelInvocable, false, 'the pointer skill must stay out of the model catalog')
assert.ok(skills.slice(1).every(skill => skill.invocation?.modelInvocable), 'one-shot skills must remain model-invocable')

const byName = Object.fromEntries(skills.map(skill => [skill.name, skill.content]))
const oneShotBudgets = {
  'ponytail-review': 1867,
  'ponytail-audit': 1195,
  'ponytail-debt': 1800,
  'ponytail-help': 4300,
}
for (const [name, budget] of Object.entries(oneShotBudgets)) {
  assert.ok(Buffer.byteLength(byName[name]) <= budget, `${name} must stay within its reviewed prompt budget`)
}
assert.match(byName['ponytail-review'], /Evidence:/, 'review findings must cite evidence')
assert.match(byName['ponytail-review'], /countable/, 'review must not invent line savings')
assert.match(byName['ponytail-audit'], /safe-delete/, 'audit must identify safe deletions')
assert.match(byName['ponytail-audit'], /verify-first/, 'audit must identify findings that need verification')
assert.match(byName['ponytail-debt'], /rg -n --hidden/, 'debt scan must use ripgrep with explicit exclusions')
assert.match(byName['ponytail-debt'], /git grep -n/, 'debt scan must provide a portable tracked-file fallback')

// Execute the skill's actual commands: catches missed block comments, excluded
// lib sources, and dependency/build hits leaking through either scan path.
const scanRoot = mkdtempSync(join(tmpdir(), 'ponytail-debt-scan-'))
try {
  const fixtures = {
    'src/main.ts': '// ponytail: global lock, shard if throughput matters',
    'lib/source.c': '/* ponytail: linear scan, index if measured slow */',
    'src/script.py': '# ponytail: naive heuristic, replace if accuracy drops',
    'docs/note.md': 'The ponytail: convention is not a shortcut comment.',
    'node_modules/dependency.js': '// ponytail: vendor, excluded',
    'nested/node_modules/dependency.js': '// ponytail: nested vendor, excluded',
    'dist/bundle.js': '// ponytail: generated, excluded',
    'nested/build/output.js': '// ponytail: nested output, excluded',
  }
  for (const [file, content] of Object.entries(fixtures)) {
    const path = join(scanRoot, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${content}\n`)
  }
  for (const args of [['init', '--quiet'], ['add', '--force', '.']]) {
    const result = spawnSync('git', args, { cwd: scanRoot, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr || result.error?.message)
  }
  for (const tool of ['rg', 'git']) {
    const command = byName['ponytail-debt'].match(new RegExp('`(' + tool + ' [^`]+)`'))?.[1]
    assert.ok(command, `debt skill must provide a ${tool} command`)
    const tokens = [...command.matchAll(/'([^']*)'|([^\s]+)/g)].map(match => match[1] ?? match[2])
    const result = spawnSync(tokens[0], tokens.slice(1), { cwd: scanRoot, encoding: 'utf8' })
    if (tool === 'rg' && result.error?.code === 'ENOENT') {
      console.warn('test-core: ripgrep unavailable; rg scan skipped, Git fallback still required')
      continue
    }
    assert.equal(result.status, 0, result.stderr || result.error?.message)
    const hits = result.stdout.trim().split(/\r?\n/).map(line =>
      line.replaceAll('\\', '/').replace(/^\.\//, '').split(':')[0]).sort()
    assert.deepEqual(hits, ['lib/source.c', 'src/main.ts', 'src/script.py'], `${tool} must find real shortcuts only`)
  }
} finally {
  rmSync(scanRoot, { recursive: true, force: true })
}
assert.match(byName['ponytail-help'], /built-in fallback/, 'help must distinguish fallback from effective mode')
assert.match(byName['ponytail-help'], /\/ponytail reset/, 'help must document clearing a session override')

const bundle = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
for (const marker of [
  '停止 ponytail', 'Evidence: <observable reason>', 'safe-delete|verify-first',
  'rg -n --hidden', 'The built-in fallback is', '/ponytail reset',
  'Ponytail session override cleared', 'Ponytail mode: ${current} (${source})',
  'observable done condition', 'Resolve uncertainty with evidence',
  'inspect the final diff', 'Do not weaken a test', 'Report only verified results',
  'one minimal runnable check', 'no framework or fixtures, no per-function suites unless asked',
  'ladder is a reflex, not a research project',
  'grep every caller', 'same-size stdlib options', 'Hardware calibration',
  'ponytail: <ceiling>, <upgrade path>', 'explicitly requested explanations in full',
  'coding tasks only', 'ACTIVE EVERY RESPONSE', '(#|//|/[*]) ?ponytail:',
]) {
  assert.ok(bundle.includes(marker), `shipped bundle must contain ${JSON.stringify(marker)}`)
}

console.log('test-core: OK (prompt contracts, safety invariants, deactivation, skill surface, executable debt scans; not model compliance)')
