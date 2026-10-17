#!/usr/bin/env node
// Real published DSH + packed Ponytail + real browser. Isolated profiles only;
// no user credentials, model requests, or mutations of an installed desktop.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isAbsolute, join, resolve } from 'node:path'
import { once } from 'node:events'
import { runNpm, tempWork } from './lib/run-command.mjs'

const version = process.argv[2]
assert.match(version ?? '', /^0\.\d+\.\d+-(?:rc|alpha)\.\d+$/, 'supply an exact published DSH version')
const require = createRequire(resolve(process.env.PONYTAIL_TOOL_ROOT ?? '.', 'package.json'))
const { chromium } = require('playwright')
const repo = resolve(import.meta.dirname, '..')
const work = tempWork(`ponytail-host-ui-${version}-`)
const evidence = join(work.dir, 'evidence')
const runtime = process.env.PONYTAIL_DSH_RUNTIME ? resolve(process.env.PONYTAIL_DSH_RUNTIME) : join(work.dir, 'runtime')
const home = join(work.dir, 'home')
const profile = join(home, 'profiles', 'web')
let host, browser
let output = ''
const safe = text => text.replace(/([?&]token=)[^\s"']+/g, '$1[redacted]')
const errors = []
const read = path => JSON.parse(readFileSync(path, 'utf8'))
try {
  for (const dir of [evidence, runtime, profile]) mkdirSync(dir, { recursive: true })
  if (!process.env.PONYTAIL_DSH_RUNTIME) {
    // Pin the release's own Cordis family, not newer peer-optional packages
    // whose dependency ranges can conflict with historical exact peers.
    const deps = JSON.parse(runNpm(['view', `@deepseek-ai/dsh@${version}`, 'dependencies', '--json'], runtime).stdout)
    const pins = ['cordis', 'cordis-plugin-loader', 'cordis-plugin-include', 'cordis-plugin-group']
      .map(name => `@deepseek-ai/${name}`).filter(name => deps[name]).map(name => `${name}@${deps[name]}`)
    if (version === '0.1.1-rc.2') {
      // This historical release has open peer ranges that now mix incompatible
      // Cordis generations. Reconstruct its own family, without changing DSH.
      runNpm(['install', '--legacy-peer-deps', '--save-exact', '--ignore-scripts', '--no-audit', '--no-fund',
        `@deepseek-ai/dsh@${version}`, `@deepseek-ai/dsh-web-app@${version}`,
        '@deepseek-ai/cordis@4.0.1', '@deepseek-ai/cordis-plugin-loader@1.0.2',
        '@deepseek-ai/cordis-plugin-include@1.0.6', '@deepseek-ai/cordis-plugin-group@1.0.1',
        '@deepseek-ai/cordis-plugin-hmr@1.0.16', '@deepseek-ai/cordis-plugin-timer@1.1.3'], runtime)
      for (let pass = 0; pass < 3; pass++) {
        const missing = new Set()
        const scope = join(runtime, 'node_modules/@deepseek-ai')
        for (const name of readdirSync(scope)) {
          const file = join(scope, name, 'package.json')
          if (!existsSync(file)) continue
          const manifest = read(file), resolvePeer = createRequire(file)
          for (const [peer, range] of Object.entries(manifest.peerDependencies ?? {})) {
            if (!peer.startsWith('@deepseek-ai/dsh-') || !range.includes(version)) continue
            try { resolvePeer.resolve(`${peer}/package.json`) } catch { missing.add(`${peer}@${version}`) }
          }
        }
        if (!missing.size) break
        runNpm(['install', '--legacy-peer-deps', '--save-exact', '--ignore-scripts', '--no-audit', '--no-fund', ...missing], runtime)
      }
    } else {
      runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', `@deepseek-ai/dsh@${version}`,
        `@deepseek-ai/dsh-web-app@${version}`, ...pins], runtime)
    }
  }
  const cli = join(runtime, 'node_modules/@deepseek-ai/dsh')
  assert.equal(read(join(cli, 'package.json')).version, version, 'must test the requested host, not a substituted version')
  const [packed] = JSON.parse(runNpm(['pack', '--json', '--pack-destination', work.dir], repo).stdout)
  const tarball = isAbsolute(packed.filename) ? packed.filename : join(work.dir, packed.filename)
  writeFileSync(join(profile, 'package.json'), JSON.stringify({ private: true, dsh: { profile: { patchReload: 'startup', bundles: [
    '@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@mengyuly/dsh-ponytail',
  ] } } }))
  writeFileSync(join(profile, 'cordis.yml'), '[]\n')
  // Skip only the temporary fixture's welcome wizard; no account is logged in.
  const onboarding = join(runtime, 'node_modules/@deepseek-ai/dsh-client-ui-settings-account/lib/index.js')
  const skipWelcome = existsSync(onboarding) && readFileSync(onboarding, 'utf8').includes('OnboardingSettingsFields')
  writeFileSync(join(profile, 'cordis.patch.yml'), skipWelcome
    ? '- id: ui-settings-account\n  config:\n    version: 1\n    step: done\n    completion: skipped\n    purpose: null\n    process: standard\n'
    : '[]\n')
  runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], profile)
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PONYTAIL_')))
  Object.assign(env, { DSH_HOME: home, XDG_CONFIG_HOME: join(work.dir, 'legacy-config'),
    APPDATA: join(work.dir, 'appdata') })
  const launch = async () => {
    output = ''
    host = spawn(process.execPath, ['--expose-internals', join(cli, 'lib/bin.js'),
      'web', '--host', '127.0.0.1', '--port', '0', '--no-open'], { cwd: work.dir, env, stdio: ['ignore', 'pipe', 'pipe'] })
    return await new Promise((resolveUrl, reject) => {
      const timer = setTimeout(() => reject(new Error(`host startup timed out\n${safe(output.slice(-6000))}`)), 60000)
      const onData = data => {
        output += data.toString()
        const match = output.match(/dsh web:\s+(http:\/\/127\.0\.0\.1:\d+[^\s]*)/)
        if (match) { clearTimeout(timer); resolveUrl(match[1]) }
      }
      host.stdout.on('data', onData)
      host.stderr.on('data', onData)
      host.once('error', error => { clearTimeout(timer); reject(error) })
      host.once('exit', code => { clearTimeout(timer); reject(new Error(`host exited ${code}\n${safe(output.slice(-6000))}`)) })
    })
  }
  const stop = async () => {
    if (!host || host.exitCode !== null) return
    const exited = once(host, 'exit')
    host.kill()
    await exited
  }
  browser = await chromium.launch({ headless: true,
    ...(process.env.PONYTAIL_BROWSER_CHANNEL ? { channel: process.env.PONYTAIL_BROWSER_CHANNEL } : {}) })
  const page = await browser.newPage({ locale: 'zh-CN' })
  page.on('pageerror', error => errors.push(error.message))
  const open = async url => {
    await page.goto(url)
    const account = page.getByRole('button', { name: /^(账号菜单|Account menu)$/ })
    const settings = page.getByRole('button', { name: /^(设置|Settings)$/ })
    await settings.or(account).first().waitFor()
    const welcome = page.getByRole('dialog', { name: /^(开始使用|Get started)$/ })
    // The account describe RPC may open onboarding after the sidebar mounts.
    // Wait for that asynchronous choice before clicking behind its modal mask.
    try { await welcome.waitFor({ state: 'visible', timeout: 5000 }) } catch (error) {
      if (error.name !== 'TimeoutError') throw error
    }
    if (await welcome.isVisible()) await welcome.getByRole('button', { name: /^(关闭|Close)$/ }).click()
    writeFileSync(join(evidence, 'before-settings.txt'), await page.locator('body').innerText())
    if (await page.getByText(/^(预览版说明|内测声明)$/, { exact: true }).isVisible()
      || await page.getByText('Preview notice', { exact: true }).isVisible()) {
      await page.getByRole('button', { name: /^(继续|Continue)$/ }).click()
      try { await welcome.waitFor({ state: 'visible', timeout: 5000 }) } catch (error) {
        if (error.name !== 'TimeoutError') throw error
      }
      if (await welcome.isVisible()) await welcome.getByRole('button', { name: /^(关闭|Close)$/ }).click()
    }
    const keySetup = page.getByRole('dialog', { name: /^(添加一个 API Key 开始使用|Add an API key to get started)$/ })
    try { await keySetup.waitFor({ state: 'visible', timeout: 5000 }) } catch (error) {
      if (error.name !== 'TimeoutError') throw error
    }
    if (await keySetup.isVisible()) await keySetup.getByRole('button', { name: /^(稍后配置|Set up later)$/ }).click()
    if (await settings.count()) await settings.click()
    else {
      await account.click()
      await page.getByRole('menuitem', { name: /^(设置|Settings)$/ }).click()
    }
    const dialog = page.getByRole('dialog', { name: /^(设置|Settings)$/ })
    await dialog.getByRole('button', { name: /^(内置插件|插件|Built-in plugins|Plugins)$/ }).click()
    const tab = dialog.getByRole('tab', { name: 'Ponytail', exact: true })
    const configuration = dialog.getByRole('tab', { name: /^(插件配置|Plugin configuration)$/ })
    if (await configuration.count()) await configuration.click()
    // Old hosts render the card directly; modern hosts wrap it in a tab.
    await dialog.locator('.ponytail-settings').or(tab).first().waitFor()
    if (await tab.count()) await tab.click()
    const card = dialog.locator('.ponytail-settings')
    await card.waitFor()
    await card.getByRole('combobox').waitFor({ state: 'visible' })
    return card
  }
  const firstUrl = await launch()
  console.log(`test-host-ui: DSH ${version} started; opening real browser`)
  let card = await open(firstUrl)
  await card.getByRole('combobox').selectOption('ultra')
  await card.getByRole('checkbox').nth(1).uncheck()
  await card.getByRole('button', { name: /^(保存设置|Save settings)$/ }).click()
  await card.getByRole('status').filter({ hasText: /设置已保存|Settings saved/ }).waitFor()
  assert.equal(await card.getByRole('combobox').inputValue(), 'ultra')
  assert.equal(await card.getByRole('checkbox').nth(1).isChecked(), false)
  await page.screenshot({ path: join(evidence, 'saved.png'), fullPage: true })
  await stop()
  card = await open(await launch())
  assert.equal(await card.getByRole('combobox').inputValue(), 'ultra', 'mode must survive a real host restart')
  assert.equal(await card.getByRole('checkbox').nth(1).isChecked(), false, 'skill toggle must survive restart')
  await card.getByRole('button', { name: /^(恢复面板默认|Reset panel defaults)$/ }).click()
  await card.getByRole('status').filter({ hasText: /已恢复面板默认|Panel defaults restored/ }).waitFor()
  assert.equal(await card.getByRole('combobox').inputValue(), 'inherit')
  assert.equal(await card.getByRole('checkbox').nth(1).isChecked(), true)
  assert.deepEqual(errors, [], 'no renderer exceptions allowed')
  writeFileSync(join(evidence, 'result.json'), JSON.stringify({ hostVersion: version, pluginVersion: packed.version,
    checks: ['visible panel', 'save mode', 'save skill', 'host restart persistence', 'reset defaults'],
    externalModelCalls: 0, verdict: 'passed' }, null, 2))
  console.log(`test-host-ui: OK (DSH ${version}: real panel, save, restart, reset; no model calls)`)
} catch (error) {
  writeFileSync(join(evidence, 'result.json'), JSON.stringify({ hostVersion: version,
    verdict: 'failed', error: safe(error.stack ?? String(error)) }, null, 2))
  error.message = safe(error.message ?? String(error))
  if (error.stack) error.stack = safe(error.stack)
  throw error
} finally {
  writeFileSync(join(evidence, 'host.log'), safe(output))
  if (browser) await browser.close()
  if (host && host.exitCode === null) { const exited = once(host, 'exit'); host.kill(); await exited }
  work.cleanup()
}
