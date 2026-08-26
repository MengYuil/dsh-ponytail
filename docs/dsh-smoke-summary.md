# DSH Smoke Benchmark — 摘要与证据边界

> **This is a directional smoke test, not a statistically significant
> benchmark.** 本摘要不是论文级结论，也不复现上游 Benchmark 百分比。

## 测试环境

- DSH：headless 一次性 Agent 驱动（`dsh --profile bench-<arm> "<prompt>"`，
  cwd=独立工作区）；模型 `deepseek-v4-flash`（deepseek-official，
  reasoningEffort=max，settings.yaml 固定，三臂相同）
- 被测插件：`@mengyuly/dsh-ponytail@0.2.1`（本摘要随 0.2.2 维护整理）
- 每 run：独立 workspace / Session / 对话历史；`PONYTAIL_DEFAULT_MODE` 与
  `PONYTAIL_SUBAGENT_MATCHER` 已清除；未向实验组发送 `/ponytail status`
- Profile：bench-baseline（无插件，合并配置零 ponytail 痕迹）、bench-full、
  bench-ultra（`defaultMode` 钉住，dump-config SHA-256 留档，除 ponytail
  配置外三臂逐行一致）
- 会话 usage 从 `$DSH_HOME/sessions/**/session.jsonl.zstd` 提取
  （`assistant/message` 的 `data.usage` 累计 = observed session tokens，
  非 Provider 账单）

## 三轮测试

1. **24-session smoke**（3 臂 × 4 任务 × 2 次，最小 fixture）：
   date-picker / csv-export / safe-path / csv-sum；确定性 stdlib 验收
   （good reference 全过、bad reference 被拒，4/4 任务）。
2. **Real-repo Date Picker**（baseline/full × 2，n=2/臂）：
   full-stack-fastapi-template @ `cd83fc10ca20393e9ee50e3005e170c6929e047e`
   （每 run `git rev-parse HEAD` 校验 + `reset --hard` + `clean -fdx`）。
3. **Real-repo File Dropzone**（baseline/full × 2，n=2/臂）：同一 fixture。

## 结果摘要

| 测试 | 关键结果 | 状态 |
|------|----------|------|
| A/A 预检 | baseline × {safe-path, date-picker} × 2：4/4 exit=0、正确性一致；safe-path 低方差；date-picker input tokens 组内差 ~105%（真实仓库执行路径方差） | 无系统性偏差迹象 |
| safe-path（最小 fixture） | 中位数 28.5 → 11.5 LOC（−59.65%，计算：(11.5−28.5)/28.5） | **一次明显减码** |
| Date Picker（真实仓库） | 4/4 静态端到端完整；两臂均选原生 `type="date"`（**地板效应**：baseline 已最小）；Full 样本中位数 LOC −6.6%、耗时 −23.6%（高方差，不可归因） | 地板效应 |
| File Dropzone（真实仓库） | 4/4 静态端到端完整；baseline 2/2 自建组件（FileInput/FileDropzone）；Full rep-1 原生内联 base64（319 LOC）、rep-2 与 baseline 同路线（165 LOC）；baseline rep-1 超时（最重实现 900s 未收尾，无效） | **实现路线高方差** |

Token / 成本（24-session smoke 实测）：

- observed input：baseline 93,543 / full 100,734（+7.7%）/ ultra 100,555（+7.5%）
- observed cached：baseline 607,104 / full 659,456 / ultra 707,200（计费未知）
- observed output：合计 92,633（定义见上）
- **cost_usd 全部为 null**（会话日志无成本字段）——**费用未知，无任何
  "省钱"结论**；cached 读取不计入普通 input，也不可忽略

## 动态验证阻断说明

pnpm install/build 受离线网络阻断、后端 pytest 依赖不可导入 → 真实仓库两轮
的 `build_passed` / `tests_passed` 为 **null**，`environment_blocked=true`；
验收为**静态端到端完整性**（表单 → 状态 → 提交 payload → 后端 schema →
前端生成类型同步的静态证据链），**不视为动态构建/测试通过**。

## 证据结论分级

- **已证明**：插件真实注入（full/ultra 会话系统提示词含 ponytail 指令段，
  baseline 零痕迹）；Profile 隔离；主 Skill 为指针卡、不再携带旧 Full 规则；
  上游收益数据来源标注正确。
- **初步支持**：Ponytail 在部分过度构建任务中可能减少代码或工作量
  （safe-path 一次明显减码；Date Picker 方向符合）。
- **尚未证明**：稳定 Token 节省；稳定成本降低；稳定延迟改善；跨任务、
  跨模型普遍有效；DSH 适配版复现上游 Benchmark 百分比。

## 原始数据

- 完整 runs（result.json / stdout / stderr / diff / numstat / git-status /
  test-output）：仓库 `dsh-ponytail-smoke`（GitHub
  MengYuil/dsh-ponytail-smoke，private）的 `runs/`、`runs-real/`、
  `runs-dropzone/`；本地路径 `dsh-ponytail-smoke/`。
- 报告全文：`report.md` / `report-real.md` / `report-dropzone.md`（同仓库）。
