# Changelog

All notable changes to `@mengyuly/dsh-ponytail` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.4] - 2026-08-24

### Fixed

- 修复运行时 JS 与 TypeScript declarations 不一致：v0.1.3 只同步了
  `lib/index.js`/`lib/invariant.js`，声明文件停留在旧版本。
- `compileSubagentMatcher` 声明恢复正确（`{ matcher, invalid }`），与运行时一致。
- 补齐 `readDefaultModeInfo`、`sessionKey` 及诊断类型
  （`DefaultModeIssueKind` / `DefaultModeIssue` / `DefaultModeResolution`）的声明。
- `writeDefaultMode` 声明注释补充「写入失败会抛出异常」。
- 移除失效的 declaration source map 引用：声明生成关闭 `declarationMap`，
  发布的 `.d.ts` 不再携带指向不存在 `.d.ts.map` 的 `sourceMappingURL`。

### Changed

- 发布流程改为同步**完整** `lib/`（两个运行时 bundle + 全部 `.d.ts`）：
  `npm run sync:dist`（要求 `DSH_CHECKOUT`，在权威 checkout 中重建后整体同步）。
- CI 增加防漂移检查：src 导出 ↔ 声明导出、运行时导出 ↔ 声明导出、
  `modes.d.ts` 关键签名、无悬空 source map、tarball 内容/版本/安装后 smoke、
  NodeNext + `skipLibCheck:false` 的声明消费测试。
- tarball 现在包含 `CHANGELOG.md`。

### Tests

- npm tarball smoke test（仅声明 peer 安装后加载）。
- TypeScript consumer test（打包安装后编译，非相对路径读 src）。
- 运行时/声明导出一致性验证。
- src↔d.ts 漂移检查（CI 与 `verify:dist` 双保险）。

## [0.1.3] - 2026-08-23

### Fixed

- Bare `/ponytail` on an `off` session now re-enables at the effective default
  (or `full` when that default is `off` too), matching the documented "resume
  anytime with `/ponytail`" behavior. It still only reports when already enabled.
- `/ponytail default <mode>` no longer bypasses `PONYTAIL_DEFAULT_MODE`: the
  effective default is recomputed after the write, so the env var keeps its
  documented highest priority; the result distinguishes saved vs effective.
- Typo: `Ponyytail default set` → `Ponytail default set`.
- Deactivation phrases now also strip CJK sentence enders (`。？！`), so
  `normal mode？` and `stop ponytail。` deactivate as expected.
- Config writes are now atomic (temp file + rename); a failed write returns an
  error instead of a false success.
- A temporarily invalid config during hot-reload keeps the last known good
  default instead of snapping back to `full`.

### Changed

- `/ponytail status` added as a pure query (never modifies the session).
- Command hints and error text updated to the new surface
  (`[status|default <mode>|lite|full|ultra|off]`).
- Invalid config JSON / `defaultMode` / read failures and invalid
  `PONYTAIL_SUBAGENT_MATCHER` now warn exactly once (fail-open preserved,
  missing config file stays silent).
- Session identity is centralized in one `sessionKey(agent)` helper; mode
  overrides are released on `agent/disposed`, so long-running hosts do not
  accumulate stale per-session entries.

### Tests

- 47 unit/integration tests (was 24): command semantics (bare `/ponytail`
  restore paths, `status`, `default` saved-vs-effective, write failure),
  priority (env > config > full, invalid env falls back to config),
  session isolation and disposal cleanup, CJK/ASCII deactivation punctuation,
  config file edge cases (BOM, empty, invalid JSON, array root, unknown-field
  preservation, atomic write), hot-reload keep-last-good, and a headless
  (no command plane) mount.

## [0.1.2] - 2026-08-23

### Changed

- Self-contained bundle: `dsh-llm` / `dsh-skill` are inlined, so the runtime
  only depends on the `@deepseek-ai/cordis` peer — installable from GitHub,
  tarball, or npm without a dsh source tree.
- npm scope renamed to `@mengyuly/dsh-ponytail` (matches the npm account).

### Tests

- CI smoke verifies the bundle leaves no dsh core external and loads with only
  cordis installed.

## [0.1.0] - 2026-08-23

### Added

- Initial release: always-on lazy-senior-developer ruleset, lite/full/ultra/off
  intensities, six skills and slash commands, deactivation phrases,
  `PONYTAIL_DEFAULT_MODE` / config-file defaults, subagent matcher.
