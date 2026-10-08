#!/usr/bin/env node
// Downstream build: reuse the existing inlined host dependencies, transpile
// the reviewed plugin entry, and emit the browser module-loader factory.
// This is not a fresh authoritative monorepo build.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const require = createRequire(resolve(process.env.PONYTAIL_TOOL_ROOT ?? '.', 'package.json'))
const ts = require('typescript')
const esbuild = require('esbuild')
const source = readFileSync('src/index.ts', 'utf8')
const result = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  transformers: { before: [context => file => ts.factory.updateSourceFile(file,
    file.statements.filter(node => !ts.isImportDeclaration(node)))] },
})
let runtime = readFileSync('lib/index.js', 'utf8')
// Recompile the rule fragment too: source-only edits must reach installed DSH.
const rulesStart = runtime.indexOf('//#region lib/types/instructions.js')
const rulesEnd = runtime.indexOf('//#endregion', rulesStart)
if (rulesStart < 0 || rulesEnd < 0) throw new Error('Instruction region missing; refusing to overwrite the bundle')
const rules = ts.transpileModule(readFileSync('src/instructions.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  transformers: { before: [context => file => ts.factory.updateSourceFile(file,
    file.statements.filter(node => !ts.isImportDeclaration(node)))] },
}).outputText.replace(/^export (?=function getPonytailInstructions\b)/m, '')
if (/^export\s/m.test(rules)) throw new Error('Unexpected instruction export; review the bundle contract')
runtime = runtime.slice(0, rulesStart) + '//#region lib/types/instructions.js\n'
  + rules + runtime.slice(rulesEnd)
const boundary = runtime.indexOf('//#region lib/types/index.js') >= 0
  ? runtime.indexOf('//#region lib/types/index.js') : runtime.indexOf('// Downstream entry compiled from src/index.ts.')
if (boundary < 0) throw new Error('Existing host entry boundary missing; refusing to overwrite the bundle')
writeFileSync('lib/index.js', runtime.slice(0, boundary) + '// Downstream entry compiled from src/index.ts.\n' + result.outputText)
await esbuild.build({
  entryPoints: ['src/client.ts'], outfile: 'lib/client.js', bundle: true,
  platform: 'browser', format: 'cjs', target: 'es2022', external: ['react'],
  banner: { js: 'window.__ModuleLoader__.load({ id: "@mengyuly/dsh-ponytail", factory: (require) => { const module = { exports: {} };' },
  footer: { js: 'return module.exports; } });' },
})
const provenance = JSON.parse(readFileSync('dist-provenance.json', 'utf8'))
provenance.downstreamBuild = {
  method: 'scripts/build-ui.mjs; retains baseline inlined host dependencies',
  node: process.version, typescript: ts.version, esbuild: esbuild.version,
  sha256: Object.fromEntries(['src/index.ts', 'src/client.ts', 'src/content.ts', 'src/instructions.ts',
    'src/modes.ts', 'lib/index.js', 'lib/client.js'].map(file =>
    [file, createHash('sha256').update(readFileSync(file)).digest('hex')])),
}
writeFileSync('dist-provenance.json', JSON.stringify(provenance, null, 2) + '\n')
console.log('build-ui: downstream host entry and client factory compiled (not an authoritative monorepo rebuild)')
