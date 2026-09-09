#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ponytailSkills } from '../src/content.ts'
import { getPonytailInstructions } from '../src/instructions.ts'
import { isDeactivationCommand, ModeStore } from '../src/modes.ts'

const promptBudgets = { lite: 1920, full: 3052, ultra: 2839, off: 0 }
const prompts = Object.fromEntries(
  Object.keys(promptBudgets).map(mode => [mode, getPonytailInstructions(mode)]),
)

for (const [mode, budget] of Object.entries(promptBudgets)) {
  assert.ok(Buffer.byteLength(prompts[mode]) <= budget, `${mode} prompt must not exceed its previous size`)
}
assert.equal(prompts.off, '', 'off mode must inject nothing')
assert.equal(new Set([prompts.lite, prompts.full, prompts.ultra]).size, 3, 'active modes must remain distinct')
for (const mode of ['lite', 'full', 'ultra']) {
  assert.match(prompts[mode], /Input validation at trust boundaries/, `${mode} must preserve input validation`)
  assert.match(prompts[mode], /Error handling that prevents data loss/, `${mode} must preserve data-loss protection`)
  assert.match(prompts[mode], /one minimal runnable check/, `${mode} must require exactly one minimal check`)
  assert.match(prompts[mode], /no framework or fixtures unless asked/, `${mode} must not overbuild test infrastructure`)
  assert.match(prompts[mode], /Root-cause fixes over symptom patches/, `${mode} must preserve root-cause fixes`)
  assert.match(prompts[mode], /observable done condition/, `${mode} must define an observable outcome before editing`)
  assert.match(prompts[mode], /Resolve uncertainty with evidence/, `${mode} must investigate instead of guess`)
  assert.match(prompts[mode], /inspect the final diff/, `${mode} must review its actual changes`)
  assert.match(prompts[mode], /Do not weaken a test/, `${mode} must diagnose failed validation honestly`)
  assert.match(prompts[mode], /Report only verified results/, `${mode} must not overclaim outcomes`)
  assert.match(prompts[mode], /ladder is a reflex, not a research project/, `${mode} must keep the ladder lightweight`)
}
assert.match(prompts.lite, /Execute the direct request without ceremony/, 'lite must optimize for direct execution')
assert.match(prompts.full, /stop at the first rung that holds/, 'full must keep the reuse-first decision ladder')
assert.match(prompts.ultra, /Require evidence before adding/, 'ultra must make deletion-first decisions evidence-based')

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
  'ponytail-debt': 1263,
  'ponytail-help': 3822,
}
for (const [name, budget] of Object.entries(oneShotBudgets)) {
  assert.ok(Buffer.byteLength(byName[name]) <= budget, `${name} must not exceed its previous prompt size`)
}
assert.match(byName['ponytail-review'], /Evidence:/, 'review findings must cite evidence')
assert.match(byName['ponytail-review'], /countable/, 'review must not invent line savings')
assert.match(byName['ponytail-audit'], /safe-delete/, 'audit must identify safe deletions')
assert.match(byName['ponytail-audit'], /verify-first/, 'audit must identify findings that need verification')
assert.match(byName['ponytail-debt'], /rg -n --hidden/, 'debt scan must use ripgrep with explicit exclusions')
assert.match(byName['ponytail-debt'], /git grep -n/, 'debt scan must provide a portable tracked-file fallback')
assert.match(byName['ponytail-help'], /built-in fallback/, 'help must distinguish fallback from effective mode')
assert.match(byName['ponytail-help'], /\/ponytail reset/, 'help must document clearing a session override')

const bundle = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
for (const marker of [
  '停止 ponytail', 'Evidence: <observable reason>', 'safe-delete|verify-first',
  'rg -n --hidden', 'The built-in fallback is', '/ponytail reset',
  'Ponytail session override cleared', 'Ponytail mode: ${current} (${source})',
  'observable done condition', 'Resolve uncertainty with evidence',
  'inspect the final diff', 'Do not weaken a test', 'Report only verified results',
  'one minimal runnable check', 'no framework or fixtures unless asked',
  'ladder is a reflex, not a research project',
]) {
  assert.ok(bundle.includes(marker), `shipped bundle must contain ${JSON.stringify(marker)}`)
}

console.log('test-core: OK (prompt bytes, safety invariants, deactivation, skill surface)')
