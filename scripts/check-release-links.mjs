#!/usr/bin/env node
/**
 * Static guard: no version-pinned `latest` Release tarball links.
 *
 * The `releases/latest/download/...` URL must point to a STABLE asset name
 * (`mengyuly-dsh-ponytail.tgz`) so it survives version bumps. Any of:
 *   releases/latest/download/mengyuly-dsh-ponytail-0.2.1.tgz
 *   releases/latest/download/mengyuly-dsh-ponytail-0.2.2.tgz
 *   releases/latest/download/mengyuly-dsh-ponytail-${VERSION}.tgz
 * is rejected. Version-pinned URLs under `releases/download/<tag>/...` are
 * allowed (they are immutable by tag).
 *
 * Scans: README.md, CHANGELOG.md, docs/**, .github/workflows/**, scripts/**.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const SCAN = ['README.md', 'CHANGELOG.md', 'docs', '.github/workflows', 'scripts']
const LATEST_FIXED = /releases\/latest\/download\/mengyuly-dsh-ponytail\.tgz/
// a latest-download link whose asset name carries anything after the base name
const LATEST_VERSIONED = /releases\/latest\/download\/mengyuly-dsh-ponytail(?:[^/\s)]*[0-9][^/\s)]*)?\.tgz/
const TAG_VERSIONED = /releases\/download\/v\d+\.\d+\.\d+\/mengyuly-dsh-ponytail-\d+\.\d+\.\d+\.tgz/

function filesUnder(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...filesUnder(p))
    else out.push(p)
  }
  return out
}

function scanFiles() {
  const out = []
  for (const target of SCAN) {
    const p = join(root, target)
    try {
      if (statSync(p).isDirectory()) out.push(...filesUnder(p))
      else out.push(p)
    } catch { /* missing path: fine */ }
  }
  const self = fileURLToPath(import.meta.url)
  return out.filter(f => f !== self && /\.(md|yml|yaml|mjs|js|json)$/.test(f))
}

let failures = 0
for (const file of scanFiles()) {
  const text = readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    if (!line.includes('releases/')) continue
    if ((LATEST_VERSIONED.test(line) && !LATEST_FIXED.test(line)) || TAG_VERSIONED.test(line)) {
      console.error(`check-release-links: versioned asset link is not published in ${relative(root, file)}:\n  ${line.trim()}`)
      failures++
    }
  }
}
if (failures > 0) {
  console.error(`check-release-links: FAIL (${failures} version-pinned latest link(s)) — use the stable asset name mengyuly-dsh-ponytail.tgz`)
  process.exit(1)
}
console.log('check-release-links: OK (no version-pinned latest tarball links)')
