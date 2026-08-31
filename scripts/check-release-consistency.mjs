#!/usr/bin/env node
/**
 * Cross-channel release consistency verification for @mengyuly/dsh-ponytail.
 *
 * Checks that the four release surfaces agree on the same version:
 *   A. local git checkout / Git Tag (v<version>)
 *   B. npm Registry (dist-tag latest, tarball, package.json version)
 *   C. GitHub Release (latest release, fixed-name asset on latest + tag)
 *   D. dist-provenance.json inside the published tarball
 * plus byte-level comparison (SHA-256) of the npm tarball vs the GitHub
 * fixed-name assets, tarball content boundaries, and portable permissions.
 *
 * READ-ONLY: never uploads, never publishes, never modifies tags or releases.
 * Pure Node stdlib (fetch) — no Bash-only commands; works on Windows/Linux/macOS.
 *
 * Network failure is reported as `remote_check_unavailable` — never as a
 * mismatch. A stale local checkout is reported as a warning, never as proof
 * of current-source consistency.
 *
 * Usage:
 *   npm run check:release-consistency
 *   node scripts/check-release-consistency.mjs --version 0.3.2
 *   node scripts/check-release-consistency.mjs --offline
 *
 * Exits: 0 = consistent, 1 = inconsistency found, 2 = usage error,
 * 3 = remote checks unavailable (network/API failure).
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ASSET_NAME = 'mengyuly-dsh-ponytail.tgz'
const REPO = 'MengYuil/dsh-ponytail'

/** @param {string} version - e.g. "0.3.2" */
const npmTarballUrl = version =>
  `https://registry.npmjs.org/@mengyuly/dsh-ponytail/-/dsh-ponytail-${version}.tgz`
const ghLatestUrl = () =>
  `https://github.com/${REPO}/releases/latest/download/${ASSET_NAME}`
const ghTagUrl = version =>
  `https://github.com/${REPO}/releases/download/v${version}/${ASSET_NAME}`

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

/** Parse a gzip tarball into { path -> { data, mode } } (ustar, no deps). */
export function readTar(buffer) {
  const out = new Map()
  let off = 0
  while (off + 512 <= buffer.length) {
    const header = buffer.subarray(off, off + 512)
    if (header.every(b => b === 0)) break
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim() || '0', 8)
    const mode = parseInt(header.subarray(100, 108).toString('utf8').replace(/\0.*$/, '').trim() || '0', 8)
    const type = String.fromCharCode(header[156])
    off += 512
    if (type === '5' || type === 'x' || type === 'g') continue // dir / pax headers
    if (name === '') continue
    out.set(name, { data: buffer.subarray(off, off + size), mode })
    off += Math.ceil(size / 512) * 512
  }
  return out
}

/** Read a file inside a tarball (path prefix `package/`), or undefined. */
function tarFile(entries, path) {
  const entry = entries.get(`package/${path}`)
  return entry ? entry.data.toString('utf8') : undefined
}

async function fetchBuffer(url, signal) {
  const res = await fetch(url, { redirect: 'follow', signal })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Local git facts for one version; `null` when not a repo or git unavailable. */
function localGit(version) {
  try {
    const run = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim()
    const head = run(['rev-parse', 'HEAD'])
    let tag = null
    try {
      tag = run(['rev-parse', '--verify', '--quiet', `v${version}^{commit}`])
    } catch { /* tag not present */ }
    return { head, tag, version }
  } catch {
    return null
  }
}

export async function runChecks(options) {
  const version = options.version ?? JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version
  const offline = options.offline ?? false
  const result = {
    expected_version: version,
    local: { available: false, version: null, head: null, tag: null, freshness_verified: false },
    git_tag: { available: null, tag: `v${version}`, commit: null, package_version: null },
    npm: { available: null, latest: null, version: null, tarball_url: null, size: null, sha256: null, integrity: null },
    github_release: {
      available: null, latest_tag: null, is_latest: null, asset_name: ASSET_NAME,
      latest_status: null, version_status: null, size: null, sha256: null,
    },
    provenance: { format_valid: null, npm_github_match: null, source_commit: null, source_commit_remote_verified: null },
    tarball: { required_files_present: null, forbidden_directories_absent: null, permissions_portable: null },
    consistent: false,
    warnings: [],
    errors: [],
  }
  const warn = m => result.warnings.push(m)
  const error = m => result.errors.push(m)
  const remoteError = m => { error(`remote check unavailable: ${m}`) }

  // A. Local git / tag.
  const git = localGit(version)
  if (git) {
    result.local.available = true
    result.local.head = git.head
    result.local.tag = git.tag
    result.local.version = version
    result.local.freshness_verified = false // remote freshness requires a fetch; never asserted by this script
    if (git.tag) {
      result.git_tag.available = true
      result.git_tag.commit = git.tag
      try {
        const tagPkg = execFileSync('git', ['show', `v${version}:package.json`], { cwd: repoRoot, encoding: 'utf8' })
        const pkg = JSON.parse(tagPkg)
        result.git_tag.package_version = pkg.version
        if (pkg.version !== version || pkg.name !== '@mengyuly/dsh-ponytail') {
          error(`git tag v${version} package.json mismatch: name=${pkg.name} version=${pkg.version}`)
        }
      } catch (e) {
        result.git_tag.available = false
        error(`cannot read v${version}:package.json: ${e.message}`)
      }
      if (git.head !== git.tag) {
        warn(`local HEAD ${git.head} differs from the v${version} tag ${git.tag}; local source is not the released commit`)
      }
    } else {
      result.git_tag.available = false
      warn(`local git tag v${version} is missing — local checkout is stale or incomplete`)
    }
  } else {
    warn('local git unavailable (not a repository or git missing) — local source not verified')
  }

  if (offline) {
    result.consistent = result.errors.length === 0
    return result
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)

  // B. npm Registry.
  try {
    const metaRes = await fetch(`https://registry.npmjs.org/@mengyuly/dsh-ponytail`, { signal: controller.signal })
    if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status}`)
    const meta = await metaRes.json()
    result.npm.available = true
    result.npm.latest = meta['dist-tags']?.latest ?? null
    result.npm.version = meta['dist-tags']?.latest ?? null
    result.npm.integrity = meta.versions?.[version]?.dist?.integrity ?? null
    result.npm.tarball_url = meta.versions?.[version]?.dist?.tarball ?? npmTarballUrl(version)
    if (result.npm.latest !== version) error(`npm dist-tag latest is ${result.npm.latest}, expected ${version}`)
  } catch (e) {
    remoteError(`npm registry: ${e.cause?.code ?? e.message}`)
  }

  // C. GitHub Release (latest + tag release asset digest).
  let ghTagDigest = null
  try {
    const apiRes = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-ponytail-consistency' },
      signal: controller.signal,
    })
    if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`)
    const rel = await apiRes.json()
    result.github_release.available = true
    result.github_release.latest_tag = rel.tag_name
    result.github_release.is_latest = rel.tag_name === `v${version}`
    const asset = (rel.assets ?? []).find(a => a.name === ASSET_NAME)
    if (asset) {
      result.github_release.size = asset.size
      result.github_release.sha256 = asset.digest?.startsWith('sha256:') ? asset.digest.slice(7) : null
    }
    if (!result.github_release.is_latest) error(`GitHub latest release is ${rel.tag_name}, expected v${version}`)
    if (!asset) error(`GitHub latest release has no ${ASSET_NAME} asset`)
    // The tag release (same tag when latest) may carry its own asset digest.
    const tagRes = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/v${version}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-ponytail-consistency' },
      signal: controller.signal,
    })
    if (tagRes.ok) {
      const tagRel = await tagRes.json()
      const tagAsset = (tagRel.assets ?? []).find(a => a.name === ASSET_NAME)
      if (tagAsset?.digest?.startsWith('sha256:')) ghTagDigest = tagAsset.digest.slice(7)
      if (!tagAsset) error(`GitHub tag release v${version} has no ${ASSET_NAME} asset`)
    }
  } catch (e) {
    remoteError(`GitHub API: ${e.cause?.code ?? e.message}`)
  }

  // D. Assets: npm tarball + GitHub latest + GitHub tag asset.
  let npmBuf = null
  let ghBuf = null
  let ghTagBuf = null
  try {
    npmBuf = await fetchBuffer(npmTarballUrl(version), controller.signal)
    result.npm.size = npmBuf.length
    result.npm.sha256 = sha256(npmBuf)
  } catch (e) {
    remoteError(`npm tarball download: ${e.cause?.code ?? e.message}`)
  }
  try {
    ghBuf = await fetchBuffer(ghLatestUrl(), controller.signal)
    result.github_release.latest_status = 200
    result.github_release.size = ghBuf.length
    result.github_release.sha256 = sha256(ghBuf)
  } catch (e) {
    // Fall back to the GitHub API digest below; only a missing/invalid digest
    // is a hard remote failure.
    result.github_release.latest_status = 'unavailable'
  }
  try {
    ghTagBuf = await fetchBuffer(ghTagUrl(version), controller.signal)
    result.github_release.version_status = 200
    if (!ghTagBuf.equals(ghBuf ?? Buffer.alloc(0))) error('GitHub tag asset differs from latest asset')
  } catch (e) {
    result.github_release.version_status = 'unavailable'
  }

  const haveAssets = npmBuf && ghBuf
  if (haveAssets && !npmBuf.equals(ghBuf)) {
    error(`npm tarball SHA-256 ${result.npm.sha256} differs from GitHub asset SHA-256 ${result.github_release.sha256}`)
  }
  // When direct GitHub asset download fails but the GitHub API reported the
  // asset digest (sha256), cross-check it against the npm tarball's SHA-256.
  // This keeps the byte-level comparison meaningful on flaky asset domains
  // without mistaking a network failure for an inconsistency.
  if (!ghBuf) {
    if (result.github_release.sha256 && npmBuf) {
      if (result.npm.sha256 !== result.github_release.sha256) {
        error(`npm tarball SHA-256 ${result.npm.sha256} differs from GitHub asset digest ${result.github_release.sha256}`)
      } else {
        warn('GitHub asset download unavailable; byte consistency verified via GitHub API digest')
      }
    } else {
      remoteError('GitHub asset digest unavailable and asset download failed — cannot byte-compare GitHub asset')
    }
  }
  // Tag asset: same fallback against the tag release's API digest.
  if (!ghTagBuf) {
    if (ghTagDigest && npmBuf) {
      if (result.npm.sha256 !== ghTagDigest) {
        error(`npm tarball SHA-256 ${result.npm.sha256} differs from GitHub tag asset digest ${ghTagDigest}`)
      } else {
        warn('GitHub tag asset download unavailable; byte consistency verified via GitHub API digest')
      }
    } else if (!result.github_release.is_latest) {
      remoteError('GitHub tag asset digest unavailable and tag asset download failed — cannot verify tag asset')
    }
  }

  // E. Tarball content + provenance.
  if (npmBuf) {
    const entries = readTar(gunzipSync(npmBuf))
    const required = [
      'package.json', 'README.md', 'CHANGELOG.md', 'LICENSE', 'cordis.patch.yml',
      'dist-provenance.json', 'lib/index.js', 'lib/invariant.js',
    ]
    const missing = required.filter(p => !entries.has(`package/${p}`))
    result.tarball.required_files_present = missing.length === 0
    if (missing.length) error(`tarball missing required files: ${missing.join(', ')}`)
    const dtsCount = [...entries.keys()].filter(p => p.startsWith('package/lib/types/') && p.endsWith('.d.ts')).length
    if (dtsCount === 0) error('tarball has no lib/types/*.d.ts declarations')

    const forbidden = ['src', 'scripts', 'tests', 'test', 'tools', '.github']
    const hits = [...entries.keys()].filter(p =>
      forbidden.some(d => p.startsWith(`package/${d}/`)))
    result.tarball.forbidden_directories_absent = hits.length === 0
    if (hits.length) error(`tarball contains forbidden directories: ${hits.join(', ')}`)

    const PORTABLE = new Set([0o644, 0o755, 0o444])
    const nonPortable = [...entries.entries()]
      .filter(([, e]) => !PORTABLE.has(e.mode))
      .map(([p, e]) => `${p}:${e.mode.toString(8)}`)
    result.tarball.permissions_portable = nonPortable.length === 0
    if (nonPortable.length) warn(`tarball has non-portable modes (record for next release fix): ${nonPortable.join(', ')}`)

    const provText = tarFile(entries, 'dist-provenance.json')
    if (provText === undefined) {
      error('tarball missing dist-provenance.json')
    } else {
      let prov
      try {
        prov = JSON.parse(provText)
        const ok = /^https:\/\//.test(prov.sourceRepository ?? '')
          && /^[0-9a-f]{40}$/.test(prov.sourceCommit ?? '')
          && prov.sourcePackage === 'packages/community/ponytail'
          && typeof prov.generatedBy?.node === 'string' && prov.generatedBy.node !== ''
          && typeof prov.generatedBy?.typescript === 'string' && prov.generatedBy.typescript !== ''
          && typeof prov.generatedBy?.tsdown === 'string' && prov.generatedBy.tsdown !== ''
          && typeof prov.generatedBy?.cordis === 'string' && prov.generatedBy.cordis !== ''
        result.provenance.format_valid = ok
        result.provenance.source_commit = prov.sourceCommit ?? null
        if (!ok) error(`provenance format invalid: ${provText.slice(0, 120)}`)
        // Cross-asset provenance match (npm vs GitHub, when both downloaded).
        if (ghBuf) {
          const ghProv = tarFile(readTar(gunzipSync(ghBuf)), 'dist-provenance.json')
          result.provenance.npm_github_match = ghProv === provText
          if (ghProv !== provText) error('provenance differs between npm tarball and GitHub asset')
        } else if (result.npm.sha256 === result.github_release.sha256 && result.github_release.sha256 !== null) {
          // Byte-identical assets (verified via GitHub API digest) imply
          // identical provenance content.
          result.provenance.npm_github_match = true
        }
      } catch (e) {
        result.provenance.format_valid = false
        error(`provenance is not valid JSON: ${e.message}`)
      }
    }
  }

  // F. Verify the provenance sourceCommit exists upstream (deepseek-harness).
  if (result.provenance.source_commit) {
    try {
      const srcRes = await fetch(`https://api.github.com/repos/deepseek-ai/deepseek-harness/commits/${result.provenance.source_commit}`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-ponytail-consistency' },
        signal: controller.signal,
      })
      result.provenance.source_commit_remote_verified = srcRes.ok
      if (!srcRes.ok) error(`sourceCommit ${result.provenance.source_commit} not verified upstream (HTTP ${srcRes.status})`)
    } catch (e) {
      remoteError(`sourceCommit verification: ${e.cause?.code ?? e.message}`)
    }
  }

  clearTimeout(timeout)

  // G. Success condition. When a direct GitHub asset download fails, the
  // GitHub API digest (sha256) cross-check against the npm tarball is enough
  // to verify byte-level consistency; a digest mismatch is a hard error.
  const ghAssetOk = Boolean(ghBuf)
    || (result.github_release.sha256 !== null && result.npm.sha256 === result.github_release.sha256)
  const remoteOk = result.npm.available && result.github_release.available && npmBuf && ghAssetOk
  const allChecksOk = result.errors.length === 0
  result.consistent = Boolean(remoteOk) && allChecksOk
  return result
}

/** CLI entry. */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2)
  const versionArg = args.indexOf('--version')
  const version = versionArg >= 0 ? args[versionArg + 1] : undefined
  const offline = args.includes('--offline')
  const result = await runChecks({ version, offline })
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  const exit = result.errors.some(e => e.startsWith('remote check unavailable'))
    ? 3
    : result.consistent
      ? 0
      : result.errors.length
        ? 1
        : 2
  process.exit(exit)
}
