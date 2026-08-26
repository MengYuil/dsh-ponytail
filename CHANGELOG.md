# Changelog

All notable changes to `@mengyuly/dsh-ponytail` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Fixed

- Corrected CHANGELOG release ordering and clarified that upstream benchmark
  results are references rather than guaranteed DSH-adapter outcomes.

## [0.2.2] - 2026-08-26

### Changed

- **`/ponytail-gain` 数据口径修正**：收益数字明确标注为 **Upstream
  reference**（Single-shot：5 任务 × 3 Claude 模型，代码 −80~94%、成本
  −42~75%、延迟 3.1–5.8×；Agentic：真实 Claude Code 会话 × 12 功能任务，
  LOC ~−54%、Token ~−22%、成本 ~−20%、时间 ~−27%、过度构建 −60~94%、
  安全 100%），并注明「These are upstream Ponytail results, not measured
  guarantees for this DSH adapter」「Savings depend on model and workload」
  「Already-minimal tasks may show little or no savings」「Some reasoning
  models may become more expensive」。新增 **DSH adapter status**：当前
  smoke 只支持方向性有效，稳定 Token/成本/延迟节省尚未建立。Skill 描述
  由 "less code, less cost, more speed" 改为 "upstream benchmark reference;
  less unnecessary code, while token, cost, and latency effects depend on
  model and workload"。
- **主 `ponytail` Skill 自动调用策略**：`invocation` 改为
  `modelInvocable: false, userInvocable: true`——指针卡不再进入模型侧
  Skill Catalog（普通编码任务不再重复加载），`/ponytail` 等命令与用户侧
  入口不受影响（命令经 `ctx.skills.get` 加载，不被 modelInvocable 门控；
  语义依据 `@deepseek-ai/dsh-skill` 的 `isModelInvocable`/`isUserInvocable`
  与 `tool-skill` 的 Catalog 过滤源码核实）。whenToUse/描述缩小为
  「仅在用户询问激活/模式/配置/帮助时使用」。
- **`/ponytail-help` 模式选择指导**：新增 Lite/Full/Ultra/Off 使用建议
  （中英双语）与声明「Ponytail is not a guaranteed token-saving switch. It
  trades a small fixed prompt cost for a chance to reduce unnecessary work.
  Do not default every task to Ultra.」
- **README 效率说明改为条件性收益**：移除旧的 369/420/406 手工 Token 数字
  与无出处的 A/B 行；改为实测 Prompt 大小（`npm run measure:prompt`）+
  「收益有条件、非保证」说明 + 「上游数据不是本 DSH 适配版的保证」。
- **新增 `docs/dsh-smoke-summary.md`**：DSH Smoke Benchmark 摘要与证据
  边界（环境、三轮结果、Token/成本口径、动态验证阻断、结论分级），
  明确 directional smoke test；不把 runs 原始数据打进 npm 包。

### Added

- **`scripts/measure-prompt.mjs` + `npm run measure:prompt`**：从真实
  `getPonytailInstructions()` 生成四档 Prompt，输出 chars/bytes 与
  `estimated_tokens`（无统一 tokenizer 时为 null；off 恒为 0），明确
  「rough estimate only; tokenizer and model dependent」，不冒充 Provider
  Usage。Node ≥ 22.18（原生 type stripping）。

### Fixed

- `sync:dist` 成功提示文字补上 `src/`（状态检查列表早已覆盖，仅提示遗漏）。
- CHANGELOG 重复的 `## Unreleased` 标题清理；0.2.1 的 Security 内容归档归位。
- 模块顶部注释补齐完整优先级链（会话 override > env > Profile > 用户
  config > full），与 modes.ts / content.ts / README / d.ts 一致。

### Tests

- Gain Skill：含 upstream reference、区分 single-shot/agentic、不声称
  DSH 适配版保证节省、提示简单任务可能不省与模型差异。
- 主 `ponytail` Skill：仍为指针卡、不含旧 Full 规则；`modelInvocable:
  false` / `userInvocable: true`；五个一次性 Skill 的 invocation 不变。
- Prompt：off 为空、三档互不相同、均含安全边界与明确验收项。

## [0.2.1] - 2026-08-25

### Fixed

- P1: 主 `ponytail` 技能不再携带旧版 Full 规则集——技能正文改为指向注入段的
  **模式感知指针卡**（`PONYTAIL MODE ACTIVE` 段是唯一规则源），Lite/Ultra
  会话里模型不会从技能加载到与当前档位冲突的 Full 规则。
- `/ponytail default` 在「保存值与覆盖源值恰好相同」时（如 env=full 且
  `/ponytail default full`）也会点名覆盖来源，不再漏报。
- `sync:dist` 的产物变更状态检查补上 `src/`（0.2.0 起同步 src 镜像）。
- CHANGELOG 章节顺序修正（Unreleased 回到最顶部）。
- README 兼容矩阵文字更新为 Node 22/24。

### Changed

- `/ponytail-help` 补充 Profile 级 `defaultMode` 配置与完整优先级链
  （会话 override > env > Profile > 用户 config > full）；Ultra 描述改为
  「先删后加、质疑投机，但绝不删明确要求」，与 0.2.0 新语义一致。
- 模块头部注释同步（content.ts / modes.ts）。

### Tests

- ponytail 技能指针卡断言（不含旧 Full 规则）。
- `/ponytail default` 同值覆盖源提示测试。
- 62 tests passed in the authoritative deepseek-harness monorepo package
  (`packages/community/ponytail/tests/`: instructions.spec.ts + ponytail.spec.ts；
  本机实测 62 passed；CI 矩阵见 `.github/workflows/ci.yml`，Ubuntu/Windows ×
  Node 22/24)。此数字来自权威 monorepo 包测试，不是发行镜像
  `verify:dist` / `verify:pack` / `test:consumer` / `test:regressions` 的合计。

### Security

- Documented the development-only `child_process` boundary (`SECURITY.md`):
  `scripts/**` is excluded from the npm tarball, has no install lifecycle
  hook, and is unreachable from the installed runtime entry.
- Added tarball checks preventing `scripts/` (and `src/`, `tests/`, `test/`,
  `tools/`) from being published, plus a post-install assertion that the
  installed package contains no `scripts/`.
- Added checks preventing `preinstall` / `install` / `postinstall` /
  `prepare` lifecycle hooks from silently invoking development tooling.
- Classified repository-only `child_process` findings as accepted
  development-tooling risk.

## [0.2.0] - 2026-08-24

### Added

- 真正区分 lite/full/ultra 的 Prompt：从「Markdown 正则过滤同一份正文」改为
  **结构化片段组合**（Common 规则 + 永不可删的 Safety 边界 + 各档独立规则）。
  - `lite`：完整交付明确要求、可一句话提示更简方案、不挑战明确需求；
  - `full`：完整七级阶梯、默认最短正确实现、修根因；
  - `ultra`：先删后加、主动质疑投机性功能/缓存/抽象/配置/新依赖、先给最小
    正确版并说明完整版条件、不是无脑拒绝；
  - 三档共享 Common + Safety（输入校验/数据丢失防护/安全/无障碍/明确验收项）。
  - 常驻注入从 ~1.3k tokens 降到 **lite≈369 / full≈420 / ultra≈406** tokens。
- **Cordis Profile 级 `defaultMode` 配置**：`config: { defaultMode }` 按
  profile 生效（`web → full`、`tui → lite` 等），优先级
  `会话 override > env > Profile > 用户 config.json > full`；非法值告警一次
  并回退；Profile 配置初始化时读取（Cordis 无公开配置变更事件），重启生效；
  `/ponytail default` 的 saved/effective 提示现在会点名覆盖来源
  （`PONYTAIL_DEFAULT_MODE` / `profile configuration`）。
- 兼容矩阵：CI 扩展为 **Node 22 × Node 24 × ubuntu × windows**（4 组合）；
  `dist-provenance.json` 增加 `generatedBy.cordis`；README 记录实测矩阵
  （含 web profile 本机验证、tui/headless 如实标注未验证）。
- 结构化 Prompt 的行为测试、快照测试、token 统计测试；Profile 优先级测试
  （env>profile、会话 override>env、非法回退、双 profile 不同默认）。

### Changed

- 默认模式解析加入 Profile 档（代码/测试/README 三处一致）。
- README：三档真实差异、Profile 配置示例、兼容矩阵、子代理边界表述。

### Fixed

- 删除随旧实现遗留的 `filterSkillBodyForMode` 正则过滤路径及其测试
  （被结构化组合取代）。

### Security

- 无变化（0.1.6 的 eval-free 产物与 dev-tooling 边界保持）。
## [0.1.6] - 2026-08-24

### Fixed

- 移除发行产物中的动态代码执行：`new Function` 的调用点来自内联进 bundle 的
  schemastery（其 schema DSL 会把字符串 `callback` 编译成函数）。已把
  `@deepseek-ai/schemastery` 从 bundle **外置**为已发布的 peer（与 cordis
  同等对待），发行 `lib/index.js` 不再包含任何 `new Function` / `eval`
  （CI 的 `check-bundle` 现在断言外链集合精确为
  `cordis + schemastery`，且产物零动态执行）。该调用点在本插件运行时路径上
  本不可达（只构造、不解析），外置是消除扫描告警的根治，也是更诚实的依赖声明。

### Changed

- 运行时依赖表述更新：bundle 现在 import `@deepseek-ai/cordis` +
  `@deepseek-ai/schemastery`（两者都已发布）；`dsh-llm` / `dsh-skill` 仍内联
  （npm 无兼容版本）。
- `@deepseek-ai/schemastery` 加入 peerDependencies（宿主兼容声明）。
- `verify-dist` 的运行时导出检查改用链式可调用 stub 加载 bundle
  （schemastery 在模块加载时被急切构建 schema，但本插件路径不解析它们）。
- 移除只做类型检查、职责与 `sync:dist` 重叠的 `scripts/build.sh`。

### Tests

- Ubuntu + Windows（CI 矩阵）：check-bundle（外链白名单 + 零动态执行）、
  verify:dist、verify:pack、test:consumer、test:regressions。
- tarball 安装 smoke 现在显式安装 cordis + schemastery 两个运行时 peer。

## [0.1.5] - 2026-08-24

### Fixed

- Windows 下验证脚本无法启动 `npm.cmd`：`spawnSync('npm', …)` 在 Windows 上对
  `.cmd` 无效（`status === null`）。现在统一走 `process.execPath + npm_execpath`
  （npm script 环境内为 npm 自身 CLI，跨平台可靠），并在 `npm_execpath` 缺失或
  指向其他包管理器（pnpm/yarn/bun shim）时回退到 `npm`/`npm.cmd`。
- `spawnSync` 启动失败时错误信息丢失：统一 `formatSpawnFailure` 输出 command、
  args、cwd、status、signal、`result.error.message`、stdout/stderr 尾部
  （各 4KB 上限）；`status === null` 明确判为启动失败或被信号终止，不再显示为
  普通退出码。
- `verify-dist` 不再有未定义 `existsSync` 的潜伏分支：改为**直接拒绝**任何
  `sourceMappingURL`（与 v0.1.4 起 `declarationMap: false` 的发布策略一致），
  并新增回归测试证明声明文件重现 source map 时验证会明确失败。
- 删除 CI 中 checkout 后立即执行的无效 `git diff --exit-code -- lib` 步骤
  （工作区天然干净，证明不了任何事）；防漂移表述与真实能力对齐。

### Changed

- `verify-pack` / `test-consumer` 共用 `scripts/lib/run-command.mjs` 跨平台进程
  工具，不再各自维护一套 `spawnSync('npm', …)`。
- `verify-pack` 如实报告实际安装的依赖（npm 会解析全部声明 peers，包括宿主
  契约 peers；bundle 运行时只 import `@deepseek-ai/cordis` 由独立外链检查证明）。
- CI 增加 Windows Runner（`windows-latest` + `ubuntu-latest` 矩阵，Node 24，
  不允许跳过或 continue-on-error）。
- `sync:dist` 生成 `dist-provenance.json`：`sourceCommit` 来自权威 checkout 的
  `git rev-parse HEAD`（真实 SHA，不手工填写），工具链版本取自 checkout 的
  node_modules，不含本机绝对路径；`verify:dist` 校验其格式。
- tarball 现在包含 `dist-provenance.json`。
- 产物一致性检查命名与真实能力一致：`verify:dist` 是静态一致性检查（src/d.ts
  导出、关键签名、主入口运行时导出、无 source map、provenance），不是与权威
  构建的字节级等价证明。

### Tests

- Ubuntu：verify:dist / verify:pack / test:consumer / test:regressions 全部通过。
- Windows：CI 矩阵真实执行 verify:dist / verify:pack / test:consumer。
- npm tarball smoke（仅声明依赖安装后加载）。
- NodeNext + skipLibCheck:false consumer。
- 子进程启动失败诊断回归测试。
- declaration source map 回归测试。

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
