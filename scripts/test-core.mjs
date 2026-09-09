#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ponytailSkills } from '../src/content.ts'
import { getPonytailInstructions } from '../src/instructions.ts'
import { isDeactivationCommand, ModeStore } from '../src/modes.ts'

const expectedBytes = { lite: 1920, full: 3052, ultra: 2839, off: 0 }
const prompts = Object.fromEntries(
  Object.keys(expectedBytes).map(mode => [mode, getPonytailInstructions(mode)]),
)

for (const [mode, expected] of Object.entries(expectedBytes)) {
  assert.equal(Buffer.byteLength(prompts[mode]), expected, `${mode} prompt bytes must not drift`)
}
assert.equal(prompts.off, '', 'off mode must inject nothing')
assert.equal(new Set([prompts.lite, prompts.full, prompts.ultra]).size, 3, 'active modes must remain distinct')
for (const mode of ['lite', 'full', 'ultra']) {
  assert.match(prompts[mode], /Input validation at trust boundaries/, `${mode} must preserve input validation`)
  assert.match(prompts[mode], /Error handling that prevents data loss/, `${mode} must preserve data-loss protection`)
  assert.match(prompts[mode], /Necessary tests for non-trivial changes/, `${mode} must preserve testing`)
  assert.match(prompts[mode], /Root-cause fixes over symptom patches/, `${mode} must preserve root-cause fixes`)
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
]) {
  assert.ok(bundle.includes(marker), `shipped bundle must contain ${JSON.stringify(marker)}`)
}

console.log('test-core: OK (prompt bytes, safety invariants, deactivation, skill surface)')
