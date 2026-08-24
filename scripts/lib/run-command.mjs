#!/usr/bin/env node
/**
 * Development/release tooling only.
 *
 * This file is excluded from the npm tarball, is not referenced by the
 * installed runtime entry, and is never executed by install lifecycle hooks.
 * It runs only when a maintainer explicitly invokes the corresponding npm
 * verification or distribution command.
 *
 * The child_process capability here is the intentional, inherent local
 * execution permission of build tooling — it is NOT part of the installed
 * plugin runtime attack surface. Arguments are passed as arrays; shell use is
 * restricted to the Windows `npm.cmd` fallback; nothing in this module accepts
 * plugin-runtime, model, or network input. See SECURITY.md.
 *
 * `npm` on Windows is `npm.cmd`, a cmd script — `spawnSync('npm', ...)`
 * without a shell cannot start it (spawn error, `status === null`). The
 * reliable invocation is Node itself running npm's own CLI entry:
 * `process.execPath <npm_execpath> ...` — `npm_execpath` is always set inside
 * an `npm run` environment. Outside one, fall back to `npm.cmd` (Windows,
 * with a shell) or `npm` (POSIX).
 *
 * Everything here is stdlib-only and deliberately small.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Bounded tail length for diagnostics, so CI logs cannot blow up. */
const TAIL = 4 * 1024

/**
 * Resolve how to start npm on this platform.
 *
 * Inside an `npm run` environment `npm_execpath` is npm's own CLI entry —
 * spawning `process.execPath <npm_execpath>` is the reliable cross-platform
 * invocation. An inherited `npm_execpath` can also point at ANOTHER package
 * manager (e.g. a pnpm/yarn shim environment leaks `pnpm.mjs` here), whose
 * flag set differs from npm's; in that case — or when it is absent — fall back
 * to `npm`/`npm.cmd` from PATH.
 * @returns `{ command, prefix, shell }` — spawn `command` with `[...prefix, ...args]`.
 */
export function resolveNpmInvocation() {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath && !/pnpm|yarn|bun/i.test(npmExecPath)) {
    return { command: process.execPath, prefix: [npmExecPath], shell: false }
  }
  if (process.platform === 'win32') {
    // Explicit reason for a shell: .cmd files only run through cmd.exe.
    return { command: 'npm.cmd', prefix: [], shell: true }
  }
  return { command: 'npm', prefix: [], shell: false }
}

/**
 * Run npm with a structured failure instead of a bare stderr snippet.
 * @param args - npm arguments (never a single shell string).
 * @param cwd - working directory for the child.
 * @returns the spawnSync result on success (status 0); throws otherwise.
 */
export function runNpm(args, cwd) {
  const { command, prefix, shell } = resolveNpmInvocation()
  const result = spawnSync(command, [...prefix, ...args], { cwd, encoding: 'utf8', shell })
  if (result.status !== 0) {
    throw new Error(formatSpawnFailure(result, command, [...prefix, ...args], cwd))
  }
  return result
}

/**
 * Run a Node script via `process.execPath` (the cross-platform way to start
 * `tsc.js` / CLI entries without `.cmd` wrappers).
 */
export function runNode(scriptPath, args, cwd) {
  const allArgs = [scriptPath, ...args]
  const result = spawnSync(process.execPath, allArgs, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(formatSpawnFailure(result, process.execPath, allArgs, cwd))
  }
  return result
}

/**
 * One structured, bounded failure report for a failed spawn.
 * `status === null` means the process never started (spawn error) or was
 * killed by a signal — reported as such, never as a plain exit code.
 */
export function formatSpawnFailure(result, command, args, cwd) {
  const lines = [
    `command: ${command}`,
    `args: ${JSON.stringify(args)}`,
    `cwd: ${cwd}`,
  ]
  if (result.status === null) {
    lines.push('status: null (spawn failed or killed by a signal)')
    if (result.signal) lines.push(`signal: ${result.signal}`)
    if (result.error) lines.push(`spawn error: ${result.error.message}`)
  } else {
    lines.push(`status: ${result.status}`)
  }
  const stdout = String(result.stdout ?? '')
  const stderr = String(result.stderr ?? '')
  if (stdout) lines.push(`stdout (tail):\n${stdout.slice(-TAIL)}`)
  if (stderr) lines.push(`stderr (tail):\n${stderr.slice(-TAIL)}`)
  return lines.join('\n')
}

/**
 * A temporary work directory that is always removed unless
 * `PONYTAIL_VERIFY_KEEP_TEMP=1` is set (for debugging, the location is printed).
 */
export function tempWork(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  const keep = process.env.PONYTAIL_VERIFY_KEEP_TEMP === '1'
  return {
    dir,
    keep,
    cleanup() {
      if (this.keep) {
        console.log(`PONYTAIL_VERIFY_KEEP_TEMP: keeping ${dir}`)
      } else {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  }
}
