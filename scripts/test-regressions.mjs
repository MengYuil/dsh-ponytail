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
 *  4. Release-consistency offline mode reports the local tag and never
 *     claims remote freshness.
 */
import assert from 'node:assert/strict'
import { collectSourceMapViolations, validateProvenance } from './verify-dist.mjs'
import { escapeCmdArg, formatSpawnFailure } from './lib/run-command.mjs'
import { runChecks } from './check-release-consistency.mjs'

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

// 3b. Windows cmd.exe escaping: `^` in npm version ranges must survive the
//     npm.cmd shell path (otherwise `@pkg@^3.18.0` becomes the exact version
//     `@pkg@3.18.0` and ERESOLVEs when that exact version does not exist).
assert.equal(escapeCmdArg('@deepseek-ai/schemastery@^3.18.0'), '@deepseek-ai/schemastery@^^3.18.0',
  'carets must be doubled for cmd.exe')
assert.equal(escapeCmdArg('install'), 'install', 'plain arguments must pass through unchanged')
assert.equal(escapeCmdArg('@deepseek-ai/cordis@^4.0.1'), '@deepseek-ai/cordis@^^4.0.1',
  'caret ranges must be escaped for npm.cmd')

// 4. Release-consistency script: offline mode validates the local tag without
//    network and never claims remote freshness.
const offline = await runChecks({ version: '0.3.2', offline: true })
assert.equal(offline.local.freshness_verified, false, 'offline mode must not claim remote freshness')
assert.equal(offline.npm.available, null, 'offline mode must not query npm')
assert.equal(offline.github_release.available, null, 'offline mode must not query GitHub')
assert.equal(offline.errors.length, 0, 'offline mode on a clean release checkout must have no errors')

console.log('test-regressions: OK (source-map policy, provenance validation, spawn-failure diagnostics, cmd escaping, release-consistency offline)')
