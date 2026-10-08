#!/usr/bin/env node
// Reproduce the consumer install with pnpm's default peer resolution, not
// --legacy-peer-deps, autoInstallPeers:false, or a monorepo node_modules tree.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runNpm, tempWork } from './lib/run-command.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const work = tempWork('ponytail-install-')
try {
  writeFileSync(join(work.dir, 'package.json'), JSON.stringify({
    name: 'ponytail-install-consumer', private: true, type: 'module',
  }))
  const [packed] = JSON.parse(runNpm(['pack', '--json', '--pack-destination', work.dir], root).stdout)
  const tgz = isAbsolute(packed.filename) ? packed.filename : join(work.dir, packed.filename)
  const result = runNpm(['exec', '--yes', '--package', 'pnpm@11.22.0', '--',
    'pnpm', 'add', tgz], work.dir)
  const lock = readFileSync(join(work.dir, 'pnpm-lock.yaml'), 'utf8')
  assert.match(lock, /autoInstallPeers: true/, 'install must exercise automatic peer resolution')
  assert.doesNotMatch(lock, /dsh-type-meta/, 'install must not fetch the unpublished transitive peer')
  const store = readdirSync(join(work.dir, 'node_modules', '.pnpm'))
  assert.ok(!store.some(name => name.startsWith('@deepseek-ai+dsh-')),
    'a plugin-only install must not auto-install host DSH packages')
  const installed = join(work.dir, 'node_modules', pkg.name)
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
  for (const peer of ['@deepseek-ai/cordis', '@deepseek-ai/schemastery']) {
    assert.notEqual(manifest.peerDependenciesMeta?.[peer]?.optional, true,
      `${peer} is a required runtime external`)
    assert.ok(store.some(name => name.startsWith(peer.replace('/', '+') + '@')),
      `${peer} must be installed automatically`)
  }
  assert.ok(!existsSync(join(work.dir, 'pnpm-workspace.yaml')),
    'consumer must not need a workspace workaround')
  const mod = await import(pathToFileURL(join(installed, 'lib', 'index.js')).href)
  assert.equal(mod.name, 'ponytail')
  assert.equal(typeof mod.apply, 'function', 'installed runtime must load outside the host source tree')
  console.log(`test-install: OK (pnpm 11.22.0 default peers, clean packed install, runtime load)\n${result.stdout.trim()}`)
} finally {
  work.cleanup()
}
