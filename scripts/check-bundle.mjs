#!/usr/bin/env node
/**
 * Shell-independent bundle-surface checks for CI (works on PowerShell, bash,
 * cmd, and every platform):
 *
 *  1. The built bundle must not import any `@deepseek-ai/dsh-*` module at
 *     runtime — the release is self-contained (only `@deepseek-ai/cordis`
 *     remains external; every other DSH package is inlined at build time).
 *  2. The manifest must declare the bundle patch (`dsh.bundle.patch`).
 *
 * Exits non-zero on any failure.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = readFileSync(join(repoRoot, 'lib', 'index.js'), 'utf8')
const externals = [...bundle.matchAll(/from "@([^"]+)"/g)].map(match => match[1])
const bad = externals.filter(name => name.startsWith('deepseek-ai/dsh-'))
if (bad.length > 0) {
  console.error(`check-bundle: bundle still imports dsh core at runtime: ${bad.join(', ')}`)
  process.exit(1)
}
console.log('check-bundle: externals:', externals.length ? externals.join(', ') : '(none)')

const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
if (!manifest.dsh?.bundle?.patch) {
  console.error('check-bundle: dsh.bundle.patch missing from package.json')
  process.exit(1)
}
console.log('check-bundle: manifest ok (dsh.bundle.patch declared)')
