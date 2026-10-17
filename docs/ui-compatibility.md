# 图形设置兼容验证

日期：2026-10-17。对象为 **0.4.3** 的运行时修复；旧 npm 0.4.2 不包含本次面板修复。
首次测试包保留开发期间的 0.4.2 版本号，最终发布包更新为 0.4.3；下方运行时 SHA-256 不变。
以下均为真实宿主/真实浏览器测试，不以“安装成功”代替面板可用。

| DSH | 环境 | 最终结果 |
|---|---|---|
| 0.1.1-rc.2 | npm / Windows / Chrome，固定 Cordis 4.0.1 同代依赖 | 通过 |
| 0.1.2-rc.1 | npm / Windows / Chrome | 通过 |
| 0.1.5-rc.3 | npm / Windows / Chrome | 通过 |
| 0.1.7-rc.2 | npm / Windows / Chrome | 通过 |
| 0.2.0-rc.2 | npm / Windows / Chrome | 通过 |
| 0.2.1-rc.2 | npm / Windows / Chrome | 通过 |
| 0.2.0-rc.2 官方桌面版 | Windows / 实际 Electron 窗口 / 独立 Profile | 通过 |

每个 Web 版本均从实际 npm tarball 安装 Ponytail，检查：

1. 设置中能看到 Ponytail 面板。
2. 保存 Ultra 默认模式并停用 `ponytail-audit`。
3. 终止并重新启动宿主，确认两项设置保留。
4. 恢复面板默认，确认 `inherit` 与技能启用状态恢复。
5. 无浏览器未捕获异常，无模型请求。

桌面版检查相同的加载、保存、实际重启保留和恢复行为，保存模式使用 Full。
测试配置与日常桌面 Profile 分离；不使用用户凭证、不发送聊天消息。

## 修复与额外回归

- 按真实依赖能力分开旧 Settings scope 与新 ConfigForms 注册，不再将
  Cordis inject 的拦截配置误当作可选依赖。
- 新版设置保存至当前 Profile，通过 volatile 配置实时更新，不重挂插件。
- 对失败写入返回 `false` 的情况保留草稿并显示错误，不假报保存成功。
- 修复 profile 恢复 `inherit` 后仍可能使用旧缓存模式的问题。
- 实际打包测试确认：会话显式模式不被覆盖，附加技能实时更新，核心 pointer 不可被技能列表停用。
- V4 持久化回归通过：四个独立 Linux 宿主进程，189 个事件、12 个完成轮次，
  正常重启及 flush 后 SIGKILL 恢复均通过；只使用离线模型适配器。

最终六个 Web 安装中的 `lib/index.js` 均与本地最终产物一致：

```text
SHA-256 de272cdcf3b0e38fcd02879c223ebdca759210fa00ded6e03b1d4292f56026b0
```

## 重跑与边界

运行 `node scripts/test-host-ui.mjs <精确版本>`，浏览器工具设置见 README。
默认自动创建并清理临时运行时；`PONYTAIL_DSH_RUNTIME` 可复用指定版本的测试运行时。
`PONYTAIL_VERIFY_KEEP_TEMP=1` 保留 `evidence/result.json`、截图和已隐藏 token 的宿主日志。

CI 配置已加入以上六个 npm 版本的独立检查与证据上传；本地验证不等同于远端 CI 已运行。
旧版 npm 宿主需要固定同代 Cordis 组件，测试脚本仅对隔离宿主做此处理，不修改插件的正常安装方式。
这些测试不代表所有 alpha、未来发行版或缺少界面插件的裁剪宿主已经验证。
本轮未改动规则正文、未降低上游约束；发布状态以 npm 和 GitHub Release 为准。
