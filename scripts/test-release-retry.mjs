import assert from 'node:assert/strict'
import { checkWithRetry } from './check-release-consistency.mjs'

const pending = { consistent: false, errors: [
  'npm dist-tag latest is 0.3.3, expected 0.3.4',
  'remote check unavailable: npm tarball download: HTTP 404 for https://registry.npmjs.org/package.tgz',
] }
const success = { consistent: true, errors: [] }
let calls = 0
const waits = []
assert.equal(await checkWithRetry({ attempts: 3, retryDelayMs: 0 },
  async () => ++calls === 2 ? success : pending, async ms => waits.push(ms)), success)
assert.equal(calls, 2)
assert.deepEqual(waits, [0])
calls = 0
assert.equal(await checkWithRetry({ attempts: 3, retryDelayMs: 0 },
  async () => { calls++; return pending }, async () => {}), pending)
assert.equal(calls, 3, 'persistent unpublished release must still fail after the limit')
for (const errors of [
  ['npm tarball SHA-256 abc differs from GitHub asset SHA-256 def'],
  [...pending.errors, 'tarball missing required files: LICENSE'],
  ['remote check unavailable: GitHub API: HTTP 403'],
]) {
  calls = 0
  const mismatch = { consistent: false, errors }
  assert.equal(await checkWithRetry({ attempts: 3, retryDelayMs: 0 },
    async () => { calls++; return mismatch }, async () => assert.fail('must not retry')), mismatch)
  assert.equal(calls, 1)
}
await assert.rejects(checkWithRetry({ attempts: 0 }))
await assert.rejects(checkWithRetry({ attempts: 2, retryDelayMs: -1 }))
console.log('test-release-retry: OK (propagation recovery, bounded failure, hard mismatches preserved)')
