window.__ModuleLoader__.load({ id: "@mengyuly/dsh-ponytail", factory: (require) => { const module = { exports: {} };
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  SettingsCard: () => SettingsCard,
  apply: () => apply
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var SKILLS = ["ponytail-review", "ponytail-audit", "ponytail-debt", "ponytail-gain", "ponytail-help"];
var MODES = ["inherit", "lite", "full", "ultra", "off"];
var zh = {
  title: "Ponytail",
  description: "\u9ED8\u8BA4\u6A21\u5F0F\u4E0E\u9644\u52A0\u6280\u80FD\uFF1B\u4E0D\u6539\u52A8\u6838\u5FC3\u89C4\u5219\u3002",
  mode: "\u9ED8\u8BA4\u6A21\u5F0F",
  inherit: "\u8DDF\u968F\u73B0\u6709\u914D\u7F6E",
  lite: "Lite \xB7 \u6309\u9700\u6C42\u76F4\u63A5\u5B8C\u6210",
  modeInfo: "\u67E5\u770B\u6A21\u5F0F\u4ECB\u7ECD",
  "inherit-detail": "\u4E0D\u6307\u5B9A\u9762\u677F\u9ED8\u8BA4\u6A21\u5F0F\uFF0C\u6CBF\u7528\u5DF2\u6709\u914D\u7F6E\uFF1B\u6CA1\u6709\u914D\u7F6E\u65F6\u4F7F\u7528 Full\u3002",
  "lite-detail": "\u5B8C\u6210\u660E\u786E\u9700\u6C42\uFF0C\u5E76\u5FC5\u987B\u7528\u4E00\u53E5\u8BDD\u6307\u51FA\u66F4\u7B80\u5355\u7684\u66FF\u4EE3\u65B9\u6848\uFF0C\u7531\u7528\u6237\u9009\u62E9\uFF1B\u4E0D\u4E3A\u51CF\u5C11\u4EE3\u7801\u800C\u6539\u52A8\u73B0\u6709\u67B6\u6784\u3002",
  "full-detail": "\u6309\u4E03\u9636\u68AF\u5224\u65AD\uFF1A\u662F\u5426\u5FC5\u8981 \u2192 \u73B0\u6709\u4EE3\u7801 \u2192 \u6807\u51C6\u5E93 \u2192 \u5E73\u53F0\u80FD\u529B \u2192 \u5DF2\u88C5\u4F9D\u8D56 \u2192 \u5C0F\u8868\u8FBE\u5F0F \u2192 \u6700\u5C0F\u65B0\u5B9E\u73B0\u3002",
  "ultra-detail": "\u66F4\u4E25\u683C\u8981\u6C42\u65B0\u589E\u529F\u80FD\u6216\u62BD\u8C61\u6709\u4F9D\u636E\uFF0C\u4F18\u5148\u5220\u9664\u548C\u590D\u7528\uFF0C\u4F46\u4E0D\u80FD\u7701\u7565\u660E\u786E\u9700\u6C42\u3002",
  "off-detail": "\u505C\u6B62\u6CE8\u5165 Ponytail \u6838\u5FC3\u89C4\u5219\uFF0C\u4E0D\u5378\u8F7D\u63D2\u4EF6\uFF0C\u4E5F\u4E0D\u81EA\u52A8\u5173\u95ED\u9644\u52A0\u6280\u80FD\u3002",
  modeSafety: "\u5B89\u5168\u3001\u8F93\u5165\u6821\u9A8C\u3001\u5FC5\u8981\u9519\u8BEF\u5904\u7406\u4E0E\u6700\u5C0F\u68C0\u67E5\u59CB\u7EC8\u4FDD\u7559\u3002\u6A21\u5F0F\u53EA\u6539\u53D8\u7CBE\u7B80\u7B56\u7565\uFF0C\u4E0D\u964D\u4F4E\u8D28\u91CF\u8981\u6C42\u3002",
  full: "Full \xB7 \u4E03\u9636\u68AF\u9ED8\u8BA4\u7EA6\u675F",
  ultra: "Ultra \xB7 \u66F4\u4E25\u683C\u5730\u907F\u514D\u8FC7\u5EA6\u5B9E\u73B0",
  off: "Off \xB7 \u5173\u95ED\u89C4\u5219\u6CE8\u5165",
  boundary: "\u73AF\u5883\u53D8\u91CF\u548C Profile \u914D\u7F6E\u4F18\u5148\u4E8E\u6B64\u8BBE\u7F6E\uFF1B\u5DF2\u6709\u4F1A\u8BDD\u8986\u76D6\u4FDD\u6301\u4E0D\u53D8\u3002\u5F53\u524D\u4F1A\u8BDD\u8BF7\u7528 /ponytail status \u67E5\u8BE2\u3002",
  skills: "\u9644\u52A0\u6280\u80FD",
  save: "\u4FDD\u5B58\u8BBE\u7F6E",
  saving: "\u6B63\u5728\u4FDD\u5B58\u2026",
  saved: "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58",
  modeHint: "\u4FDD\u5B58\u540E\u7528\u4E8E\u672A\u5355\u72EC\u5207\u6362\u6A21\u5F0F\u7684\u4F1A\u8BDD\uFF0C\u4E0D\u8986\u76D6\u5DF2\u6709\u4F1A\u8BDD\u8BBE\u7F6E\uFF1BOff \u4F1A\u5173\u95ED\u6838\u5FC3\u89C4\u5219\u6CE8\u5165\u3002",
  skillsHint: "\u4EC5\u63A7\u5236\u9644\u52A0\u6280\u80FD\u662F\u5426\u53EF\u7528\uFF0C\u4E0D\u5F71\u54CD Ponytail \u6838\u5FC3\u7EA6\u675F\uFF1B\u52FE\u9009\u4E0D\u4F1A\u81EA\u52A8\u6267\u884C\u6280\u80FD\u3002",
  resetHint: "\u4EC5\u6E05\u9664\u672C\u9762\u677F\u7684\u6A21\u5F0F\u4E0E\u6280\u80FD\u8BBE\u7F6E\uFF0C\u4E0D\u5220\u9664\u65E7\u914D\u7F6E\uFF0C\u4E5F\u4E0D\u91CD\u7F6E\u5F53\u524D\u4F1A\u8BDD\u3002",
  "ponytail-review-hint": "\u68C0\u67E5\u6700\u8FD1\u6539\u52A8\u662F\u5426\u5B58\u5728\u8FC7\u5EA6\u8BBE\u8BA1\u3002",
  "ponytail-audit-hint": "\u5BA1\u67E5\u6574\u4E2A\u4ED3\u5E93\u7684\u590D\u6742\u5EA6\uFF0C\u63D0\u51FA\u7B80\u5316\u5EFA\u8BAE\u3002",
  "ponytail-debt-hint": "\u67E5\u627E Ponytail \u503A\u52A1\u6CE8\u91CA\uFF0C\u6574\u7406\u5DF2\u77E5\u9650\u5236\u4E0E\u5347\u7EA7\u8DEF\u5F84\u3002",
  "ponytail-gain-hint": "\u67E5\u770B\u4E0A\u6E38\u6536\u76CA\u53C2\u8003\uFF0C\u4E0D\u4EE3\u8868\u5F53\u524D\u9879\u76EE\u7684\u5B9E\u6D4B\u6548\u679C\u3002",
  "ponytail-help-hint": "\u8BA9\u6A21\u578B\u4ECB\u7ECD\u6280\u80FD\u7528\u6CD5\uFF1B\u4EC5\u770B\u547D\u4EE4\u5E2E\u52A9\u53EF\u7528 /ponytail help\uFF0C\u4E0D\u8C03\u7528\u6A21\u578B\u3002",
  reset: "\u6062\u590D\u9762\u677F\u9ED8\u8BA4",
  restored: "\u5DF2\u6062\u590D\u9762\u677F\u9ED8\u8BA4\uFF1B\u4E0D\u6E05\u9664\u4F1A\u8BDD\u8986\u76D6\u6216\u5176\u4ED6\u914D\u7F6E",
  readOnly: "\u5F53\u524D\u8FDE\u63A5\u4E0D\u53EF\u5199\uFF0C\u8BBE\u7F6E\u672A\u4FDD\u5B58\u3002",
  unavailable: "\u5BBF\u4E3B\u672A\u63D0\u4F9B Ponytail \u8BBE\u7F6E\uFF1B\u8BF7\u4F7F\u7528 /ponytail \u547D\u4EE4\u3002",
  help: "\u4F7F\u7528\u5E2E\u52A9",
  helpBody: "/ponytail \u5207\u6362\u5F53\u524D\u4F1A\u8BDD\uFF1B/ponytail status \u67E5\u770B\u5B9E\u9645\u72B6\u6001\u548C\u6765\u6E90\uFF1B/ponytail reset \u6E05\u9664\u4F1A\u8BDD\u8986\u76D6\uFF1B/ponytail help \u663E\u793A\u5E2E\u52A9\u3002\u9644\u52A0\u6280\u80FD\u53EA\u5728\u660E\u786E\u6267\u884C\u65F6\u8BF7\u6C42\u6A21\u578B\u5DE5\u4F5C\u3002",
  modeRecommendation: "\u65E5\u5E38\u4F7F\u7528\u63A8\u8350 Full\uFF1A\u5B8C\u6574\u4E03\u9636\u68AF\u7EA6\u675F\uFF0C\u4FDD\u7559\u660E\u786E\u9700\u6C42\u4E0E\u5FC5\u8981\u68C0\u67E5\u3002Lite \u76F4\u63A5\u5B8C\u6210\u8981\u6C42\uFF0C\u540C\u65F6\u7528\u4E00\u53E5\u8BDD\u6307\u51FA\u66F4\u7B80\u65B9\u6848\uFF0C\u7531\u7528\u6237\u9009\u62E9\uFF1BUltra \u66F4\u4E25\u683C\u63A7\u5236\u65B0\u589E\u590D\u6742\u5EA6\uFF0C\u4E0D\u4EE3\u8868\u6548\u679C\u4E00\u5B9A\u66F4\u597D\u3002\u4E09\u4E2A\u542F\u7528\u6A21\u5F0F\u90FD\u4FDD\u7559\u5B89\u5168\u5E95\u7EBF\u3002",
  failed: "\u4FDD\u5B58\u5931\u8D25\uFF0C\u4FEE\u6539\u5C1A\u672A\u751F\u6548\uFF1A",
  status: "\u67E5\u770B\u5F53\u524D\u6A21\u5F0F\u4E0E\u6765\u6E90",
  sessionReset: "\u5F53\u524D\u4F1A\u8BDD\u8DDF\u968F\u9ED8\u8BA4",
  "ponytail-review": "\u6539\u52A8\u8BC4\u5BA1",
  "ponytail-audit": "\u5168\u4ED3\u5BA1\u8BA1",
  "ponytail-debt": "\u503A\u52A1\u8D26\u672C",
  "ponytail-gain": "\u6536\u76CA\u53C2\u8003",
  "ponytail-help": "\u6280\u80FD\u5E2E\u52A9",
  menuHelp: "\u67E5\u770B\u5E2E\u52A9\uFF08\u4E0D\u8C03\u7528\u6A21\u578B\uFF09",
  switched: "\u53EA\u5207\u6362\u5F53\u524D\u4F1A\u8BDD\uFF0C\u4E0D\u4FEE\u6539\u9ED8\u8BA4\u8BBE\u7F6E"
};
var en = {
  title: "Ponytail",
  description: "Default mode and optional skills; core rules stay intact.",
  mode: "Default mode",
  inherit: "Follow existing configuration",
  lite: "Lite \xB7 Complete the direct ask",
  modeInfo: "Show mode description",
  "inherit-detail": "Use existing configuration instead of a panel default; fall back to Full when none is configured.",
  "lite-detail": "Complete explicit requirements and name a simpler alternative in one line; the user chooses. Do not change architecture just to reduce line count.",
  "full-detail": "Follow seven rungs: necessary? \u2192 existing code \u2192 standard library \u2192 platform feature \u2192 installed dependency \u2192 small expression \u2192 minimal new implementation.",
  "ultra-detail": "Require stronger evidence for additions and abstractions. Favor deletion and reuse without dropping explicit requirements.",
  "off-detail": "Stop Ponytail core rule injection without uninstalling the plugin or automatically disabling optional skills.",
  modeSafety: "Security, input validation, essential error handling, and minimal checks stay intact. Modes change simplification strategy, not quality requirements.",
  full: "Full \xB7 Seven-rung default",
  ultra: "Ultra \xB7 Stronger anti-overengineering",
  off: "Off \xB7 Disable rule injection",
  boundary: "Environment and profile settings take priority. Existing session overrides stay intact. Use /ponytail status for the actual session mode.",
  skills: "Optional skills",
  save: "Save settings",
  saving: "Saving\u2026",
  saved: "Settings saved",
  modeHint: "After saving, applies to sessions without a mode override. Existing overrides stay intact; Off disables core rule injection.",
  skillsHint: "Controls optional skill availability only, not Ponytail core constraints. Checking a skill does not run it.",
  resetHint: "Clears only this panel\u2019s mode and skill settings, not legacy configuration or the current session override.",
  "ponytail-review-hint": "Check recent changes for overengineering.",
  "ponytail-audit-hint": "Review repository-wide complexity and suggest simplifications.",
  "ponytail-debt-hint": "Find Ponytail debt comments and collect known ceilings and upgrade paths.",
  "ponytail-gain-hint": "View upstream impact references, not measured results for this project.",
  "ponytail-help-hint": "Ask the model about skill usage. For command help without a model call, use /ponytail help.",
  reset: "Reset panel defaults",
  restored: "Panel defaults restored; session overrides and other configuration are untouched",
  readOnly: "This connection is read-only; settings were not saved.",
  unavailable: "Ponytail settings are unavailable on this host. Use /ponytail commands.",
  help: "Help",
  helpBody: "/ponytail changes this session; /ponytail status shows the actual mode and source; /ponytail reset clears its override; /ponytail help displays help. Optional skills request model work only when explicitly invoked.",
  modeRecommendation: "Full is recommended for everyday use: the complete seven-rung approach, with explicit requirements and essential checks intact. Lite completes the direct ask and names a simpler alternative in one line; the user chooses. Ultra is for stricter control of added complexity, not necessarily better results. All three enabled modes preserve safety boundaries.",
  failed: "Save failed; changes are not active: ",
  status: "Show current mode and source",
  sessionReset: "Follow defaults in this session",
  "ponytail-review": "Change review",
  "ponytail-audit": "Repository audit",
  "ponytail-debt": "Debt ledger",
  "ponytail-gain": "Impact reference",
  "ponytail-help": "Skill help",
  menuHelp: "Show help (no model call)",
  switched: "Changes only this session, not defaults"
};
function SettingsCard({ scope, t }) {
  const id = (0, import_react.useId)();
  const [modeInfoOpen, setModeInfoOpen] = (0, import_react.useState)(false);
  const hoverTimer = (0, import_react.useRef)(void 0);
  const showModeInfo = (open, delay = 0) => {
    clearTimeout(hoverTimer.current);
    if (delay) hoverTimer.current = setTimeout(() => setModeInfoOpen(open), delay);
    else setModeInfoOpen(open);
  };
  (0, import_react.useEffect)(() => () => clearTimeout(hoverTimer.current), []);
  const snapshot = (0, import_react.useSyncExternalStore)(scope.subscribe.bind(scope), scope.getSnapshot.bind(scope));
  const [draft, setDraft] = (0, import_react.useState)(null);
  const [message, setMessage] = (0, import_react.useState)("");
  const [failed, setFailed] = (0, import_react.useState)(false);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const writing = (0, import_react.useRef)(false);
  const current = draft ?? snapshot.value ?? { defaultMode: "inherit", disabledSkills: [] };
  const disabled = busy || !snapshot.writable || snapshot.status !== "ready";
  const edit = (patch) => {
    setMessage("");
    setDraft({ ...current, revision: draft?.revision ?? snapshot.revision, ...patch });
  };
  const save = async (reset = false) => {
    if (writing.current || disabled || !reset && !draft) return;
    writing.current = true;
    setBusy(true);
    setMessage("");
    try {
      const ops = reset ? ["defaultMode", "disabledSkills"].map((field) => ({ op: "unset", path: [field] })) : ["defaultMode", "disabledSkills"].map((field) => ({ op: "set", path: [field], value: current[field] }));
      await scope.mutate(ops, reset ? snapshot.revision : draft?.revision);
      setDraft(null);
      setFailed(false);
      setMessage(t(reset ? "restored" : "saved"));
    } catch (error) {
      setFailed(true);
      setMessage(t("failed") + (error instanceof Error ? error.message : String(error)));
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  return (0, import_react.createElement)(
    "li",
    { className: "ponytail-settings" },
    (0, import_react.createElement)("h3", null, t("title")),
    (0, import_react.createElement)("p", null, t("description")),
    (0, import_react.createElement)("p", null, t("boundary")),
    snapshot.status !== "ready" ? (0, import_react.createElement)("p", { role: "status" }, t("unavailable")) : null,
    snapshot.status === "ready" && !snapshot.writable ? (0, import_react.createElement)("p", { role: "status" }, t("readOnly")) : null,
    (0, import_react.createElement)(
      "div",
      {
        className: "ponytail-mode",
        onMouseEnter: () => showModeInfo(true, 180),
        onMouseLeave: () => showModeInfo(false, 120),
        onFocus: () => showModeInfo(true),
        onBlur: (event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) showModeInfo(false);
        },
        onKeyDown: (event) => {
          if (event.key === "Escape") showModeInfo(false);
        }
      },
      (0, import_react.createElement)("label", null, t("mode"), (0, import_react.createElement)(
        "select",
        {
          value: current.defaultMode,
          disabled,
          "aria-describedby": `${id}-mode-detail`,
          onPointerDown: () => showModeInfo(false),
          onChange: (event) => {
            edit({ defaultMode: event.target.value });
            showModeInfo(true);
          }
        },
        MODES.map((mode) => (0, import_react.createElement)("option", { key: mode, value: mode }, t(mode)))
      )),
      (0, import_react.createElement)("button", {
        type: "button",
        className: "ponytail-mode-info",
        "aria-label": t("modeInfo"),
        "aria-describedby": `${id}-mode-detail`,
        onClick: () => showModeInfo(true)
      }, "i"),
      (0, import_react.createElement)(
        "div",
        { id: `${id}-mode-detail`, role: "tooltip", hidden: !modeInfoOpen, className: "ponytail-mode-tooltip" },
        (0, import_react.createElement)("strong", { className: "ponytail-tooltip-title" }, t(current.defaultMode)),
        (0, import_react.createElement)("p", { className: "ponytail-tooltip-body" }, t(`${current.defaultMode}-detail`)),
        ["lite", "full", "ultra"].includes(current.defaultMode) ? (0, import_react.createElement)("p", { className: "ponytail-tooltip-note" }, t("modeSafety")) : null
      )
    ),
    (0, import_react.createElement)("p", { id: `${id}-mode` }, t("modeHint")),
    (0, import_react.createElement)(
      "fieldset",
      { disabled, "aria-describedby": `${id}-skills` },
      (0, import_react.createElement)("legend", null, t("skills")),
      (0, import_react.createElement)("p", { id: `${id}-skills` }, t("skillsHint")),
      SKILLS.map((skill) => (0, import_react.createElement)("label", { key: skill }, (0, import_react.createElement)("input", {
        type: "checkbox",
        "aria-describedby": `${id}-${skill}`,
        checked: !current.disabledSkills.includes(skill),
        onChange: (event) => edit({ disabledSkills: event.target.checked ? current.disabledSkills.filter((name) => name !== skill) : [...current.disabledSkills, skill] })
      }), (0, import_react.createElement)(
        "span",
        null,
        t(skill),
        (0, import_react.createElement)("small", { style: { display: "block", opacity: 0.7 } }, `/${skill}`),
        (0, import_react.createElement)("small", { id: `${id}-${skill}`, style: { display: "block", lineHeight: 1.5 } }, t(`${skill}-hint`))
      )))
    ),
    (0, import_react.createElement)(
      "div",
      { className: "ponytail-actions" },
      (0, import_react.createElement)("button", { type: "button", disabled: disabled || !draft, onClick: () => {
        void save();
      } }, t(busy ? "saving" : "save")),
      (0, import_react.createElement)("button", { type: "button", disabled, "aria-describedby": `${id}-reset`, onClick: () => {
        void save(true);
      } }, t("reset"))
    ),
    (0, import_react.createElement)("p", { id: `${id}-reset` }, t("resetHint")),
    message ? (0, import_react.createElement)("p", { role: failed ? "alert" : "status" }, message) : null,
    (0, import_react.createElement)(
      "details",
      null,
      (0, import_react.createElement)("summary", null, t("help")),
      (0, import_react.createElement)("p", null, t("modeRecommendation")),
      (0, import_react.createElement)("p", null, t("helpBody"))
    )
  );
}
var STYLE = '.ponytail-settings{list-style:none;border:1px solid var(--dsw-alias-border-l4);border-radius:16px;padding:16px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary)}.ponytail-settings p{font-size:13px;line-height:1.5;max-width:70ch}.ponytail-settings label{display:flex;align-items:center;gap:10px;margin:10px 0;flex-wrap:wrap}.ponytail-settings fieldset{border:0;padding:12px 0}.ponytail-settings select,.ponytail-settings button{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l4);border-radius:8px;padding:8px 12px}.ponytail-settings button:disabled{opacity:.5}.ponytail-settings :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.ponytail-actions{display:flex;gap:8px;flex-wrap:wrap}.ponytail-settings details{margin-top:14px}.ponytail-mode{position:relative;display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:fit-content;max-width:100%}.ponytail-settings .ponytail-mode-info{display:grid;place-items:center;width:26px;height:26px;padding:0;border-radius:50%;font-size:13px;font-weight:600;background:transparent;cursor:help}.ponytail-mode-tooltip{position:absolute;z-index:10;top:calc(100% + 8px);left:0;box-sizing:border-box;width:min(360px,calc(100vw - 84px));padding:16px;border:1px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-3);box-shadow:0 8px 24px #0000001a,0 2px 6px #0000000a;overflow-wrap:anywhere}.ponytail-mode-tooltip::before{content:"";position:absolute;left:0;right:0;top:-12px;height:12px}.ponytail-tooltip-title{display:block;font-size:14px;line-height:1.5}.ponytail-mode-tooltip .ponytail-tooltip-body{margin:8px 0 0;font-size:14px;line-height:1.7}.ponytail-mode-tooltip .ponytail-tooltip-note{margin:12px 0 0;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l4);font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary))}.ponytail-mode select{max-width:100%}';
function apply(ctx) {
  ctx.inject(["locale", "settingsScope", "slots", "connection"], (client) => {
    const t = client.locale.bind("ponytail");
    client.effect(() => client.locale.register("ponytail", { zh, en }), "ponytail: dictionaries");
    client.effect(() => {
      const style = document.createElement("style");
      style.textContent = STYLE;
      document.head.append(style);
      return () => style.remove();
    }, "ponytail: settings style");
    const bound = client.settingsScope.bind({ namespace: "ponytail" });
    const scope = {
      getSnapshot: bound.getSnapshot.bind(bound),
      subscribe: bound.subscribe.bind(bound),
      mutate: typeof bound.mutate === "function" ? bound.mutate.bind(bound) : async (ops, revision) => {
        const response = await client.connection.api.settings.mutate({
          ns: "ponytail",
          ops,
          ...revision === void 0 ? {} : { expectedRevision: revision }
        });
        if (!response.result.ok) throw new Error(response.result.error?.message ?? "Ponytail settings write failed");
      }
    };
    client.slots.inject("settings.plugin.item", () => client.slots.register({
      name: "settings.plugin.item",
      key: "ponytail",
      locale: "ponytail",
      inject: () => ({ scope })
    }, SettingsCard));
    client.inject(["commandUi", "remote"], (menu) => {
      if (typeof menu.commandUi.decorate !== "function" || !menu.remote.commands?.execute) return;
      menu.commandUi.decorate({ name: "ponytail", available: () => true, ui: {
        kind: "popupSelect",
        options: async () => [
          ...MODES.filter((mode) => mode !== "inherit").map((mode) => ({ id: mode, label: t(mode), detail: t("switched") })),
          { id: "status", label: t("status") },
          { id: "reset", label: t("sessionReset") },
          { id: "help", label: t("menuHelp") }
        ],
        onSelect: async (option, session) => {
          if (!["lite", "full", "ultra", "off", "status", "reset", "help"].includes(option.id)) throw new Error("Unknown Ponytail action");
          const result = await menu.remote.commands.execute(session.sessionId, `/ponytail ${option.id}`, []);
          if (!result.ok) throw new Error(result.error?.message ?? "Ponytail command failed");
        }
      } });
    });
  });
}
return module.exports; } });
