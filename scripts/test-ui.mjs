#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

const require = createRequire(resolve(process.env.PONYTAIL_TOOL_ROOT ?? '.', 'package.json'))
const React = require('react')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<!doctype html><div id="root"></div>')
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client')
let client
// No Node module/exports globals: the actual browser loader supplies require only.
runInNewContext(readFileSync('lib/client.js', 'utf8'), {
  window: { __ModuleLoader__: { load(row) { client = row.factory(require) } } },
  document: dom.window.document,
  setTimeout, clearTimeout,
})
assert.equal(typeof client.apply, 'function', 'client factory must load in a browser-shaped realm')
let snapshot = { status: 'ready', value: { defaultMode: 'inherit', disabledSkills: [] }, writable: true, revision: 7 }
let listener = () => {}
let rejectWrite = false
const mutations = []
const scope = {
  getSnapshot: () => snapshot,
  subscribe(callback) { listener = callback; return () => { listener = () => {} } },
  async mutate(ops, revision) {
    mutations.push({ ops: JSON.parse(JSON.stringify(ops)), revision })
    if (rejectWrite || revision !== snapshot.revision) throw new Error('revision conflict')
    const value = { ...snapshot.value }
    for (const op of JSON.parse(JSON.stringify(ops))) value[op.path[0]] = op.op === 'unset'
      ? (op.path[0] === 'defaultMode' ? 'inherit' : []) : op.value
    snapshot = { ...snapshot, value, revision: snapshot.revision + 1 }
    listener()
  },
}
const root = createRoot(document.getElementById('root'))
const act = React.act
const text = () => document.body.textContent
const button = name => [...document.querySelectorAll('button')].find(node => node.textContent === name)
const click = node => act(async () => { node.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await act(async () => { root.render(React.createElement(client.SettingsCard, { scope, t: key => key })) })
assert.equal(document.querySelector('select').value, 'inherit')
const description = node => document.getElementById(node.getAttribute('aria-describedby'))?.textContent
assert.ok(description(document.querySelector('select')).includes('inherit-detail'))
assert.equal(document.querySelector('[role="tooltip"]').hidden, true)
const modeControl = document.querySelector('.ponytail-mode')
await act(async () => modeControl.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true })))
assert.equal(document.querySelector('[role="tooltip"]').hidden, true, 'incidental hover must not immediately flash help')
await act(async () => { await new Promise(resolve => setTimeout(resolve, 220)) })
assert.equal(document.querySelector('[role="tooltip"]').hidden, false, 'hover must open the mode description')
await act(async () => modeControl.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
assert.equal(document.querySelector('[role="tooltip"]').hidden, true, 'Escape must dismiss the tooltip')
await click(document.querySelector('button[aria-label="modeInfo"]'))
assert.equal(document.querySelector('[role="tooltip"]').hidden, false, 'touch/click must also open mode help')
assert.equal(description(document.querySelector('fieldset')), 'skillsHint')
assert.equal(description(button('reset')), 'resetHint')
for (const [index, skill] of ['ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help'].entries()) {
  assert.equal(description(document.querySelectorAll('input')[index]), `${skill}-hint`, 'each skill needs a visible associated explanation')
}
const select = async value => act(async () => {
  const node = document.querySelector('select')
  node.value = value
  node.dispatchEvent(new window.Event('change', { bubbles: true }))
})
await select('ultra')
assert.ok(description(document.querySelector('select')).includes('ultra-detail'), 'description must follow the selected mode')
assert.ok(description(document.querySelector('select')).includes('modeSafety'))
await click(button('save'))
assert.equal(snapshot.value.defaultMode, 'ultra', 'selected mode must reach the settings write')
assert.equal(mutations[0].revision, 7, 'save must fence the revision at the start of editing')
assert.ok(text().includes('saved'))
await click(document.querySelectorAll('input')[1])
await click(button('save'))
assert.deepEqual(snapshot.value.disabledSkills, ['ponytail-audit'], 'skill checkbox must persist its actual skill id')
rejectWrite = true
await select('lite')
await click(button('save'))
assert.equal(snapshot.value.defaultMode, 'ultra', 'failed save must not report a new effective mode')
assert.equal(document.querySelector('select').value, 'lite', 'failed save must retain the user draft')
assert.ok(document.querySelector('[role="alert"]').textContent.includes('revision conflict'))
rejectWrite = false
await click(button('reset'))
assert.equal(snapshot.value.defaultMode, 'inherit')
assert.deepEqual(snapshot.value.disabledSkills, [])
assert.deepEqual(mutations.at(-1).ops.map(op => op.op), ['unset', 'unset'], 'reset must clear only panel overrides')
snapshot = { ...snapshot, writable: false }
await act(async () => listener())
assert.equal(button('reset').disabled, true, 'read-only connections must not offer writes')

let decoration
let renderedCard
let registeredScope
let dictionaries
const commands = []
const cleanups = []
const ctx = {
  effect(factory) { cleanups.push(factory()) },
  locale: { bind: () => key => key, register: (_namespace, value) => { dictionaries = value; return () => {} } },
  settingsScope: { bind: () => scope },
  slots: { inject(_name, factory) { factory() }, register(row, card) { renderedCard = card; registeredScope = row.inject().scope; return () => {} } },
  commandUi: { decorate(row) { decoration = row } },
  remote: { commands: { async execute(sessionId, line, attachments) {
    commands.push({ sessionId, line, attachments: Array.from(attachments) }); return { ok: true, value: {} }
  } } },
  inject(_names, factory) { factory(ctx) },
}
client.apply(ctx)
assert.equal(renderedCard, client.SettingsCard, 'the shipped UI must register the actual settings component')
const options = await decoration.ui.options({ sessionId: 'session-a' }, new AbortController().signal)
assert.deepEqual(Array.from(options, option => option.id), ['lite', 'full', 'ultra', 'off', 'status', 'reset', 'help'])
await decoration.ui.onSelect(options[2], { sessionId: 'session-a' })
assert.deepEqual(commands, [{ sessionId: 'session-a', line: '/ponytail ultra', attachments: [] }])
await assert.rejects(decoration.ui.onSelect({ id: 'unknown' }, { sessionId: 'session-a' }))
const olderCalls = []
ctx.settingsScope.bind = () => ({ getSnapshot: scope.getSnapshot, subscribe: scope.subscribe })
ctx.connection = { api: { settings: { async mutate(request) { olderCalls.push(JSON.parse(JSON.stringify(request))); return { result: { ok: true } } } } } }
client.apply(ctx)
await registeredScope.mutate([{ op: 'unset', path: ['defaultMode'] }], 42)
assert.deepEqual(olderCalls, [{ ns: 'ponytail', ops: [{ op: 'unset', path: ['defaultMode'] }], expectedRevision: 42 }], 'older hosts must use one atomic fenced RPC')
ctx.connection.api.settings.mutate = async () => ({ result: { ok: false, error: { message: 'older host write rejected' } } })
await assert.rejects(registeredScope.mutate([], 42), /older host write rejected/, 'older host rejection must not become save success')
for (const language of ['zh', 'en']) {
  const dict = dictionaries[language]
  await act(async () => { root.render(React.createElement(client.SettingsCard, { scope, t: key => dict[key] })) })
  await click(document.querySelector('button[aria-label]'))
  for (const node of document.querySelectorAll('[aria-describedby]')) {
    const explanation = document.getElementById(node.getAttribute('aria-describedby'))
    assert.ok(explanation?.textContent.trim(), `${language}: explanation must be visible text`)
    assert.equal(explanation.hidden, false)
  }
  assert.ok(text().includes(dict.modeHint))
  assert.ok(text().includes(dict.skillsHint))
  assert.ok(text().includes(dict.resetHint))
  assert.ok(dict.modeRecommendation?.trim())
  assert.ok(document.querySelector('details').textContent.includes(dict.modeRecommendation), `${language}: mode recommendation belongs in help`)
  for (const mode of ['inherit', 'lite', 'full', 'ultra', 'off']) {
    assert.ok(dict[`${mode}-detail`]?.trim(), `${language}: every mode needs a description`)
  }
}
for (const dispose of cleanups.reverse()) dispose?.()
await act(async () => root.unmount())
dom.window.close()
console.log('test-ui: OK (browser factory, bilingual associated explanations, save/reset/failure/read-only controls, skill ids, native command picker)')
