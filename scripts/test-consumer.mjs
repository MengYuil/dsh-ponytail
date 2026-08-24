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
 * Exits non-zero when tsc reports anything.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
const work = mkdtempSync(join(tmpdir(), 'ponytail-consumer-'))
const npm = (args, cwd) => spawnSync('npm', args, { cwd, encoding: 'utf8' })

try {
  const packed = npm(['pack', '--json', '--pack-destination', work], repoRoot)
  if (packed.status !== 0) throw new Error(`npm pack failed: ${(packed.stderr ?? '').slice(-400)}`)
  const tgz = join(work, JSON.parse(packed.stdout)[0].filename)

  const install = npm(['install', '--no-save', '--no-audit', '--no-fund', tgz,
    '@deepseek-ai/cordis@^4.0.1', 'typescript@^5.9.3', '@types/node@^24'], work)
  if (install.status !== 0) throw new Error(`npm install failed: ${(install.stderr ?? '').slice(-400)}`)

  writeFileSync(join(work, 'consumer.mts'), [
    `import { apply, containsDeactivation, inject, messageText, name } from '${pkg.name}';`,
    `const entry: string = name;`,
    `const deps: string[] = inject;`,
    `const hit: boolean = containsDeactivation([{ content: [{ type: 'text', text: 'stop ponytail' }] }]);`,
    `const body: string = messageText({ content: [{ type: 'text', text: 'hello' }] });`,
    `const fn: typeof apply = apply;`,
    `void entry; void deps; void hit; void body; void fn;`,
    '',
  ].join('\n'))

  writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({
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

  const tsc = spawnSync(join(work, 'node_modules', '.bin', 'tsc'), ['-p', join(work, 'tsconfig.json')], {
    cwd: work,
    shell: process.platform === 'win32',
    encoding: 'utf8',
  })
  if (tsc.status !== 0) {
    console.error(`test-consumer: tsc --noEmit FAILED\n${tsc.stdout}${tsc.stderr}`)
    process.exit(1)
  }
  console.log(`test-consumer: OK (NodeNext, skipLibCheck:false, against the packed tarball of ${pkg.name}@${pkg.version})`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
