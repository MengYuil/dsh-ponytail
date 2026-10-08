/** Browser controls over DSH's native settings and command services. */
import { createElement as h, useState, useRef, useId, useEffect, useSyncExternalStore } from 'react'

const SKILLS = ['ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']
const MODES = ['inherit', 'lite', 'full', 'ultra', 'off']
const zh = {
  title: 'Ponytail', description: '默认模式与附加技能；不改动核心规则。',
  mode: '默认模式', inherit: '跟随现有配置', lite: 'Lite · 按需求直接完成',
  modeInfo: '查看模式介绍',
  'inherit-detail': '不指定面板默认模式，沿用已有配置；没有配置时使用 Full。',
  'lite-detail': '完成明确需求，并必须用一句话指出更简单的替代方案，由用户选择；不为减少代码而改动现有架构。',
  'full-detail': '按七阶梯判断：是否必要 → 现有代码 → 标准库 → 平台能力 → 已装依赖 → 小表达式 → 最小新实现。',
  'ultra-detail': '更严格要求新增功能或抽象有依据，优先删除和复用，但不能省略明确需求。',
  'off-detail': '停止注入 Ponytail 核心规则，不卸载插件，也不自动关闭附加技能。',
  modeSafety: '安全、输入校验、必要错误处理与最小检查始终保留。模式只改变精简策略，不降低质量要求。',
  full: 'Full · 七阶梯默认约束', ultra: 'Ultra · 更严格地避免过度实现', off: 'Off · 关闭规则注入',
  boundary: '环境变量和 Profile 配置优先于此设置；已有会话覆盖保持不变。当前会话请用 /ponytail status 查询。',
  skills: '附加技能', save: '保存设置', saving: '正在保存…', saved: '设置已保存',
  modeHint: '保存后用于未单独切换模式的会话，不覆盖已有会话设置；Off 会关闭核心规则注入。',
  skillsHint: '仅控制附加技能是否可用，不影响 Ponytail 核心约束；勾选不会自动执行技能。',
  resetHint: '仅清除本面板的模式与技能设置，不删除旧配置，也不重置当前会话。',
  'ponytail-review-hint': '检查最近改动是否存在过度设计。',
  'ponytail-audit-hint': '审查整个仓库的复杂度，提出简化建议。',
  'ponytail-debt-hint': '查找 Ponytail 债务注释，整理已知限制与升级路径。',
  'ponytail-gain-hint': '查看上游收益参考，不代表当前项目的实测效果。',
  'ponytail-help-hint': '让模型介绍技能用法；仅看命令帮助可用 /ponytail help，不调用模型。',
  reset: '恢复面板默认', restored: '已恢复面板默认；不清除会话覆盖或其他配置',
  readOnly: '当前连接不可写，设置未保存。', unavailable: '宿主未提供 Ponytail 设置；请使用 /ponytail 命令。',
  help: '使用帮助', helpBody: '/ponytail 切换当前会话；/ponytail status 查看实际状态和来源；/ponytail reset 清除会话覆盖；/ponytail help 显示帮助。附加技能只在明确执行时请求模型工作。',
  modeRecommendation: '日常使用推荐 Full：完整七阶梯约束，保留明确需求与必要检查。Lite 直接完成要求，同时用一句话指出更简方案，由用户选择；Ultra 更严格控制新增复杂度，不代表效果一定更好。三个启用模式都保留安全底线。',
  failed: '保存失败，修改尚未生效：', status: '查看当前模式与来源', sessionReset: '当前会话跟随默认',
  'ponytail-review': '改动评审', 'ponytail-audit': '全仓审计', 'ponytail-debt': '债务账本',
  'ponytail-gain': '收益参考', 'ponytail-help': '技能帮助',
  menuHelp: '查看帮助（不调用模型）', switched: '只切换当前会话，不修改默认设置',
}
const en = {
  title: 'Ponytail', description: 'Default mode and optional skills; core rules stay intact.',
  mode: 'Default mode', inherit: 'Follow existing configuration', lite: 'Lite · Complete the direct ask',
  modeInfo: 'Show mode description',
  'inherit-detail': 'Use existing configuration instead of a panel default; fall back to Full when none is configured.',
  'lite-detail': 'Complete explicit requirements and name a simpler alternative in one line; the user chooses. Do not change architecture just to reduce line count.',
  'full-detail': 'Follow seven rungs: necessary? → existing code → standard library → platform feature → installed dependency → small expression → minimal new implementation.',
  'ultra-detail': 'Require stronger evidence for additions and abstractions. Favor deletion and reuse without dropping explicit requirements.',
  'off-detail': 'Stop Ponytail core rule injection without uninstalling the plugin or automatically disabling optional skills.',
  modeSafety: 'Security, input validation, essential error handling, and minimal checks stay intact. Modes change simplification strategy, not quality requirements.',
  full: 'Full · Seven-rung default', ultra: 'Ultra · Stronger anti-overengineering', off: 'Off · Disable rule injection',
  boundary: 'Environment and profile settings take priority. Existing session overrides stay intact. Use /ponytail status for the actual session mode.',
  skills: 'Optional skills', save: 'Save settings', saving: 'Saving…', saved: 'Settings saved',
  modeHint: 'After saving, applies to sessions without a mode override. Existing overrides stay intact; Off disables core rule injection.',
  skillsHint: 'Controls optional skill availability only, not Ponytail core constraints. Checking a skill does not run it.',
  resetHint: 'Clears only this panel’s mode and skill settings, not legacy configuration or the current session override.',
  'ponytail-review-hint': 'Check recent changes for overengineering.',
  'ponytail-audit-hint': 'Review repository-wide complexity and suggest simplifications.',
  'ponytail-debt-hint': 'Find Ponytail debt comments and collect known ceilings and upgrade paths.',
  'ponytail-gain-hint': 'View upstream impact references, not measured results for this project.',
  'ponytail-help-hint': 'Ask the model about skill usage. For command help without a model call, use /ponytail help.',
  reset: 'Reset panel defaults', restored: 'Panel defaults restored; session overrides and other configuration are untouched',
  readOnly: 'This connection is read-only; settings were not saved.', unavailable: 'Ponytail settings are unavailable on this host. Use /ponytail commands.',
  help: 'Help', helpBody: '/ponytail changes this session; /ponytail status shows the actual mode and source; /ponytail reset clears its override; /ponytail help displays help. Optional skills request model work only when explicitly invoked.',
  modeRecommendation: 'Full is recommended for everyday use: the complete seven-rung approach, with explicit requirements and essential checks intact. Lite completes the direct ask and names a simpler alternative in one line; the user chooses. Ultra is for stricter control of added complexity, not necessarily better results. All three enabled modes preserve safety boundaries.',
  failed: 'Save failed; changes are not active: ', status: 'Show current mode and source', sessionReset: 'Follow defaults in this session',
  'ponytail-review': 'Change review', 'ponytail-audit': 'Repository audit', 'ponytail-debt': 'Debt ledger',
  'ponytail-gain': 'Impact reference', 'ponytail-help': 'Skill help',
  menuHelp: 'Show help (no model call)', switched: 'Changes only this session, not defaults',
}

interface Preferences { defaultMode: string; disabledSkills: string[] }
interface Scope {
  getSnapshot(): { status: string; value?: Preferences; writable: boolean; revision?: number }
  subscribe(listener: () => void): () => void
  mutate(ops: object[], revision?: number): Promise<void>
}

export function SettingsCard({ scope, t }: { scope: Scope; t: (key: string) => string }) {
  const id = useId()
  const [modeInfoOpen, setModeInfoOpen] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const showModeInfo = (open: boolean, delay = 0) => {
    clearTimeout(hoverTimer.current)
    if (delay) hoverTimer.current = setTimeout(() => setModeInfoOpen(open), delay)
    else setModeInfoOpen(open)
  }
  useEffect(() => () => clearTimeout(hoverTimer.current), [])
  const snapshot = useSyncExternalStore(scope.subscribe.bind(scope), scope.getSnapshot.bind(scope))
  const [draft, setDraft] = useState<(Preferences & { revision?: number }) | null>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)
  const current = draft ?? snapshot.value ?? { defaultMode: 'inherit', disabledSkills: [] }
  const disabled = busy || !snapshot.writable || snapshot.status !== 'ready'
  const edit = (patch: Partial<Preferences>) => {
    setMessage('')
    setDraft({ ...current, revision: draft?.revision ?? snapshot.revision, ...patch })
  }
  const save = async (reset = false) => {
    if (writing.current || disabled || (!reset && !draft)) return
    writing.current = true
    setBusy(true)
    setMessage('')
    try {
      const ops = reset
        ? ['defaultMode', 'disabledSkills'].map(field => ({ op: 'unset', path: [field] }))
        : ['defaultMode', 'disabledSkills'].map(field => ({ op: 'set', path: [field], value: current[field as keyof Preferences] }))
      await scope.mutate(ops, reset ? snapshot.revision : draft?.revision)
      setDraft(null)
      setFailed(false)
      setMessage(t(reset ? 'restored' : 'saved'))
    } catch (error) {
      setFailed(true)
      setMessage(t('failed') + (error instanceof Error ? error.message : String(error)))
    } finally {
      writing.current = false
      setBusy(false)
    }
  }
  return h('li', { className: 'ponytail-settings' },
    h('h3', null, t('title')), h('p', null, t('description')),
    h('p', null, t('boundary')),
    snapshot.status !== 'ready' ? h('p', { role: 'status' }, t('unavailable')) : null,
    snapshot.status === 'ready' && !snapshot.writable ? h('p', { role: 'status' }, t('readOnly')) : null,
    h('div', { className: 'ponytail-mode',
      onMouseEnter: () => showModeInfo(true, 180), onMouseLeave: () => showModeInfo(false, 120),
      onFocus: () => showModeInfo(true),
      onBlur: (event: { currentTarget: HTMLElement; relatedTarget: Node | null }) => {
        if (!event.currentTarget.contains(event.relatedTarget)) showModeInfo(false)
      },
      onKeyDown: (event: { key: string }) => { if (event.key === 'Escape') showModeInfo(false) },
    }, h('label', null, t('mode'), h('select', { value: current.defaultMode, disabled, 'aria-describedby': `${id}-mode-detail`,
      onPointerDown: () => showModeInfo(false),
      onChange: (event: { target: { value: string } }) => { edit({ defaultMode: event.target.value }); showModeInfo(true) } },
      MODES.map(mode => h('option', { key: mode, value: mode }, t(mode))))),
      h('button', { type: 'button', className: 'ponytail-mode-info', 'aria-label': t('modeInfo'), 'aria-describedby': `${id}-mode-detail`,
        onClick: () => showModeInfo(true) }, 'i'),
      h('div', { id: `${id}-mode-detail`, role: 'tooltip', hidden: !modeInfoOpen, className: 'ponytail-mode-tooltip' },
        h('strong', { className: 'ponytail-tooltip-title' }, t(current.defaultMode)),
        h('p', { className: 'ponytail-tooltip-body' }, t(`${current.defaultMode}-detail`)),
        ['lite', 'full', 'ultra'].includes(current.defaultMode) ? h('p', { className: 'ponytail-tooltip-note' }, t('modeSafety')) : null)),
    h('p', { id: `${id}-mode` }, t('modeHint')),
    h('fieldset', { disabled, 'aria-describedby': `${id}-skills` }, h('legend', null, t('skills')),
      h('p', { id: `${id}-skills` }, t('skillsHint')),
      SKILLS.map(skill => h('label', { key: skill }, h('input', { type: 'checkbox',
        'aria-describedby': `${id}-${skill}`,
        checked: !current.disabledSkills.includes(skill),
        onChange: (event: { target: { checked: boolean } }) => edit({ disabledSkills: event.target.checked
          ? current.disabledSkills.filter(name => name !== skill) : [...current.disabledSkills, skill] }),
      }), h('span', null, t(skill), h('small', { style: { display: 'block', opacity: 0.7 } }, `/${skill}`),
        h('small', { id: `${id}-${skill}`, style: { display: 'block', lineHeight: 1.5 } }, t(`${skill}-hint`)))))),
    h('div', { className: 'ponytail-actions' },
      h('button', { type: 'button', disabled: disabled || !draft, onClick: () => { void save() } }, t(busy ? 'saving' : 'save')),
      h('button', { type: 'button', disabled, 'aria-describedby': `${id}-reset`, onClick: () => { void save(true) } }, t('reset'))),
    h('p', { id: `${id}-reset` }, t('resetHint')),
    message ? h('p', { role: failed ? 'alert' : 'status' }, message) : null,
    h('details', null, h('summary', null, t('help')),
      h('p', null, t('modeRecommendation')), h('p', null, t('helpBody'))))
}

const STYLE = '.ponytail-settings{list-style:none;border:1px solid var(--dsw-alias-border-l4);border-radius:16px;padding:16px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary)}.ponytail-settings p{font-size:13px;line-height:1.5;max-width:70ch}.ponytail-settings label{display:flex;align-items:center;gap:10px;margin:10px 0;flex-wrap:wrap}.ponytail-settings fieldset{border:0;padding:12px 0}.ponytail-settings select,.ponytail-settings button{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l4);border-radius:8px;padding:8px 12px}.ponytail-settings button:disabled{opacity:.5}.ponytail-settings :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.ponytail-actions{display:flex;gap:8px;flex-wrap:wrap}.ponytail-settings details{margin-top:14px}'
  + '.ponytail-mode{position:relative;display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:fit-content;max-width:100%}.ponytail-settings .ponytail-mode-info{display:grid;place-items:center;width:26px;height:26px;padding:0;border-radius:50%;font-size:13px;font-weight:600;background:transparent;cursor:help}.ponytail-mode-tooltip{position:absolute;z-index:10;top:calc(100% + 8px);left:0;box-sizing:border-box;width:min(360px,calc(100vw - 84px));padding:16px;border:1px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-3);box-shadow:0 8px 24px #0000001a,0 2px 6px #0000000a;overflow-wrap:anywhere}.ponytail-mode-tooltip::before{content:"";position:absolute;left:0;right:0;top:-12px;height:12px}.ponytail-tooltip-title{display:block;font-size:14px;line-height:1.5}.ponytail-mode-tooltip .ponytail-tooltip-body{margin:8px 0 0;font-size:14px;line-height:1.7}.ponytail-mode-tooltip .ponytail-tooltip-note{margin:12px 0 0;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l4);font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary))}.ponytail-mode select{max-width:100%}'

export function apply(ctx: any): void {
  ctx.inject(['locale', 'settingsScope', 'slots', 'connection'], (client: any) => {
    const t = client.locale.bind('ponytail')
    client.effect(() => client.locale.register('ponytail', { zh, en }), 'ponytail: dictionaries')
    client.effect(() => {
      const style = document.createElement('style')
      style.textContent = STYLE
      document.head.append(style)
      return () => style.remove()
    }, 'ponytail: settings style')
    const bound = client.settingsScope.bind({ namespace: 'ponytail' })
    // Older DSH scopes expose only per-field writes and swallow rejected writes.
    // Use their real atomic RPC instead, preserving the draft's revision fence.
    const scope: Scope = {
      getSnapshot: bound.getSnapshot.bind(bound),
      subscribe: bound.subscribe.bind(bound),
      mutate: typeof bound.mutate === 'function' ? bound.mutate.bind(bound) : async (ops, revision) => {
        const response = await client.connection.api.settings.mutate({ ns: 'ponytail', ops,
          ...(revision === undefined ? {} : { expectedRevision: revision }) })
        if (!response.result.ok) throw new Error(response.result.error?.message ?? 'Ponytail settings write failed')
      },
    }
    client.slots.inject('settings.plugin.item', () => client.slots.register({
      name: 'settings.plugin.item', key: 'ponytail', locale: 'ponytail', inject: () => ({ scope }),
    }, SettingsCard))
    // Optional native mode picker. Explicit argued commands keep their host
    // semantics; only a bare /ponytail opens the selection menu.
    client.inject(['commandUi', 'remote'], (menu: any) => {
      if (typeof menu.commandUi.decorate !== 'function' || !menu.remote.commands?.execute) return
      menu.commandUi.decorate({ name: 'ponytail', available: () => true, ui: {
        kind: 'popupSelect',
        options: async () => [...MODES.filter(mode => mode !== 'inherit').map(mode => ({ id: mode, label: t(mode), detail: t('switched') })),
          { id: 'status', label: t('status') }, { id: 'reset', label: t('sessionReset') }, { id: 'help', label: t('menuHelp') }],
        onSelect: async (option: { id: string }, session: { sessionId: string }) => {
          if (!['lite', 'full', 'ultra', 'off', 'status', 'reset', 'help'].includes(option.id)) throw new Error('Unknown Ponytail action')
          const result = await menu.remote.commands.execute(session.sessionId, `/ponytail ${option.id}`, [])
          if (!result.ok) throw new Error(result.error?.message ?? 'Ponytail command failed')
        },
      } })
    })
  })
}
