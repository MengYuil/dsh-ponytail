# dsh-ponytail

把 [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)（「懒惰资深开发者」最少代码心智）移植成 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 原生插件。功能与效率与上游一致：7 级阶梯规则集每轮注入、强度切换、`/ponytail-*` 斜杠命令。

## 安装

装进某个 profile（`web` 可换成 `tui`/自定义名）：

```bash
# 方式一：本地链接（当前 dsh 核 ≥ 0.1.x）
dsh plugin --profile web add link:$(pwd)

# 方式二：GitHub 直接装
dsh plugin --profile web add github:MengYuil/dsh-ponytail

# 方式三：Release 打包件（先下 tgz）
dsh plugin --profile web add file:./dsh-ponytail-0.1.0.tgz
```

装完重启 profile 生效（`dsh web` / `dsh tui`）。装载完成后，会话技能目录里会出现 6 个 `ponytail*` 技能，发 `/ponytail-help` 立即验证。

> 说明：`src/` 是源码、`lib/` 是预构建产物（开箱即可加载，无需编译）。源码主仓在 deepseek-harness 的 `packages/community/ponytail`，改源码后回主仓重建，再把 `lib/` 同步回本仓库即可发版。

## 功能

- **核心模式** `/ponytail` — 每轮注入「懒惰阶梯」：能不做就不做（YAGNI）→ 代码库已有 → 标准库 → 平台原生 → 已装依赖 → 一行能解决 → 才是最少代码。
  - `full`（默认）/ `lite` / `ultra` / `off` 四档，会话级。
  - `/ponytail default <mode>` 持久化默认值。
- **一次性技能**（用哪个载哪个，不进常驻 prompt）：
  - `/ponytail-review` — 针对最近改动找过度工程，一行一条：位置 + 删什么 + 替代。
  - `/ponytail-audit` — 全仓库过度工程审计，排序清单。
  - `/ponytail-debt` — 收割所有 `ponytail:` 注释成债务账本。
  - `/ponytail-gain` — 收益计分板（更少代码/更省成本/更快）。
  - `/ponytail-help` — 参考卡。
- **停用**：说 `stop ponytail` 或 `normal mode`；随时 `/ponytail` 恢复。
- **默认值**：环境变量 `PONYTAIL_DEFAULT_MODE` > `~/.config/ponytail/config.json` 的 `{"defaultMode": "lite"}` > `full`。
- **子代理**：`PONYTAIL_SUBAGENT_MATCHER`（匹配子代理 `agentPreset` 的正则）可排除指定子代理；缺省全部注入。

## 效率

- 常驻注入 ≈ 1.3k tokens/请求，`off` 归零；同模式字节级稳定，KV-cache 前缀命中，切模式后才重算一次。
- 一次性技能 300–540 tokens 一个，零常驻开销。
- 实测同任务 A/B：ponytail 臂 34 行 vs 完整实现臂 272 行，均标准库、均自测通过。

## 已知限制

- 强度档位只切换阶梯表格/示例，阶梯正文恒定；lite/full/ultra 体积差异很小（行为倾向，非大小差异）。
- 上游 Claude 专属的 statusline 徽标无 DSH 对应物，MCP 服务器因 DSH 有一等 system-prompt 注入点而弃用。
- 默认值按进程缓存，外部改 `config.json` 需重启 dsh。
- 发行 `lib/` 是预编译产物；改源码请回主仓重建后同步。

## 许可

MIT，© 2026 DietrichGebert（上游）+ MengYuil（移植）。详见 [LICENSE](LICENSE)。