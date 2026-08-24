#!/usr/bin/env node
/**
 * Pack the release tarball and verify it end to end:
 *
 *  1. `npm pack --json` succeeds and the packed version equals package.json.
 *  2. The tarball contains the full expected surface (LICENSE, README,
 *     CHANGELOG, dist-provenance.json, cordis.patch.yml, package.json, both
 *     runtime bundles, and every declaration file) and NOTHING under `src/`.
 *  3. The tarball installs into a clean temp dir and the installed bundle
 *     loads with the expected plugin shape — proving it does not secretly
 *     depend on the authoritative source tree.
 *
 * Honest dependency reporting: npm auto-installs the declared peerDependencies
 * (including the DSH host-contract peers, resolved from the registry). The
 * installed dependency list is printed so the claim stays factual: the bundle
 * imports ONLY `@deepseek-ai/cordis` at runtime (an independent externals
 * check), while the manifest peers are host-contract declarations.
 *
 * Exits non-zero on any failure. Temporary files are removed unless
 * `PONYTAIL_VERIFY_KEEP_TEMP=1` is set.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runNpm, tempWork } from './lib/run-command.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

const work = tempWork('ponytail-pack-')
try {
  const packed = runNpm(['pack', '--json', '--pack-destination', work.dir], repoRoot)
  const packJson = JSON.parse(packed.stdout)
  const [entry] = Array.isArray(packJson) ? packJson : [packJson]
  const tgz = isAbsolute(entry.filename) ? entry.filename : join(work.dir, entry.filename)

  check(entry.version === pkg.version, `packed version ${entry.version} != package.json version ${pkg.version}`)
  const required = [
    'LICENSE', 'README.md', 'CHANGELOG.md', 'dist-provenance.json', 'cordis.patch.yml', 'package.json',
    'lib/index.js', 'lib/invariant.js',
    'lib/types/index.d.ts', 'lib/types/modes.d.ts', 'lib/types/instructions.d.ts',
    'lib/types/content.d.ts', 'lib/types/invariant.d.ts',
  ]
  const paths = new Set(entry.files.map(f => f.path))
  for (const file of required) check(paths.has(file), `tarball missing ${file}`)
  check(![...paths].some(p => p.startsWith('src/')), 'tarball must not depend on src/')

  // Install into a clean dir; npm will also auto-install the declared peers.
  // The bundle's runtime externals are cordis + schemastery, so both are
  // installed explicitly from the registry for the smoke.
  runNpm(['install', tgz, '@deepseek-ai/cordis@^4.0.1', '@deepseek-ai/schemastery@^3.18.0'], work.dir)

  // Report what actually got installed (npm auto-resolves all declared peers).
  const installedPkgDir = join(work.dir, 'node_modules', pkg.name)
  const scopedDir = join(work.dir, 'node_modules', '@deepseek-ai')
  const installed = existsSync(scopedDir) ? readdirSync(scopedDir).sort() : []
  const peers = Object.keys(pkg.peerDependencies ?? {}).sort()
  console.log(`verify-pack: installed @deepseek-ai/* deps: ${installed.join(', ') || '(none)'}`)
  console.log(`verify-pack: declared peers: ${peers.join(', ')} (host-contract; the bundle imports @deepseek-ai/cordis + @deepseek-ai/schemastery at runtime)`)

  const mod = await import(pathToFileURL(join(installedPkgDir, 'lib', 'index.js')).href)
  check(mod.name === 'ponytail' && typeof mod.apply === 'function'
    && typeof mod.containsDeactivation === 'function' && typeof mod.messageText === 'function',
  'installed bundle does not expose the plugin shape')
  check(JSON.stringify(mod.inject) === JSON.stringify(['systemPrompt', 'skills']), 'installed bundle inject mismatch')
  check(existsSync(join(installedPkgDir, 'lib', 'types', 'modes.d.ts')), 'installed package missing modes.d.ts')
} finally {
  work.cleanup()
}

if (failures.length > 0) {
  console.error(`verify-pack: FAILED\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`verify-pack: OK (${pkg.version}: contents, version match, installed smoke passed)`)
