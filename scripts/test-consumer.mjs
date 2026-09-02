#!/usr/bin/env node
/**
 * TypeScript consumer test against the ACTUAL packed and installed package —
 * never against `src/` by relative path.
 *
 *  1. `npm pack` the release tarball.
 *  2. Install it into a clean temp dir together with its declared peer
 *     (`@deepseek-ai/cordis`) plus `typescript` and `@types/node` for the run.
 *  3. Compile a NodeNext consumer that imports the public entry
 *     (`apply`, `containsDeactivation`, `inject`, `messageText`, `name`) with
 *     `skipLibCheck: false`, so broken declarations fail instead of being
 *     masked.
 *
 * The `modes` subpath is intentionally NOT imported: package.json does not
 * declare a public `./modes` export, and this test must not expand the API.
 *
 * tsc is started via `process.execPath` + the TypeScript CLI JS entry
 * (`typescript/lib/tsc.js`) — the cross-platform way to invoke it without a
 * `.cmd` wrapper or a shell.
 *
 * Exits non-zero when tsc reports anything. Temporary files are removed
 * unless `PONYTAIL_VERIFY_KEEP_TEMP=1` is set.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNpm, runNode, tempWork } from './lib/run-command.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
const work = tempWork('ponytail-consumer-')

try {
  const packed = runNpm(['pack', '--json', '--pack-destination', work.dir], repoRoot)
  const packedJson = JSON.parse(packed.stdout)
  const entry0 = Array.isArray(packedJson) ? packedJson[0] : packedJson
  const tgz = isAbsolute(entry0.filename) ? entry0.filename : join(work.dir, entry0.filename)

  // Caret-free ranges on purpose: npm.cmd on Windows re-parses arguments
  // through cmd.exe, which would eat `^` (see scripts/lib/run-command.mjs).
  runNpm(['install', tgz,
    '@deepseek-ai/cordis@4', 'typescript@5', '@types/node@24'], work.dir)

  writeFileSync(join(work.dir, 'consumer.mts'), [
    `import { apply, containsDeactivation, inject, messageText, name } from '${pkg.name}';`,
    `const entry: string = name;`,
    `const deps: string[] = inject;`,
    `const hit: boolean = containsDeactivation([{ content: [{ type: 'text', text: 'stop ponytail' }] }]);`,
    `const body: string = messageText({ content: [{ type: 'text', text: 'hello' }] });`,
    `const fn: typeof apply = apply;`,
    `void entry; void deps; void hit; void body; void fn;`,
    '',
  ].join('\n'))

  writeFileSync(join(work.dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'es2024',
      module: 'nodenext',
      moduleResolution: 'nodenext',
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      types: ['node'],
    },
    include: ['consumer.mts'],
  }, null, 2))

  const tscEntry = join(work.dir, 'node_modules', 'typescript', 'lib', 'tsc.js')
  runNode(tscEntry, ['-p', join(work.dir, 'tsconfig.json')], work.dir)
  console.log(`test-consumer: OK\n(NodeNext, skipLibCheck:false, packed tarball of ${pkg.name}@${pkg.version})`)
} finally {
  work.cleanup()
}
