#!/usr/bin/env node
/**
 * Measure the ponytail prompt-section size per mode, generated from the REAL
 * getPonytailInstructions() implementation (src/instructions.ts, loaded via
 * Node's native TypeScript type stripping — requires Node >= 22.18, where
 * type stripping is enabled by default; on older Node 22 run with
 * `--experimental-strip-types`).
 *
 * Output is prompt-size measurement only: chars and UTF-8 bytes. There is no
 * unified tokenizer here, so estimated_tokens is null (0 for `off`, which is
 * empty by construction) — these numbers are NOT provider usage and NOT a
 * billing guarantee.
 *
 * Usage: npm run measure:prompt
 */
import { getPonytailInstructions } from '../src/instructions.ts'

const MODES = ['lite', 'full', 'ultra', 'off']
const out = {}
for (const mode of MODES) {
  const text = getPonytailInstructions(mode)
  out[mode] = {
    bytes: Buffer.byteLength(text, 'utf8'),
    chars: text.length,
    estimated_tokens: mode === 'off' ? 0 : null,
    note: 'rough estimate only; tokenizer and model dependent',
  }
}
process.stdout.write(JSON.stringify(out, null, 2) + '\n')
