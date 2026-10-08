# dsh-ponytail

English | [简体中文](README.md)

![CI](https://github.com/MengYuil/dsh-ponytail/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
[![npm](https://img.shields.io/npm/v/@mengyuly/dsh-ponytail)](https://www.npmjs.com/package/@mengyuly/dsh-ponytail)
[![dsh.so security](https://www.dsh.so/badge/dsh-ponytail-4.svg)](https://www.dsh.so/artifact/dsh-ponytail-4/)

Adapts the minimal-coding principles and skills of
[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) to
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): a YAGNI
decision ladder, session-level Lite / Full / Ultra / Off modes, and a set of
skills for code slimming, review, auditing, and technical-debt tracking.

This project aligns with the upstream core ideas and main workflows, but DSH's
model loop, prompt assembly, skill mechanism, and tool calls differ. **The
upstream benchmark is a reference only and does not imply that this port has
the same token, cost, or latency gains** (see “Efficiency (conditional gains,
not guarantees)”).

## Download from GitHub Releases

- **Latest release**:
  `https://github.com/MengYuil/dsh-ponytail/releases/latest/download/mengyuly-dsh-ponytail.tgz`
- **Pinned version v0.4.1** (immutable per tag):
  `https://github.com/MengYuil/dsh-ponytail/releases/download/v0.4.1/mengyuly-dsh-ponytail.tgz`

Notes:

- **latest**: good for a quick install; it tracks the newest release. The fixed
  asset name `mengyuly-dsh-ponytail.tgz` stays the same in every release, so
  the URL never breaks on a version bump — which also means it is **not
  suitable as an immutable dependency**.
- **Pinned version**: good for reproducible installs; the URL pins a tag
  (e.g. `v0.4.1`) that is immutable per tag; the asset name is likewise
  `mengyuly-dsh-ponytail.tgz`.
- npm installs still go through the npm Registry or the `dsh plugin` command.
- The fixed asset name is produced and verified by
  `scripts/release-assets.mjs` (`node scripts/release-assets.mjs`, maintainers
  only).

## Installation

Install into a profile (replace `web` with `tui` or a custom name):

Recommended stable npm install: `dsh plugin --profile web add @mengyuly/dsh-ponytail`.
To pin this release: `dsh plugin --profile web add @mengyuly/dsh-ponytail@0.4.1`.

```bash
# Option 1: local link (current dsh cores >= 0.1.x)
dsh plugin --profile web add link:$(pwd)

# Option 2: install straight from GitHub
dsh plugin --profile web add github:MengYuil/dsh-ponytail

# Option 3: Release tarball (download the tgz first — the latest fixed asset
# name never changes)
#   https://github.com/MengYuil/dsh-ponytail/releases/latest/download/mengyuly-dsh-ponytail.tgz
dsh plugin --profile web add file:./mengyuly-dsh-ponytail.tgz

# Option 4: npm
dsh plugin --profile web add @mengyuly/dsh-ponytail
```

Restart the profile after installing (for example, `dsh web`). Use
`/ponytail status` for the effective mode/source or `/ponytail help` for command
help; neither calls the model. Six `ponytail*` skills are registered by default,
with disabled optional skills removed from the catalog. `/ponytail-help` is a
model-backed skill, not a zero-call installation check.

### Updating an existing installation

```bash
dsh plugin --profile web update @mengyuly/dsh-ponytail
```

Restart the corresponding profile afterward. For GitHub, linked or local-tgz
installs, re-add the desired source; the npm update command is not a guarantee
that the installation source changes.

> `lib/index.js` is a self-contained bundle (`dsh-llm` / `dsh-skill` are
> already inlined — npm has no compatible versions) with two published
> runtime peers: `@deepseek-ai/cordis` (4.0.1) and
> `@deepseek-ai/schemastery` (3.18.x). `schemastery` is deliberately kept
> external rather than inlined: its schema DSL compiles `callback` strings
> with `new Function`, so keeping it out means **the shipped artifact contains
> no dynamic code execution** (CI has a dedicated check). None of the three
> install paths — GitHub, tgz, npm — needs a dsh source tree.

> This repository's `src/` owns current downstream source; `lib/` ships prebuilt.
> The monorepo's `packages/community/ponytail` is the historical inlined baseline.
> Use `node scripts/build-ui.mjs` for downstream builds; do not overwrite local
> downstream changes with `sync:dist` before they exist in the host checkout.

## Features

- **Core mode** `/ponytail` — injects a structured lazy-developer ruleset
  every turn; **the three levels are genuinely different prompt fragments**
  (not just a swapped line):
  - **Common (shared by every non-off level)**: turn the request into an
    observable completion condition first; gather evidence along the real call
    flow, but the decision ladder is a quick reflex, not a research project;
    follow the “inspect → change → narrowest effective verification → inspect
    the final diff” loop; non-trivial logic keeps exactly one minimal runnable
    check, without standing up a test framework or fixtures; report only
    verified results.
  - **Safety (never removable in any level)**: input validation, error
    handling that prevents data loss, security measures, accessibility,
    explicit acceptance criteria, understanding the problem first, and
    “minimal diff ≠ correct fix”.
  - **`lite`**: execute directly, less ceremony; still complete explicit
    deliverables; **must name a simpler alternative in one line, leaving the
    choice to the user**. If none works, say so; do not invent an alternative
    or silently change the requested scope.
  - **`full`** (default): the full seven-rung ladder (YAGNI → reuse → stdlib
    → native → installed dependencies → one line → minimal implementation);
    pick the shortest correct implementation by default; fix root causes, not
    symptoms.
  - **`ultra`**: demand evidence before adding code; prefer deleting or
    reusing; proactively question speculative features/caching/abstraction/
    configuration/new dependencies; for complex requests deliver the minimal
    correct version first and state the conditions for expanding — **not a
    blanket refusal**.
  - `off`: no injection at all.
  - Levels are **session-scoped** (session A does not affect session B;
    released automatically when the session ends).
  - Bare `/ponytail`: opens a picker in Web hosts with native command-menu
    support. Elsewhere it reports when enabled; from `off` it restores the
    effective default (falling back to `full` if that default is also `off`).
  - `/ponytail status`: query only, never modifies, and shows whether the
    current mode comes from a session override or the configured default.
  - `/ponytail reset`: clears the current session override and follows the
    effective configured default again.
  - `/ponytail lite|full|ultra|off`: explicit switch.
  - `/ponytail help`: displays command help without calling the model.
  - `/ponytail default <mode>`: persists through DSH Settings when available,
    otherwise the user-level config file (env/profile still take priority; the command reports both
    `saved` and `effective`).
  - Status changes take effect immediately without waking an idle agent.
    Notices reach the model on its next real step, avoiding an extra model
    turn just to switch levels.
- **One-shot skills** (load on demand, never part of the standing prompt):
  - `/ponytail-review` — find over-engineering in recent changes; every
    finding includes location, replacement, and actual call evidence; no
    guessed savings numbers.
  - `/ponytail-audit` — whole-repo over-engineering audit; distinguishes
    safe-to-delete from verify-first candidates; at most 10 high-value
    findings.
  - `/ponytail-debt` — harvests all `ponytail:` comments into a debt ledger.
  - `/ponytail-gain` — upstream benchmark reference scoreboard (less code;
    token/cost/latency effects depend on model and task, **not guaranteed by
    this port**).
  - `/ponytail-help` — reference card.
- **Deactivation**: say `stop ponytail`, `normal mode`, `停止 ponytail`,
  `关闭 ponytail`, `普通模式`, or `正常模式` (trailing Chinese/English
  punctuation tolerated); `/ponytail` re-enables at any time.
- **Default priority** (consistent across code/tests/docs):
  ```
  session override > PONYTAIL_DEFAULT_MODE > Profile config.defaultMode > DSH Settings > user config.json > full
  ```
  - **Profile-level config** (official Cordis plugin config API; each profile
    can differ):
    ```yaml
    # add config to the ponytail row in ~/.dsh/profiles/tui/cordis.patch.yml
    - insert:
        - id: ponytail
          name: '@mengyuly/dsh-ponytail'
          config:
            defaultMode: lite
    ```
    Example: `web → full`, `tui → lite`, `automation → off`. Profile config is
    read when the plugin initializes (Cordis has no public config-change
    event), so **restart that profile after changing it**; an invalid value
    warns once and falls back without breaking startup. The user `config.json`
    stays hot-reloaded.
  - **User config.json** (`~/.config/ponytail/config.json`, Windows
    `%APPDATA%\ponytail\config.json`): `{"defaultMode": "lite"}`,
    hot-reloaded (~1s polling); invalid content keeps the last valid value.
- **Subagents (honest boundaries)**: DSH's built-in `subagent` tool is an
  **isolated fork**, but the global system-prompt section participates in each
  subagent's own assembly by default; this is not parent-prompt or session
  state inheritance. `PONYTAIL_SUBAGENT_MATCHER` (a regex matched against the
  subagent's `agentPreset`) only filters which subagents can enter this prompt
  pipeline — it is not an inheritance switch; without a preset nothing is
  excluded by the matcher. DSH currently has no public parent→child prompt
  inheritance API, so **no parent-child prompt inheritance is claimed** (a
  read-only mode-snapshot propagation may follow once an official API
  exists). An invalid regex warns once and fails open.
- **Config errors**: invalid JSON / invalid `defaultMode` / read failures /
  invalid regex warn exactly once (no log spam); a missing config file is
  normal and never warns.

## Graphical controls

On DSH Web hosts with the native `settingsScope`/`settings.plugin.item` APIs,
open **Settings → Plugins → Ponytail** to select a default mode, toggle five
optional skills, save, or reset panel defaults. “Follow existing configuration”
preserves legacy configuration. Environment/profile values still take priority;
existing session overrides stay intact. Use `/ponytail status` for the actual
session mode and source. Optional-skill toggles never remove the core rules.

When supported, bare `/ponytail` opens a native picker with mode/status/reset/help
actions. Argued commands and TUI/CLI behavior remain unchanged. Older hosts
without these services keep the command/config-file paths. Failed saves retain
drafts; read-only connections cannot write. Panel reset clears only its own
overrides, not legacy files or session state, and requests no model work.

The native UI and file-backed settings were integration-tested in an isolated
profile on the real WSL Debian DSH checkout `b150a551`. Older Settings scopes
with only `set/unset` save through the host's atomic RPC with revision checks.
DSH contract peers retain their version ranges but are optional for package
resolution and supplied by the host. Cordis and schemastery remain required
runtime peers. Normal installation needs no auto-peer workaround and does not
fetch a second DSH or the unpublished `dsh-type-meta` peer. Optional metadata
does not make host services optional: runtime still requires DSH systemPrompt,
skills, and the other services used by the plugin.

Developer UI checks use isolated tools, excluded from the npm tarball:
```powershell
$env:PONYTAIL_TOOL_ROOT = Join-Path $env:TEMP 'ponytail-ui-tools'
npm install --prefix $env:PONYTAIL_TOOL_ROOT --ignore-scripts typescript@6.0.3 esbuild@0.28.2 react@18.3.1 react-dom@18.3.1 jsdom@26.1.0
node scripts/build-ui.mjs
node scripts/test-ui.mjs
```
`build-ui` retains baseline inlined host dependencies and compiles downstream
rule fragments and entry/UI code; it is **not an authoritative monorepo rebuild**. Provenance's
`sourceCommit` identifies the baseline; `downstreamBuild` records current source
and artifact hashes.

## Efficiency (conditional gains, not guarantees)

Ponytail adds a small fixed ruleset to every model request. Its benefit is
**conditional**: when the agent tends to over-engineer, the reduced code,
tool calls, and rework may offset or exceed that overhead; when the task is
already simple, the gain may be near zero — or the extra input overhead may
lose outright. It is not a “save tokens switch” and does not guarantee savings
across models — some reasoning models may get more expensive due to prompt
and reasoning overhead.

Measured prompt-section sizes for this DSH port (`node
scripts/measure-prompt.mjs`, generated from the real
`getPonytailInstructions()`):

| Level | Characters | UTF-8 bytes | Notes |
|------|--------|-----------|------|
| lite | 3911 | 3913 | measured output |
| full | 4818 | 4834 | measured output |
| ultra | 5034 | 5050 | measured output |
| off | 0 | 0 | not injected |

These are **prompt-size measurements, not billing amounts, and not a savings
ratio that holds for every model** (there is no universal tokenizer;
`estimated_tokens` in `measure:prompt` output is null; characters/4 is only a
rough estimate). Same-mode output is byte-stable, which helps prompt caching,
but does not guarantee a host or model cache hit.

Every active level preserves upstream boundaries: check all callers before a
bug fix, prefer edge-case correctness between same-size options, annotate real
shortcuts with `ponytail: <ceiling>, <upgrade path>`, retain hardware calibration,
and give explicitly requested explanations in full. Rules apply to coding only,
not unrelated prose or translation. Debt scans support block comments and `lib`
sources; both scan paths exclude nested dependency and build directories.
Checks cover prompt contracts, actual scan commands, and exact installed/source
prompt and skill parity, not model compliance rates or measured performance.

Every active prompt contains the complete seven-rung ladder. Lite must name a
simpler alternative in one line while leaving scope to the user; Full enforces
the ladder; Ultra enforces it and challenges unnecessary complexity more actively.
Do not add dependencies for work a few lines can do; touch the fewest files that
deliver a correct complete fix. If the user insists on full scope, build it
without re-arguing. Non-trivial logic keeps one minimal runnable check, not an
unrequested per-function suite; trivial one-liners need no extra test.

**Upstream numbers are not a guarantee for this DSH port**: the upstream
Ponytail single-shot results (code −80–94%, cost −42–75%, latency 3.1–5.8×)
and agentic results (LOC −54% etc.) are references only; this DSH port has
**not** established stable token/cost/latency savings rates. The DSH smoke
benchmark provides directional evidence only (see
`docs/dsh-smoke-summary.md`).

## Known limitations

- The levels differ in **rule semantics** (see above); the three prompt
  sizes are similar (measured in the table above).
- The upstream Claude-only statusline badge has no DSH counterpart; the MCP
  server was dropped because DSH has a first-class system-prompt injection
  point.
- User `config.json` hot-reloads; `PONYTAIL_DEFAULT_MODE` and profile config
  need a restart.
- The shipped `lib/` is prebuilt; build downstream changes in this repository
  and verify installed/source parity.

## Compatibility matrix (measured, not fabricated)

| Component | Verified environment | Notes |
|---|---|---|
| Node.js | 22.x / 24.x | CI matrix, 4 combinations green |
| OS | ubuntu-24.04 / windows-latest | CI matrix |
| DSH | commit `b150a551` (build checkout) | exact mapping to an official release **TBD** |
| Cordis | 4.0.1 (build vendor) | same |
| web profile | verified | isolated real WSL DSH: loading, save/restart persistence, priorities, skill switches and commands; npm/pnpm install checks |
| tui profile | not verified | not started inside a tui profile |
| headless profile | not verified | not fully started; plugin unit tests run in a UI-less environment |
| npm tarball | verified | contents/version/post-install smoke/NodeNext consumer |

- `dist-provenance.json` records the actual build sources (checkout commit +
  node/typescript/tsdown/cordis versions).
- Do not hide failures with `continue-on-error` — the matrix is green only if
  every cell is green.

## Test environments and source of truth

- Verified with WSL Debian Node **v24.16.0**, checkout CLI **0.1.1-rc.2**,
  Windows Node 24 and CI (**ubuntu-24.04 + windows-latest × Node 22/24**).
  Host checkout `b150a551` is not an official release tag; this does not
  establish compatibility with every published DSH version.
- The historical host build baseline is `packages/community/ponytail` in the
  deepseek-harness monorepo. Current `@mengyuly/dsh-ponytail` downstream changes
  are maintained in this repository's `src/`, alongside shipped artifacts.

## Release maintenance

> **The commands below are for source-repository maintainers only.** The
> `scripts/` directory is deliberately **excluded from the npm tarball**, so
> these commands are unavailable after installing the published package — npm
> users never need to run maintenance checks; they exist for maintainers and
> CI before a release. The published `package.json` exposes no `scripts/`
> commands (no maintenance entry points, no install lifecycle hooks),
> enforced by a regression check in `node scripts/verify-pack.mjs`.

- **Build sources**: the monorepo supplies the historical inlined dependency
  baseline; this repository owns current downstream source. `build-ui` and a
  full `sync:dist` provide different evidence and must not be conflated.
- **Maintainer commands** (run `node scripts/<script>.mjs` inside the source
  repository; see `package.dev.json` for the shortcut list):
  ```bash
  node scripts/check-bundle.mjs        # bundle external-dependency allowlist + no new Function/eval
  node scripts/verify-dist.mjs         # static consistency: src/d.ts export parity, key signatures, runtime exports, provenance
  node scripts/verify-pack.mjs         # tarball boundary (incl. no scripts/ exposure regression), versions, post-install smoke
  node scripts/test-consumer.mjs       # NodeNext + skipLibCheck:false declaration consumer test (against the packed artifact)
  node scripts/test-regressions.mjs    # regression tests for the verification tooling itself
  node scripts/test-core.mjs           # core prompt bytes, safety boundaries, modes and skill surface
  node scripts/test-install.mjs        # pnpm 11 default peer installation, no host tree/workaround
  node scripts/measure-prompt.mjs      # prompt-section size per mode (depends on the unpublished src/)
  node scripts/check-release-links.mjs # README/CHANGELOG/docs contain no versioned latest asset links
  node scripts/check-release-consistency.mjs --version <v>  # four-way release consistency (git tag/npm/GitHub/provenance)
  ```
- **Fully regenerate and sync `lib/`** (JS and declarations must be synced as
  one artifact; copying a single JS file is forbidden):
  ```bash
  DSH_CHECKOUT=/path/to/deepseek-harness node scripts/sync-dist.mjs
  ```
  This rebuilds the host checkout baseline and overwrites this repository's
  source, JS, declarations and provenance. **Use only after downstream changes
  exist in that checkout and a full rebuild is intended**, not as the routine
  downstream build command.
- **CI capability boundary (honest)**: CI runs static checks, downstream
  source/artifact hashes and pack/consumer tests; it **does not rebuild the
  host monorepo**. These checks establish neither full-rebuild equivalence
  with the host baseline nor model compliance or efficiency gains.
- `dist-provenance.json` ships with the npm package for build-source audits.
- When verifying locally, if `npm_execpath` points at another package manager
  (e.g. a pnpm/yarn shim), the scripts fall back to `npm` on PATH; set
  `PONYTAIL_VERIFY_KEEP_TEMP=1` to keep temp directories on failure.
- **Security**: `scripts/**` exists only for development/build/release
  verification — **not in the npm tarball**, no install lifecycle hooks, not
  referenced by the runtime entry point, and not exposed in the published
  `package.json`; `child_process` warnings there are accepted development-tool
  risk. See [SECURITY.md](SECURITY.md).

## License

MIT, © 2026 DietrichGebert (upstream) + MengYuil (port). See [LICENSE](LICENSE).
