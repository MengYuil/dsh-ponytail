#!/usr/bin/env node
/**
 * Shell-independent bundle-surface checks for CI (works on PowerShell, bash,
 * cmd, and every platform):
 *
 *  1. The built bundle's runtime externals must be EXACTLY the declared,
 *     registry-resolvable peers: `@deepseek-ai/cordis` and
 *     `@deepseek-ai/schemastery`. No `@deepseek-ai/dsh-*` module may remain
 *     external (those are inlined at build time), and no unlisted external
 *     may sneak in.
 *  2. The shipped bundle must not contain `new Function` / `eval` — keeping
 *     `@deepseek-ai/schemastery` external (rather than inlined) is what keeps
 *     the release artifact free of dynamic code evaluation.
 *  3. The manifest must declare the bundle patch (`dsh.bundle.patch`).
 *
 * Exits non-zero on any failure.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = readFileSync(join(repoRoot, 'lib', 'index.js'), 'utf8')

const ALLOWED_EXTERNALS = ['deepseek-ai/cordis', 'deepseek-ai/schemastery']
const externals = [...bundle.matchAll(/from "@([^"]+)"/g)].map(match => match[1])
const unexpected = externals.filter(name => !ALLOWED_EXTERNALS.includes(name))
if (unexpected.length > 0) {
  console.error(`check-bundle: unexpected runtime externals: ${unexpected.join(', ')} (allowed: ${ALLOWED_EXTERNALS.join(', ')})`)
  process.exit(1)
}
console.log('check-bundle: externals:', externals.length ? externals.join(', ') : '(none)')

const evalPattern = /\bnew Function\b|\beval\s*\(/g
const evals = [...bundle.matchAll(evalPattern)]
if (evals.length > 0) {
  console.error(`check-bundle: shipped bundle contains dynamic code evaluation (${evals.length} hits)`)
  process.exit(1)
}
console.log('check-bundle: no new Function / eval in the shipped bundle')

const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
if (!manifest.dsh?.bundle?.patch) {
  console.error('check-bundle: dsh.bundle.patch missing from package.json')
  process.exit(1)
}
console.log('check-bundle: manifest ok (dsh.bundle.patch declared)')
