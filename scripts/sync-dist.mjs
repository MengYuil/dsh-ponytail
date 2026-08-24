#!/usr/bin/env node
/**
 * Regenerate and sync the FULL dist artifact (runtime bundles + declaration
 * files) from the authoritative deepseek-harness checkout into this release
 * mirror.
 *
 * The authoritative source is NOT this repository — it lives at
 * `packages/community/ponytail` inside a deepseek-harness checkout, and this
 * mirror ships the built `lib/` plus a `cordis.patch.yml`. This script is the
 * ONLY sanctioned way to update `lib/`: it builds the package in the checkout
 * and copies every runtime bundle AND every `.d.ts`, so a release can never
 * again ship a fresh `lib/index.js` beside stale declarations.
 *
 * Usage:
 *   DSH_CHECKOUT=/path/to/deepseek-harness node scripts/sync-dist.mjs
 *   node scripts/sync-dist.mjs /path/to/deepseek-harness
 *
 * Requires the checkout to be installed (its `node_modules/.bin/tsc` and
 * `.bin/tsdown` must exist) and the ponytail package to be present at
 * `packages/community/ponytail`. Fails loudly — never silently reuses an old
 * `lib/`.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const checkout = process.env.DSH_CHECKOUT ?? process.argv[2]
if (!checkout) {
  console.error('sync-dist: DSH_CHECKOUT is required (environment variable or first argument)')
  process.exit(1)
}
const checkoutRoot = resolve(checkout)
const pkgDir = join(checkoutRoot, 'packages', 'community', 'ponytail')
for (const [label, path] of [['checkout root', checkoutRoot], ['ponytail package', pkgDir]]) {
  if (!existsSync(path)) {
    console.error(`sync-dist: ${label} not found at ${path}`)
    process.exit(1)
  }
}
if (!existsSync(join(pkgDir, 'package.json')) || !existsSync(join(pkgDir, 'src', 'index.ts'))) {
  console.error(`sync-dist: ${pkgDir} does not look like the ponytail package (package.json + src/index.ts expected)`)
  process.exit(1)
}

const run = (binName, args, cwd) => {
  const result = spawnSync(join(checkoutRoot, 'node_modules', '.bin', binName), args, {
    cwd,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error(`sync-dist: ${binName} failed (exit ${result.status ?? 'signal'})`)
    process.exit(result.status ?? 1)
  }
}

console.log(`sync-dist: building @deepseek-ai/dsh-ponytail from ${checkoutRoot}`)
// 1. Type-check + emit declarations (+ intermediate JS for tsdown).
run('tsc', ['-b', 'packages/community/ponytail/tsconfig.json', '--force'], checkoutRoot)
// 2. Bundle the runtime (uses the package-local tsdown.config.ts, which
//    inlines dsh-llm/dsh-skill so the bundle only depends on cordis).
run('tsdown', [], pkgDir)

// 3. Copy the FULL artifact: both runtime bundles and every declaration file.
//    The intermediate lib/types/*.js (and their maps) are tsc inputs for
//    tsdown, not runtime code, and are deliberately not shipped.
const srcLib = join(pkgDir, 'lib')
const dstTypes = join(repoRoot, 'lib', 'types')
rmSync(dstTypes, { recursive: true, force: true })
mkdirSync(dstTypes, { recursive: true })
const copied = ['index.js', 'invariant.js']
for (const file of copied) copyFileSync(join(srcLib, file), join(repoRoot, 'lib', file))
for (const entry of readdirSync(join(srcLib, 'types'))) {
  if (entry.endsWith('.d.ts')) {
    copyFileSync(join(srcLib, 'types', entry), join(dstTypes, entry))
    copied.push(`types/${entry}`)
  }
}
console.log(`sync-dist: copied ${copied.join(', ')}`)

// 4. Verify what was just written, then report whether the repo is now dirty.
const verify = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'verify-dist.mjs')], {
  cwd: repoRoot,
  stdio: 'inherit',
})
if (verify.status !== 0) {
  console.error('sync-dist: post-sync verification failed')
  process.exit(verify.status ?? 1)
}

const git = spawnSync('git', ['status', '--porcelain', '--', 'lib'], { cwd: repoRoot, encoding: 'utf8' })
const dirty = (git.stdout ?? '').trim()
console.log(dirty === ''
  ? 'sync-dist: lib/ is identical to the committed artifacts.'
  : `sync-dist: lib/ changed — commit the regenerated artifacts now:\n${dirty}`)
