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
import { gunzipSync } from 'node:zlib'
import { runNpm, tempWork } from './lib/run-command.mjs'
import { readTar } from './check-release-consistency.mjs'

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
  // Development-only content must never ship in the tarball.
  const DEV_DIRS = ['scripts', 'src', 'tests', 'test', 'tools', '.github']
  for (const dir of DEV_DIRS) {
    check(![...paths].some(p => p === dir || p.startsWith(`${dir}/`)),
      `tarball must not contain development directory: ${dir}/`)
  }

  // The published package.json must not expose repository-maintainer commands:
  // scripts/ is excluded from the tarball, so any `scripts` entry that invokes
  // scripts/ would be an unavailable command after installation. No install
  // lifecycle hooks may exist either.
  const tarEntries = readTar(gunzipSync(readFileSync(tgz)))
  const packedManifest = JSON.parse(tarEntries.get('package/package.json').data.toString('utf8'))
  const packedScripts = packedManifest.scripts ?? {}
  const lifecycle = ['preinstall', 'install', 'postinstall']
  for (const name of lifecycle) {
    check(packedScripts[name] === undefined,
      `tarball package.json must not define install lifecycle script: ${name}`)
  }
  for (const [name, command] of Object.entries(packedScripts)) {
    check(typeof command === 'string' && !/\bscripts\//.test(command),
      `tarball package.json script "${name}" references scripts/ which is not published: ${command}`)
  }
  // Every main/types/exports target must exist inside the tarball.
  const entryTargets = []
  const collect = (value) => {
    if (typeof value === 'string') entryTargets.push(value)
    else if (value && typeof value === 'object') for (const v of Object.values(value)) collect(v)
  }
  collect(packedManifest.main)
  collect(packedManifest.types)
  collect(packedManifest.exports)
  const allowedTargets = new Set(['package.json', 'cordis.patch.yml'])
  for (const target of entryTargets) {
    const normalized = target.startsWith('./') ? target.slice(2) : target
    check(allowedTargets.has(normalized) || tarEntries.has(`package/${normalized}`),
      `tarball package.json entry target does not exist in the tarball: ${target}`)
  }

  // Install into a clean dir; npm will also auto-install the declared peers.
  // The bundle's runtime externals are cordis + schemastery, so both are
  // installed explicitly from the registry for the smoke. Caret-free ranges
  // on purpose: on Windows npm.cmd re-parses arguments through cmd.exe, where
  // `^` would be eaten and `@pkg@^3.18.0` would become the nonexistent exact
  // version `@pkg@3.18.0` (see scripts/lib/run-command.mjs).
  runNpm(['install', tgz, '@deepseek-ai/cordis@4', '@deepseek-ai/schemastery@3'], work.dir)

  // Report what actually got installed (npm auto-resolves all declared peers).
  const installedPkgDir = join(work.dir, 'node_modules', pkg.name)
  const scopedDir = join(work.dir, 'node_modules', '@deepseek-ai')
  const installed = existsSync(scopedDir) ? readdirSync(scopedDir).sort() : []
  const peers = Object.keys(pkg.peerDependencies ?? {}).sort()
  console.log(`verify-pack: installed @deepseek-ai/* deps: ${installed.join(', ') || '(none)'}`)
  console.log(`verify-pack: declared peers: ${peers.join(', ')} (host-contract; the bundle imports @deepseek-ai/cordis + @deepseek-ai/schemastery at runtime)`)

  // The installed package (name read dynamically from package.json) must not
  // carry development scripts either.
  check(!existsSync(join(installedPkgDir, 'scripts')),
    `installed package contains scripts/ at ${join(installedPkgDir, 'scripts')}`)

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
