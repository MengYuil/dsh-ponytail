#!/usr/bin/env node
/**
 * Static dist-consistency verification, runnable WITHOUT the monorepo:
 *
 *  1. Declarations exist and MUST NOT reference any declaration source map
 *     (the release policy since v0.1.4 turned `declarationMap` off — a
 *     reappearing `sourceMappingURL` is a regression, not a file to look up).
 *  2. The public export set of each src module equals the export set declared
 *     by its committed `lib/types/*.d.ts` (a new src export with a stale d.ts
 *     fails here).
 *  3. `modes.d.ts` declares the exact signatures the runtime uses.
 *  4. The runtime exports of `lib/index.js` match the declared public surface.
 *  5. `dist-provenance.json` (written by `sync:dist`) is present and valid.
 *
 * This is STATIC consistency verification. It is not a byte-level proof that
 * the committed lib equals a fresh authoritative build — that equivalence is
 * established by `npm run sync:dist` at release time; this mirror's CI does
 * not rebuild the deepseek-harness monorepo.
 *
 * Exits non-zero on the first failing category.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const EXPORT_RE = /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z_$][\w$]*)/g
const names = (text) => { const set = new Set(); for (const m of text.matchAll(EXPORT_RE)) set.add(m[1]); return set }

/** Value exports only (function/const/class) — what the runtime bundle must expose. */
const VALUE_EXPORT_RE = /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/g
const valueNames = (text) => { const set = new Set(); for (const m of text.matchAll(VALUE_EXPORT_RE)) set.add(m[1]); return set }

/**
 * A declaration file that references a source map is a regression: since
 * v0.1.4 the release policy is `declarationMap: false`, and a dangling
 * `sourceMappingURL` would mean a half-synced artifact slipped through.
 * @param dtsText - contents of one `.d.ts`.
 * @param label - file label for the error message.
 * @returns one message per offending reference.
 */
export function collectSourceMapViolations(dtsText, label) {
  const messages = []
  for (const match of dtsText.matchAll(/\/\/# sourceMappingURL=(\S+)/g)) {
    messages.push(`${label} must not contain sourceMappingURL (found: ${match[1]})`)
  }
  return messages
}

/**
 * Validate a `dist-provenance.json` document (schema written by `sync:dist`).
 * @param doc - the parsed document.
 * @param sourcePackage - the expected `sourcePackage` value.
 * @returns one message per problem; empty means valid.
 */
export function validateProvenance(doc, sourcePackage) {
  const messages = []
  if (!doc || typeof doc !== 'object') return ['dist-provenance.json: not a JSON object']
  const { sourceRepository, sourceCommit, sourcePackage: pkg, generatedBy } = doc
  if (typeof sourceRepository !== 'string' || !/^https:\/\//.test(sourceRepository)) {
    messages.push('dist-provenance.json: sourceRepository must be an https URL')
  }
  if (typeof sourceCommit !== 'string' || !/^[0-9a-f]{40}$/.test(sourceCommit)) {
    messages.push('dist-provenance.json: sourceCommit must be a full 40-hex git SHA')
  }
  if (pkg !== sourcePackage) {
    messages.push(`dist-provenance.json: sourcePackage must be ${sourcePackage}`)
  }
  if (!generatedBy || typeof generatedBy !== 'object') {
    messages.push('dist-provenance.json: generatedBy missing')
  } else {
    for (const key of ['node', 'typescript', 'tsdown', 'cordis']) {
      if (typeof generatedBy[key] !== 'string' || generatedBy[key] === '') {
        messages.push(`dist-provenance.json: generatedBy.${key} missing`)
      }
    }
  }
  return messages
}

/** Run the full verification; returns the failure list (empty = pass). */
export async function runDistChecks() {
  const failures = []
  const check = (condition, message) => { if (!condition) failures.push(message) }
  const dts = (base) => readFileSync(join(repoRoot, 'lib', 'types', `${base}.d.ts`), 'utf8')
  const src = (base) => readFileSync(join(repoRoot, 'src', `${base}.ts`), 'utf8')

  // 1. Declarations exist; no source-map references (release policy).
  for (const base of ['index', 'modes', 'instructions', 'content', 'invariant']) {
    const text = dts(base)
    for (const message of collectSourceMapViolations(text, `${base}.d.ts`)) failures.push(message)
  }

  // 2. src export set == committed declaration export set.
  for (const base of ['index', 'modes', 'instructions', 'content', 'invariant']) {
    const declared = names(dts(base))
    const fromSrc = names(src(base))
    const missing = [...fromSrc].filter(x => !declared.has(x))
    const extra = [...declared].filter(x => !fromSrc.has(x))
    check(missing.length === 0, `${base}: src exports absent from lib/types/${base}.d.ts: ${missing.join(', ')}`)
    check(extra.length === 0, `${base}: lib/types/${base}.d.ts declares exports absent from src: ${extra.join(', ')}`)
  }

  // 3. modes.d.ts must match the runtime contract.
  const modes = dts('modes')
  check(/compileSubagentMatcher\(raw: string \| undefined\): \{/.test(modes)
    && /invalid: boolean/.test(modes), 'modes.d.ts: compileSubagentMatcher must return { matcher, invalid }')
  check(/readDefaultModeInfo/.test(modes), 'modes.d.ts: readDefaultModeInfo missing')
  check(/sessionKey/.test(modes), 'modes.d.ts: sessionKey missing')
  check(/DefaultModeIssueKind/.test(modes), 'modes.d.ts: DefaultModeIssueKind missing')
  check(/DefaultModeIssue/.test(modes), 'modes.d.ts: DefaultModeIssue missing')
  check(/DefaultModeResolution/.test(modes), 'modes.d.ts: DefaultModeResolution missing')
  check(/writeDefaultMode\(mode: unknown, env\?: NodeJS\.ProcessEnv\): PonytailRuntimeMode \| null/.test(modes),
    'modes.d.ts: writeDefaultMode must return PonytailRuntimeMode | null')
  check(/Throws when the write itself fails/.test(modes), 'modes.d.ts: writeDefaultMode must document throwing')

  // 4. Runtime exports of lib/index.js match the declared public surface. The
  //    bundle's runtime dependencies are @deepseek-ai/cordis and
  //    @deepseek-ai/schemastery (both published registry peers); minimal stubs
  //    in the repo's own node_modules (gitignored, removed below) let Node
  //    resolve them from lib/index.js's location. schemastery is built
  //    eagerly at import (dsh-llm's retry-policy schemas) but never
  //    parsed/executed by the ponytail runtime path, so a chainable stub
  //    suffices.
  const stubRoot = join(repoRoot, 'node_modules', '@deepseek-ai')
  const stubs = [
    ['cordis', 'export class Service {}'],
    ['schemastery', [
      'const chainable = () => new Proxy(() => {}, {',
      '  get: (target, prop) => {',
      "    if (prop === Symbol.toPrimitive) return () => '[schema]'",
      "    if (prop === 'then') return undefined",
      '    return chainable()',
      '  },',
      '  apply: () => chainable(),',
      '})',
      'export default chainable()',
    ].join('\n')],
  ]
  for (const [name, source] of stubs) {
    const dir = join(stubRoot, name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `@deepseek-ai/${name}`, type: 'module', main: 'index.js' }))
    writeFileSync(join(dir, 'index.js'), source)
  }
  try {
    const mod = await import(pathToFileURL(join(repoRoot, 'lib', 'index.js')).href)
    const runtime = new Set(Object.keys(mod))
    const declared = valueNames(dts('index'))
    check([...declared].every(x => runtime.has(x)), `lib/index.js lacks declared exports: ${[...declared].filter(x => !runtime.has(x)).join(', ')}`)
    check([...runtime].every(x => declared.has(x)), `lib/index.js exports beyond the declarations: ${[...runtime].filter(x => !declared.has(x)).join(', ')}`)
    check(mod.name === 'ponytail' && typeof mod.apply === 'function'
      && typeof mod.containsDeactivation === 'function' && typeof mod.messageText === 'function',
    'lib/index.js plugin shape mismatch')
  } finally {
    rmSync(join(repoRoot, 'node_modules'), { recursive: true, force: true })
  }

  // 5. Provenance recorded by sync:dist is present and valid.
  const provenancePath = join(repoRoot, 'dist-provenance.json')
  check(existsSync(provenancePath), 'dist-provenance.json missing — run npm run sync:dist to regenerate lib/ and provenance')
  if (existsSync(provenancePath)) {
    try {
      const doc = JSON.parse(readFileSync(provenancePath, 'utf8'))
      for (const message of validateProvenance(doc, 'packages/community/ponytail')) failures.push(message)
    } catch (error) {
      failures.push(`dist-provenance.json: invalid JSON: ${error.message}`)
    }
  }

  // 6. Published runtime boundary: no install-time execution, no development
  //    scripts reachable from the shipped entry points.
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
  const scripts = manifest.scripts ?? {}
  for (const name of ['preinstall', 'install', 'postinstall']) {
    check(scripts[name] === undefined, `package.json must not define install lifecycle script: ${name}`)
  }
  check(scripts.prepare === undefined, 'package.json must not define a prepare script (audit before adding)')

  const allowedExportTargets = new Set(['package.json', 'cordis.patch.yml'])
  const exportTargets = []
  const collect = (value) => {
    if (typeof value === 'string') exportTargets.push(value)
    else if (value && typeof value === 'object') for (const v of Object.values(value)) collect(v)
  }
  collect(manifest.main)
  collect(manifest.types)
  collect(manifest.exports)
  for (const target of exportTargets) {
    const normalized = target.startsWith('./') ? target.slice(2) : target
    check(allowedExportTargets.has(normalized) || (normalized.startsWith('lib/') && existsSync(join(repoRoot, normalized))),
      `package entry target must live under lib/ (or be package metadata): ${target}`)
  }

  for (const [file, label] of [['lib/index.js', 'lib/index.js'], ['lib/invariant.js', 'lib/invariant.js']]) {
    const text = readFileSync(join(repoRoot, file), 'utf8')
    const importPattern = /(?:from|import\s*\(|require\s*\()\s*["'][^"']*scripts\//g
    const hits = [...text.matchAll(importPattern)]
    check(hits.length === 0, `${label} must not import from scripts/ (found ${hits.length})`)
  }
  const patch = readFileSync(join(repoRoot, 'cordis.patch.yml'), 'utf8')
  check(!/scripts\//.test(patch), 'cordis.patch.yml must not reference scripts/')
  return failures
}

/** Execute only when run directly (also importable for regression tests). */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const failures = await runDistChecks()
  if (failures.length > 0) {
    console.error(`verify-dist: FAILED\n- ${failures.join('\n- ')}`)
    process.exit(1)
  }
  console.log('verify-dist: OK (declarations, src↔d.ts exports, runtime exports, no source maps, provenance)')
}
