# dsh-ponytail

![CI](https://github.com/MengYuil/dsh-ponytail/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
[![npm](https://img.shields.io/npm/v/@mengyuly/dsh-ponytail)](https://www.npmjs.com/package/@mengyuly/dsh-ponytail)
[![dsh.so security](https://www.dsh.so/badge/dsh-ponytail-4.svg)](https://www.dsh.so/artifact/dsh-ponytail-4/)

把 [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)（「懒惰资深开发者」最少代码心智）移植成 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 原生插件。功能与效率与上游一致：7 级阶梯规则集每轮注入、强度切换、`/ponytail-*` 斜杠命令。

## 安装

装进某个 profile（`web` 可换成 `tui`/自定义名）：

```bash
# 方式一：本地链接（当前 dsh 核 ≥ 0.1.x）
dsh plugin --profile web add link:$(pwd)

# 方式二：GitHub 直接装
dsh plugin --profile web add github:MengYuil/dsh-ponytail

# 方式三：Release 打包件（先下 tgz）
dsh plugin --profile web add file:./mengyuly-dsh-ponytail-0.1.3.tgz

# 方式四：npm
dsh plugin --profile web add @mengyuly/dsh-ponytail
```

装完重启 profile 生效（`dsh web` / `dsh tui`）。装载完成后，会话技能目录里会出现 6 个 `ponytail*` 技能，发 `/ponytail-help` 立即验证。

> `lib/index.js` 是自包含 bundle（已内联 `dsh-llm` / `dsh-skill`——npm 无兼容版本），运行时依赖两个已发布的 peer：`@deepseek-ai/cordis`（4.0.1）与 `@deepseek-ai/schemastery`（3.18.x）。`schemastery` 刻意保持外置而非内联：其 schema DSL 用 `new Function` 编译 `callback` 字符串，外置后**发行产物不含任何动态代码执行**（CI 有专门检查）。GitHub / tgz / npm 三种安装方式都不需要 dsh 源码树。

> 说明：`src/` 是源码、`lib/` 是预构建产物（开箱即可加载，无需编译）。源码主仓在 deepseek-harness 的 `packages/community/ponytail`；改源码后用 `DSH_CHECKOUT=/path/to/deepseek-harness npm run sync:dist` 重建并同步完整 `lib/`（见下「发行维护」）。

## 功能

- **核心模式** `/ponytail` — 每轮注入「懒惰阶梯」：能不做就不做（YAGNI）→ 代码库已有 → 标准库 → 平台原生 → 已装依赖 → 一行能解决 → 才是最少代码。
  - `full`（默认）/ `lite` / `ultra` / `off` 四档，**会话级**（会话 A 的档位不影响会话 B，会话结束自动释放）。
  - 裸 `/ponytail`：已启用时只报告；会话为 `off` 时恢复到有效默认档（有效默认也是 `off` 则回 `full`）。
  - `/ponytail status`：只查询、永不修改。
  - `/ponytail lite|full|ultra|off`：显式切换。
  - `/ponytail default <mode>`：持久化默认值到配置文件（环境变量仍优先）。
- **一次性技能**（用哪个载哪个，不进常驻 prompt）：
  - `/ponytail-review` — 针对最近改动找过度工程，一行一条：位置 + 删什么 + 替代。
  - `/ponytail-audit` — 全仓库过度工程审计，排序清单。
  - `/ponytail-debt` — 收割所有 `ponytail:` 注释成债务账本。
  - `/ponytail-gain` — 收益计分板（更少代码/更省成本/更快）。
  - `/ponytail-help` — 参考卡。
- **停用**：说 `stop ponytail` 或 `normal mode`（兼容中英文句末标点）；随时 `/ponytail` 恢复。
- **默认值**：环境变量 `PONYTAIL_DEFAULT_MODE` > `~/.config/ponytail/config.json`（Windows：`%APPDATA%\ponytail\config.json`）的 `{"defaultMode": "lite"}` > `full`。`/ponytail default` 写入的是配置文件，**环境变量设置且合法时仍压过保存值**（命令会分别提示 saved 与 effective）。
- **子代理**：常驻段作用于当前会话自身；DSH 内置 `subagent` 工具跑的是隔离的全新子代理、不继承本 persona。`PONYTAIL_SUBAGENT_MATCHER`（匹配子代理 `agentPreset` 的正则）用于在 harness 会下发给子代理的场景里排除指定子代理；缺省全部注入。
- **配置错误**：非法 JSON / 非法 `defaultMode` / 读取失败 / 非法正则只告警一次（不刷屏）；配置文件不存在属正常、不告警；热更新遇到临时非法内容保留上一个合法默认值。

## 效率

- 常驻注入 ≈ 1.3k tokens/请求，`off` 归零；同模式字节级稳定，KV-cache 前缀命中，切模式后才重算一次。
- 一次性技能 300–540 tokens 一个，零常驻开销。
- 实测同任务 A/B：ponytail 臂 34 行 vs 完整实现臂 272 行，均标准库、均自测通过。

## 已知限制

- 强度档位只切换阶梯表格/示例，阶梯正文恒定；lite/full/ultra 体积差异很小（行为倾向，非大小差异）。
- 上游 Claude 专属的 statusline 徽标无 DSH 对应物，MCP 服务器因 DSH 有一等 system-prompt 注入点而弃用。
- 配置文件的默认档位热更新（fs 轮询 ~1s，作用于无覆盖的会话）；环境变量改动仍需重启。
- 发行 `lib/` 是预编译产物；改源码请回主仓重建后同步。

## 测试环境与权威关系

- 本机（Linux，Node.js **v24.16.0**，deepseek-harness checkout 构建）与 CI 矩阵（**ubuntu-latest + windows-latest**，Node 24）上验证通过。与之精确匹配的已发布 DSH/Cordis 版本**待确认**——checkout 是预发布工作树，非发布 tag。
- 权威源码在 deepseek-harness monorepo 的 `packages/community/ponytail`（`@deepseek-ai/dsh-ponytail`）；本仓库（`@mengyuly/dsh-ponytail`）是**发行镜像**：随包附构建产物，不是独立真源。

## 发行维护

- **权威源码**：deepseek-harness monorepo 的 `packages/community/ponytail`（本仓库是发行镜像，只随包发布构建产物）。
- **完整重新生成并同步 `lib/`**（JS 与声明必须作为同一产物同步，禁止只复制单个 JS 文件）：
  ```bash
  DSH_CHECKOUT=/path/to/deepseek-harness npm run sync:dist
  ```
  该命令在权威 checkout 中重建（`tsc` 生成声明 + `tsdown` 打包运行时），同步 `lib/index.js`、`lib/invariant.js`、`lib/types/*.d.ts`，生成 `dist-provenance.json`（记录权威 checkout 的真实 commit SHA 与工具链版本），并自动执行一致性校验；产物有变化时会提示提交。**完整构建一致性由本命令在发布流程中完成——发行镜像 CI 不会重新构建权威 monorepo。**
- **验证命令**（Linux / Windows 通用，跨平台进程调用见 `scripts/lib/run-command.mjs`）：
  ```bash
  npm run verify:dist      # 静态一致性：src/d.ts 导出一致、关键签名、主入口运行时导出、无 source map、provenance 合法
  npm run verify:pack      # tarball 内容/版本、安装后 smoke（如实报告实际安装的依赖）
  npm run test:consumer    # NodeNext + skipLibCheck:false 的声明消费测试（对打包产物）
  npm run test:regressions # 验证工具自身的回归测试（source map 策略、provenance、spawn 诊断）
  ```
- **CI 能力边界（如实）**：CI（ubuntu + windows 矩阵）执行上述静态验证与打包/消费测试，但**不重新构建权威 monorepo**；`verify:dist` 是导出表面/签名/运行时导出的一致性检查，**不是**与权威构建的字节级等价证明——后者由 `sync:dist` 在发布流程中保证。
- `dist-provenance.json` 随 npm 包发布，便于审计构建来源。
- 本机验证时若 `npm_execpath` 指向其他包管理器（如 pnpm/yarn shim），脚本会自动回退到 PATH 上的 `npm`；临时目录失败时保留需设 `PONYTAIL_VERIFY_KEEP_TEMP=1`。
- **安全**：`scripts/**` 仅用于开发/构建/发行验证，**不进入 npm tarball**、无安装生命周期钩子、运行时入口不引用；`child_process` 告警属于可接受的开发工具风险。详见 [SECURITY.md](SECURITY.md)。

## 许可

MIT，© 2026 DietrichGebert（上游）+ MengYuil（移植）。详见 [LICENSE](LICENSE)。