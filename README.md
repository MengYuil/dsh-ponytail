# dsh-ponytail

![CI](https://github.com/MengYuil/dsh-ponytail/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
[![npm](https://img.shields.io/npm/v/@mengyuly/dsh-ponytail)](https://www.npmjs.com/package/@mengyuly/dsh-ponytail)
[![dsh.so security](https://www.dsh.so/badge/dsh-ponytail-4.svg)](https://www.dsh.so/artifact/dsh-ponytail-4/)

将 [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) 的极简编码原则和相关 Skill 适配到 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，提供 YAGNI 决策阶梯、Lite / Full / Ultra / Off 会话级模式，以及一组用于代码精简、审查、审计和技术债追踪的 Skill。

本项目对齐上游核心理念和主要工作流，但 DSH 的模型循环、Prompt 组装、Skill 机制和工具调用不同。**上游 Benchmark 仅作参考，不代表本适配版具有相同的 Token、成本或延迟收益**（详见「效率（条件性收益，非保证）」）。

## GitHub Release 下载

- **稳定 latest 下载**（资产名固定，每次 Release 不变）：
  `https://github.com/MengYuil/dsh-ponytail/releases/latest/download/mengyuly-dsh-ponytail.tgz`
- **固定版本下载**（按 Tag 不可变）：当前 Release 仅提供固定资产名，使用
  `https://github.com/MengYuil/dsh-ponytail/releases/download/v0.3.1/mengyuly-dsh-ponytail.tgz`

说明：

- `latest` 指向最新 GitHub Release；固定资产名 `mengyuly-dsh-ponytail.tgz`
  在每个 Release 中保持不变，因此该 URL 不会因版本号变化而失效。
- 需要完全可复现的构建时，请使用**固定版本 Release 链接**（按 Tag 下载）。
- npm 安装仍走 npm Registry 或 `dsh plugin` 命令；latest Tarball 适合快速
  安装体验，**不适合作为不可变依赖**。
- 固定资产名由 `scripts/release-assets.mjs` 生成并验证（`npm run release:assets`）。

## 安装

装进某个 profile（`web` 可换成 `tui`/自定义名）：

```bash
# 方式一：本地链接（当前 dsh 核 ≥ 0.1.x）
dsh plugin --profile web add link:$(pwd)

# 方式二：GitHub 直接装
dsh plugin --profile web add github:MengYuil/dsh-ponytail

# 方式三：Release 打包件（先下 tgz——latest 固定资产名恒定）
#   https://github.com/MengYuil/dsh-ponytail/releases/latest/download/mengyuly-dsh-ponytail.tgz
dsh plugin --profile web add file:./mengyuly-dsh-ponytail.tgz

# 方式四：npm
dsh plugin --profile web add @mengyuly/dsh-ponytail
```

装完重启 profile 生效（`dsh web` / `dsh tui`）。装载完成后，会话技能目录里会出现 6 个 `ponytail*` 技能，发 `/ponytail-help` 立即验证。

> `lib/index.js` 是自包含 bundle（已内联 `dsh-llm` / `dsh-skill`——npm 无兼容版本），运行时依赖两个已发布的 peer：`@deepseek-ai/cordis`（4.0.1）与 `@deepseek-ai/schemastery`（3.18.x）。`schemastery` 刻意保持外置而非内联：其 schema DSL 用 `new Function` 编译 `callback` 字符串，外置后**发行产物不含任何动态代码执行**（CI 有专门检查）。GitHub / tgz / npm 三种安装方式都不需要 dsh 源码树。

> 说明：`src/` 是源码、`lib/` 是预构建产物（开箱即可加载，无需编译）。源码主仓在 deepseek-harness 的 `packages/community/ponytail`；改源码后用 `DSH_CHECKOUT=/path/to/deepseek-harness npm run sync:dist` 重建并同步完整 `lib/`（见下「发行维护」）。

## 功能

- **核心模式** `/ponytail` — 每轮注入结构化的懒惰开发者规则集，**三个档位是真实不同的 Prompt 片段**（不只是换一行）：
  - **Common（所有非 off 档共享）**：先理解问题、追踪真实调用流；优先复用/标准库/原生能力/已有依赖；非平凡改动留一个最小可运行检查；解释简短但不省略关键决策。
  - **Safety（任何档位都不可删）**：输入校验、防数据丢失的错误处理、安全措施、无障碍、明确验收项、先理解问题、「最小 diff ≠ 正确修复」。
  - **`lite`**：完整交付明确要求；可以一句话指出更简方案，但**不挑战明确需求**；输出可略完整。
  - **`full`（默认）**：完整七级阶梯（YAGNI → 复用 → 标准库 → 原生 → 已装依赖 → 一行 → 最小实现），默认选最短正确实现，修根因而非症状。
  - **`ultra`**：YAGNI 极端（先删后加）；主动质疑投机性功能/缓存/抽象/配置/新依赖；复杂需求先给最小正确版并说明完整版条件；**不是无脑拒绝**。
  - `off`：完全不注入。
  - 档位**会话级**（会话 A 不影响会话 B，会话结束自动释放）。
  - 裸 `/ponytail`：已启用时只报告；`off` 时恢复到有效默认档（默认也是 `off` 则回 `full`）。
  - `/ponytail status`：只查询、永不修改。
  - `/ponytail lite|full|ultra|off`：显式切换。
  - `/ponytail default <mode>`：持久化默认值到**用户级配置文件**（env/Profile 仍优先，命令分别提示 saved 与 effective）。
- **一次性技能**（用哪个载哪个，不进常驻 prompt）：
  - `/ponytail-review` — 针对最近改动找过度工程，一行一条：位置 + 删什么 + 替代。
  - `/ponytail-audit` — 全仓库过度工程审计，排序清单。
  - `/ponytail-debt` — 收割所有 `ponytail:` 注释成债务账本。
  - `/ponytail-gain` — 上游 Benchmark 参考计分板（代码减少；Token/成本/延迟效果取决于模型与任务，**非本适配版保证**）。
  - `/ponytail-help` — 参考卡。
- **停用**：说 `stop ponytail` 或 `normal mode`（兼容中英文句末标点）；随时 `/ponytail` 恢复。
- **默认值优先级**（代码/测试/文档一致）：
  ```
  会话 override > PONYTAIL_DEFAULT_MODE > Profile config.defaultMode > 用户 config.json > full
  ```
  - **Profile 级配置**（Cordis 官方插件配置 API，各 profile 可不同）：
    ```yaml
    # ~/.dsh/profiles/tui/cordis.patch.yml 中给 ponytail 行补 config
    - insert:
        - id: ponytail
          name: '@mengyuly/dsh-ponytail'
          config:
            defaultMode: lite
    ```
    例：`web → full`、`tui → lite`、`automation → off`。Profile 配置在插件初始化时读取（Cordis 无公开配置变更事件），**改后需重启该 profile**；非法值只告警一次并回退，不影响启动。用户 `config.json` 仍保持热更新。
  - **用户 config.json**（`~/.config/ponytail/config.json`，Windows `%APPDATA%\ponytail\config.json`）：`{"defaultMode": "lite"}`，热更新（~1s 轮询），非法内容保留上次合法值。
- **子代理（如实边界）**：DSH 内置 `subagent` 工具是**隔离派生**，但全局 system-prompt section 默认也会参与子代理的独立组装；这不是父代理 Prompt 或会话状态继承。`PONYTAIL_SUBAGENT_MATCHER`（匹配子代理 `agentPreset` 的正则）只用于筛选能进入本 Prompt 管线的子代理，不是继承开关；无 preset 时不会被 matcher 排除。DSH 当前没有公开的父子 Prompt 继承 API，因此**不宣称父子 Prompt 继承**（有官方 API 后再考虑只读模式快照传播）。非法正则告警一次并 fail-open。
- **配置错误**：非法 JSON / 非法 `defaultMode` / 读取失败 / 非法正则只告警一次（不刷屏）；配置文件不存在属正常、不告警。

## 效率（条件性收益，非保证）

Ponytail 会给每次模型请求增加一小段固定规则。它的收益是**有条件的**：
当 Agent 容易过度设计时，减少的代码、工具调用和返工可能抵消甚至超过
这部分开销；当任务本来已经很简单时，收益可能接近零，甚至出现额外输入
开销。它不是"省 Token 开关"，也不保证跨模型省钱——某些推理模型可能因
prompt 与推理开销变得更贵。

本 DSH 适配版当前 Prompt 段实测大小（`npm run measure:prompt`，从真实
`getPonytailInstructions()` 生成）：

| 档位 | 字符数 | UTF-8 字节 | 说明 |
|------|--------|-----------|------|
| lite | 1918 | 1920 | 实测生成 |
| full | 3036 | 3052 | 实测生成 |
| ultra | 2823 | 2839 | 实测生成 |
| off | 0 | 0 | 不注入 |

这些是 **Prompt 体积测量，不是账单金额，也不是对所有模型成立的节省
比例**（无统一 tokenizer，`measure:prompt` 输出中 `estimated_tokens` 为
null；字符数/4 只是粗略估算）。同模式字节级稳定，KV-cache 前缀命中。

**上游数据不是本 DSH 适配版的保证**：上游 Ponytail 的 single-shot
（代码 −80~94%、成本 −42~75%、延迟 3.1–5.8×）与 agentic（LOC −54% 等）
结果仅作参考；DSH 适配版**未建立**稳定的 Token/成本/延迟节省率。DSH
Smoke Benchmark 只提供方向性证据（见 `docs/dsh-smoke-summary.md`）。

## 已知限制

- 档位差异在**规则语义**上（见上），三者 Prompt 体积相近（实测见上表）。
- 上游 Claude 专属的 statusline 徽标无 DSH 对应物，MCP 服务器因 DSH 有一等 system-prompt 注入点而弃用。
- 用户 `config.json` 热更新；`PONYTAIL_DEFAULT_MODE` 与 Profile config 需重启生效。
- 发行 `lib/` 是预编译产物；改源码请回主仓重建后同步。

## 兼容矩阵（实测，不虚构）

| 组件 | 已验证环境 | 备注 |
|---|---|---|
| Node.js | 22.x / 24.x | CI 矩阵 4 组合全绿 |
| OS | ubuntu-latest / windows-latest | CI 矩阵 |
| DSH | commit `b150a551`（构建所用 checkout） | 与正式发布版本的精确对应关系**待确认** |
| Cordis | 4.0.1（构建所用 vendor） | 同上 |
| web profile | 已验证 | 本机真实 profile 长期运行 + 三路径隔离安装实测（npm / GitHub / tgz） |
| tui profile | 未验证 | 未在 tui profile 中启动测试 |
| headless profile | 未验证 | 未完整启动；插件单元测试运行于无 UI 环境 |
| npm tarball | 已验证 | 内容/版本/安装后 smoke/NodeNext consumer |

- `dist-provenance.json` 记录实际构建来源（checkout commit + node/typescript/tsdown/cordis 版本）。
- 不要用 `continue-on-error` 掩盖失败——矩阵全绿才是绿。

## 测试环境与权威关系

- 本机（Linux，Node.js **v24.16.0**，deepseek-harness checkout 构建）与 CI 矩阵（**ubuntu-latest + windows-latest × Node 22/24**）上验证通过。与之精确匹配的已发布 DSH/Cordis 版本**待确认**——checkout 是预发布工作树，非发布 tag。
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