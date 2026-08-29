#!/usr/bin/env node
/**
 * Build and verify the GitHub Release tarball asset with a STABLE name.
 *
 * The `latest` download URL must not break when the version changes, so the
 * uploaded asset is always named `mengyuly-dsh-ponytail.tgz` (no version
 * suffix). The versioned npm tarball is produced by `npm pack`, then copied
 * to the fixed name, then verified locally (gzip + tar entries, version
 * match, no scripts/src/tests/tools inside).
 *
 * Usage:
 *   node scripts/release-assets.mjs            # build + verify only
 *   node scripts/release-assets.mjs --upload v0.2.3   # also upload via gh
 *
 * Cross-platform: pure Node (zlib for gzip, manual ustar parsing) — no tar,
 * cp, mv, or shell string concatenation. The version is read from
 * `npm pack --json` output, never hardcoded.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const repoRoot = resolve(import.meta.dirname, '..')
const FIXED_NAME = 'mengyuly-dsh-ponytail.tgz'
const MUST_HAVE = [
  'package/package.json',
  'package/lib/index.js',
  'package/lib/invariant.js',
  'package/lib/types/index.d.ts',
  'package/lib/types/content.d.ts',
  'package/lib/types/instructions.d.ts',
  'package/lib/types/invariant.d.ts',
  'package/lib/types/modes.d.ts',
  'package/cordis.patch.yml',
  'package/README.md',
  'package/LICENSE',
  'package/CHANGELOG.md',
  'package/dist-provenance.json',
]
const MUST_NOT_HAVE = [
  'package/src/',
  'package/scripts/',
  'package/tests/',
  'package/test/',
  'package/tools/',
]

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: repoRoot, encoding: 'utf8', ...opts })
  if (r.error) throw new Error(`${cmd} spawn failed: ${r.error.message}`)
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}): ${(r.stderr || r.stdout).slice(0, 400)}`)
  }
  return r
}

/** Parse a gzip tarball into { path -> Buffer } (ustar format, no deps). */
function readTar(buffer) {
  const out = new Map()
  let off = 0
  while (off + 512 <= buffer.length) {
    const header = buffer.subarray(off, off + 512)
    if (header.every(b => b === 0)) break
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim() || '0', 8)
    const type = String.fromCharCode(header[156])
    off += 512
    if (type === '5' || type === 'x' || type === 'g') continue // dir / pax headers
    if (name === '' ) continue
    // pax extended header applies to the NEXT entry; skip parsing its data
    const data = buffer.subarray(off, off + size)
    if (type !== 'x' && type !== 'g') out.set(name, data)
    off += Math.ceil(size / 512) * 512
  }
  return out
}

function verifyTarball(file, expectedVersion) {
  const raw = readFileSync(file)
  const gz = gunzipSync(raw) // throws if not a valid gzip tarball
  const entries = readTar(gz)
  const paths = new Set(entries.keys())
  const missing = MUST_HAVE.filter(p => !paths.has(p))
  if (missing.length > 0) throw new Error(`fixed-name tarball missing entries: ${missing.join(', ')}`)
  const forbidden = [...paths].filter(p => MUST_NOT_HAVE.some(prefix => p.startsWith(prefix)))
  if (forbidden.length > 0) throw new Error(`fixed-name tarball contains forbidden paths: ${forbidden.join(', ')}`)
  const pkg = JSON.parse(entries.get('package/package.json').toString('utf8'))
  if (pkg.version !== expectedVersion) {
    throw new Error(`tarball package.json version ${pkg.version} != expected ${expectedVersion}`)
  }
  if (pkg.files && pkg.files.includes(FIXED_NAME)) {
    throw new Error(`the fixed asset name must NOT be listed in package.json "files"`)
  }
  return { entries: paths.size, version: pkg.version, bytes: raw.length }
}

function main() {
  const uploadTag = process.argv.includes('--upload') ? process.argv[process.argv.indexOf('--upload') + 1] : null
  const tmp = mkdtempSync(join(tmpdir(), 'ponytail-release-'))
  try {
    const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', tmp]).stdout)
    const info = Array.isArray(packed) ? packed[0] : packed
    const versioned = join(tmp, info.filename) // filename comes from npm pack --json
    const fixed = join(repoRoot, FIXED_NAME)
    writeFileSync(fixed, readFileSync(versioned)) // copy, no shell, no hardcoded version

    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    const report = verifyTarball(fixed, pkg.version)
    console.log(`release-assets: ${FIXED_NAME} OK (${report.bytes} bytes, ${report.entries} entries, version ${report.version})`)
    console.log(`release-assets: versioned npm tarball ${info.filename} preserved in temp; fixed-name asset written to ${fixed}`)

    if (uploadTag) {
      const gh = process.env.GITHUB_PATH ? 'gh' : (existsSync(join(repoRoot, '..', 'gh')) ? join(repoRoot, '..', 'gh') : 'gh')
      const r = spawnSync(gh, ['release', 'upload', uploadTag, fixed, '--clobber'], { cwd: repoRoot, encoding: 'utf8' })
      if (r.error || r.status !== 0) {
        console.log(`release-assets: upload skipped — run manually:\n  gh release upload ${uploadTag} ${FIXED_NAME}`)
        if (r.stderr) console.log(`  (${String(r.stderr).trim().split('\n')[0]})`)
      } else {
        console.log(`release-assets: uploaded ${FIXED_NAME} to release ${uploadTag}`)
      }
    } else {
      console.log('release-assets: no --upload tag given — asset built and verified locally only.')
    }
    return 0
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

process.exit(main())
