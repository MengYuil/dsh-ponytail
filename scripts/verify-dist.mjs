#!/usr/bin/env node
/**
 * Static dist-consistency verification, runnable WITHOUT the monorepo:
 *
 *  1. Every committed declaration exists and carries no dangling
 *     `sourceMappingURL` reference.
 *  2. The public export set of each src module equals the export set declared
 *     by its committed `lib/types/*.d.ts` (the drift guard: an added src
 *     export with a stale d.ts fails here).
 *  3. `modes.d.ts` declares the exact signatures the runtime uses
 *     (`compileSubagentMatcher` → `{ matcher, invalid }`, the diagnostic
 *     types, `sessionKey`, and `writeDefaultMode` throwing on write failure).
 *  4. The runtime exports of `lib/index.js` match the declared public surface
 *     of `lib/types/index.d.ts` (the bundle is imported against a minimal
 *     `@deepseek-ai/cordis` stub — the bundle's only runtime dependency).
 *
 * Exits non-zero on the first failing category.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

const dts = (base) => readFileSync(join(repoRoot, 'lib', 'types', `${base}.d.ts`), 'utf8')
const src = (base) => readFileSync(join(repoRoot, 'src', `${base}.ts`), 'utf8')

// 1. Declarations exist; no dangling source-map references.
const EXPORT_RE = /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z_$][\w$]*)/g
const names = (text) => { const set = new Set(); for (const m of text.matchAll(EXPORT_RE)) set.add(m[1]); return set }

for (const base of ['index', 'modes', 'instructions', 'content', 'invariant']) {
  const text = dts(base)
  for (const m of text.matchAll(/\/\/# sourceMappingURL=(\S+)/g)) {
    check(existsSync(join(repoRoot, 'lib', 'types', m[1])), `${base}.d.ts references a missing map: ${m[1]}`)
  }
}

// 2. src export set == committed declaration export set (drift guard).
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
//    bundle's only runtime dependency is @deepseek-ai/cordis; a minimal stub
//    in the repo's own node_modules (gitignored, removed below) lets Node
//    resolve it from lib/index.js's location.
const stubDir = join(repoRoot, 'node_modules', '@deepseek-ai', 'cordis')
mkdirSync(stubDir, { recursive: true })
writeFileSync(join(stubDir, 'package.json'), JSON.stringify({ name: '@deepseek-ai/cordis', type: 'module', main: 'index.js' }))
writeFileSync(join(stubDir, 'index.js'), 'export class Service {}')
try {
  const mod = await import(pathToFileURL(join(repoRoot, 'lib', 'index.js')).href)
  const runtime = new Set(Object.keys(mod))
  const declared = names(dts('index'))
  check([...declared].every(x => runtime.has(x)), `lib/index.js lacks declared exports: ${[...declared].filter(x => !runtime.has(x)).join(', ')}`)
  check([...runtime].every(x => declared.has(x)), `lib/index.js exports beyond the declarations: ${[...runtime].filter(x => !declared.has(x)).join(', ')}`)
  check(mod.name === 'ponytail' && typeof mod.apply === 'function'
    && typeof mod.containsDeactivation === 'function' && typeof mod.messageText === 'function',
  'lib/index.js plugin shape mismatch')
} finally {
  rmSync(join(repoRoot, 'node_modules'), { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`verify-dist: FAILED\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('verify-dist: OK (declarations, src↔d.ts drift, runtime exports, source maps)')
