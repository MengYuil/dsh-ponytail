#!/usr/bin/env node
/**
 * Pack the release tarball and verify it end to end:
 *
 *  1. `npm pack --json` succeeds and the packed version equals package.json.
 *  2. The tarball contains the full expected surface (LICENSE, README,
 *     CHANGELOG, cordis.patch.yml, package.json, both runtime bundles, and
 *     every declaration file) and NOTHING under `src/`.
 *  3. The tarball installs into a clean temp dir with only the declared peers
 *     (`@deepseek-ai/cordis` from the registry) and the installed bundle loads
 *     with the expected plugin shape — proving it does not secretly depend on
 *     the authoritative source tree.
 *
 * Exits non-zero on any failure.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
const work = mkdtempSync(join(tmpdir(), 'ponytail-pack-'))
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

const run = (args, cwd) => spawnSync('npm', args, { cwd, encoding: 'utf8' })

try {
  const packed = run(['pack', '--json', '--pack-destination', work], repoRoot)
  check(packed.status === 0, `npm pack failed: ${(packed.stderr ?? '').slice(-400)}`)
  if (packed.status !== 0) throw new Error('abort after pack failure')
  const packJson = JSON.parse(packed.stdout)
  const [entry] = packJson
  const tgz = join(work, entry.filename)

  check(entry.version === pkg.version, `packed version ${entry.version} != package.json version ${pkg.version}`)
  const required = [
    'LICENSE', 'README.md', 'CHANGELOG.md', 'cordis.patch.yml', 'package.json',
    'lib/index.js', 'lib/invariant.js',
    'lib/types/index.d.ts', 'lib/types/modes.d.ts', 'lib/types/instructions.d.ts',
    'lib/types/content.d.ts', 'lib/types/invariant.d.ts',
  ]
  const paths = new Set(entry.files.map(f => f.path))
  for (const file of required) check(paths.has(file), `tarball missing ${file}`)
  check(![...paths].some(p => p.startsWith('src/')), 'tarball must not depend on src/')

  // Install into a clean dir with only the declared peer available.
  const install = run(['install', '--no-save', '--no-audit', '--no-fund', tgz, '@deepseek-ai/cordis@^4.0.1'], work)
  check(install.status === 0, `npm install of tarball failed: ${(install.stderr ?? '').slice(-400)}`)
  if (install.status !== 0) throw new Error('abort after install failure')

  const mod = await import(pathToFileURL(join(work, 'node_modules', pkg.name, 'lib', 'index.js')).href)
  check(mod.name === 'ponytail' && typeof mod.apply === 'function'
    && typeof mod.containsDeactivation === 'function' && typeof mod.messageText === 'function',
  'installed bundle does not expose the plugin shape')
  check(JSON.stringify(mod.inject) === JSON.stringify(['systemPrompt', 'skills']), 'installed bundle inject mismatch')
  check(existsSync(join(work, 'node_modules', pkg.name, 'lib', 'types', 'modes.d.ts')), 'installed package missing modes.d.ts')
} finally {
  rmSync(work, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`verify-pack: FAILED\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`verify-pack: OK (${pkg.version}: contents, version match, installed smoke passed)`)
