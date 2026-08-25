#!/usr/bin/env node
/**
 * Minimal assert-based regression tests for the verification tooling itself —
 * no framework, fails loudly on the first broken assertion.
 *
 *  1. A declaration that regains `//# sourceMappingURL=...` must be rejected
 *     by `verify:dist`'s policy check (not crash with a ReferenceError).
 *  2. `dist-provenance.json` validation rejects a non-SHA sourceCommit and a
 *     wrong sourcePackage, and accepts a well-formed document.
 *  3. Spawn-failure diagnostics surface `result.error.message` when
 *     `status === null` (the Windows npm.cmd failure mode).
 */
import assert from 'node:assert/strict'
import { collectSourceMapViolations, validateProvenance } from './verify-dist.mjs'
import { formatSpawnFailure } from './lib/run-command.mjs'

// 1. source-map regression check.
assert.equal(
  collectSourceMapViolations('export declare const x: number;\n//# sourceMappingURL=missing.d.ts.map\n', 'modes').length,
  1,
  'a sourceMappingURL reference must be reported as a violation',
)
assert.match(
  collectSourceMapViolations('x\n//# sourceMappingURL=m.d.ts.map', 'modes')[0] ?? '',
  /modes must not contain sourceMappingURL/,
)
assert.equal(collectSourceMapViolations('export declare const x: number;\n', 'modes').length, 0, 'clean d.ts must pass')

// 2. provenance validation.
const good = {
  sourceRepository: 'https://github.com/deepseek-ai/deepseek-harness',
  sourceCommit: 'a'.repeat(40),
  sourcePackage: 'packages/community/ponytail',
  generatedBy: { node: 'v24.16.0', typescript: '5.9.3', tsdown: '0.22.0', cordis: '4.0.1' },
}
assert.equal(validateProvenance(good, 'packages/community/ponytail').length, 0, 'well-formed provenance must pass')
assert.ok(
  validateProvenance({ ...good, sourceCommit: 'short' }, 'packages/community/ponytail').some(m => /full 40-hex/.test(m)),
  'a short sourceCommit must be rejected',
)
assert.ok(
  validateProvenance({ ...good, sourcePackage: 'elsewhere' }, 'packages/community/ponytail').some(m => /sourcePackage/.test(m)),
  'a wrong sourcePackage must be rejected',
)

// 3. spawn-failure diagnostics with status === null.
const message = formatSpawnFailure(
  { status: null, signal: null, error: new Error('spawn npm ENOENT'), stdout: '', stderr: '' },
  'npm',
  ['pack', '--json'],
  'C:\\repo with spaces',
)
assert.match(message, /status: null \(spawn failed or killed by a signal\)/, 'null status must be explained')
assert.match(message, /spawn error: spawn npm ENOENT/, 'result.error.message must be included')

console.log('test-regressions: OK (source-map policy, provenance validation, spawn-failure diagnostics)')
