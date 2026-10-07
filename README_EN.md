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
- **Pinned version v0.3.3** (immutable per tag):
  `https://github.com/MengYuil/dsh-ponytail/releases/download/v0.3.3/mengyuly-dsh-ponytail.tgz`

Notes:

- **latest**: good for a quick install; it tracks the newest release. The fixed
  asset name `mengyuly-dsh-ponytail.tgz` stays the same in every release, so
  the URL never breaks on a version bump — which also means it is **not
  suitable as an immutable dependency**.
- **Pinned version**: good for reproducible installs; the URL pins a tag
  (e.g. `v0.3.3`) that is immutable per tag; the asset name is likewise
  `mengyuly-dsh-ponytail.tgz`.
- npm installs still go through the npm Registry or the `dsh plugin` command.
- The fixed asset name is produced and verified by
  `scripts/release-assets.mjs` (`node scripts/release-assets.mjs`, maintainers
  only).

## Installation

Install into a profile (replace `web` with `tui` or a custom name):

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

Restart the profile after installing (`dsh web` / `dsh tui`) for it to take
effect. Once loaded, the session skill catalog shows 6 `ponytail*` skills; send
`/ponytail-help` to verify immediately.

> `lib/index.js` is a self-contained bundle (`dsh-llm` / `dsh-skill` are
> already inlined — npm has no compatible versions) with two published
> runtime peers: `@deepseek-ai/cordis` (4.0.1) and
> `@deepseek-ai/schemastery` (3.18.x). `schemastery` is deliberately kept
> external rather than inlined: its schema DSL compiles `callback` strings
> with `new Function`, so keeping it out means **the shipped artifact contains
> no dynamic code execution** (CI has a dedicated check). None of the three
> install paths — GitHub, tgz, npm — needs a dsh source tree.

> Note: `src/` is the source, `lib/` is the prebuilt artifact (loadable
> out of the box, no build step). The authoritative source lives in the
> deepseek-harness monorepo at `packages/community/ponytail`; after changing
> source, rebuild and sync the full `lib/` with
> `DSH_CHECKOUT=/path/to/deepseek-harness node scripts/sync-dist.mjs`
> (see “Release maintenance” below).

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
    deliverables; you may point out a simpler approach in one sentence, but
    **do not challenge explicit requirements**.
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
  - Bare `/ponytail`: when enabled it only reports; when `off` it restores the
    effective default level (falling back to `full` if that default is also
    `off`).
  - `/ponytail status`: query only, never modifies, and shows whether the
    current mode comes from a session override or the configured default.
  - `/ponytail reset`: clears the current session override and follows the
    effective configured default again.
  - `/ponytail lite|full|ultra|off`: explicit switch.
  - `/ponytail default <mode>`: persists the default to the **user-level
    config file** (env/profile still take priority; the command reports both
    `saved` and `effective`).
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
  session override > PONYTAIL_DEFAULT_MODE > Profile config.defaultMode > user config.json > full
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
| lite | 1915 | 1917 | measured output |
| full | 3022 | 3038 | measured output |
| ultra | 2797 | 2813 | measured output |
| off | 0 | 0 | not injected |

These are **prompt-size measurements, not billing amounts, and not a savings
ratio that holds for every model** (there is no universal tokenizer;
`estimated_tokens` in `measure:prompt` output is null; characters/4 is only a
rough estimate). Same-mode output is byte-stable, so KV-cache prefixes hit.

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
- The shipped `lib/` is a prebuilt artifact; to change behavior, rebuild in
  the main repo and re-sync.

## Compatibility matrix (measured, not fabricated)

| Component | Verified environment | Notes |
|---|---|---|
| Node.js | 22.x / 24.x | CI matrix, 4 combinations green |
| OS | ubuntu-latest / windows-latest | CI matrix |
| DSH | commit `b150a551` (build checkout) | exact mapping to an official release **TBD** |
| Cordis | 4.0.1 (build vendor) | same |
| web profile | verified | long-running on a real local profile + three isolated install-path tests (npm / GitHub / tgz) |
| tui profile | not verified | not started inside a tui profile |
| headless profile | not verified | not fully started; plugin unit tests run in a UI-less environment |
| npm tarball | verified | contents/version/post-install smoke/NodeNext consumer |

- `dist-provenance.json` records the actual build sources (checkout commit +
  node/typescript/tsdown/cordis versions).
- Do not hide failures with `continue-on-error` — the matrix is green only if
  every cell is green.

## Test environments and source of truth

- Verified locally (Linux, Node.js **v24.16.0**, deepseek-harness checkout
  build) and in the CI matrix (**ubuntu-latest + windows-latest × Node
  22/24**). The exact published DSH/Cordis release they correspond to is
  **TBD** — the checkout is a prerelease working tree, not a release tag.
- The authoritative source is `packages/community/ponytail`
  (`@deepseek-ai/dsh-ponytail`) in the deepseek-harness monorepo; this
  repository (`@mengyuly/dsh-ponytail`) is a **distribution mirror**: it
  ships build artifacts with the package and is not an independent source of
  truth.

## Release maintenance

> **The commands below are for source-repository maintainers only.** The
> `scripts/` directory is deliberately **excluded from the npm tarball**, so
> these commands are unavailable after installing the published package — npm
> users never need to run maintenance checks; they exist for maintainers and
> CI before a release. The published `package.json` exposes no `scripts/`
> commands (no maintenance entry points, no install lifecycle hooks),
> enforced by a regression check in `node scripts/verify-pack.mjs`.

- **Authoritative source**: `packages/community/ponytail` in the
  deepseek-harness monorepo (this repository is a distribution mirror that
  publishes build artifacts only).
- **Maintainer commands** (run `node scripts/<script>.mjs` inside the source
  repository; see `package.dev.json` for the shortcut list):
  ```bash
  node scripts/check-bundle.mjs        # bundle external-dependency allowlist + no new Function/eval
  node scripts/verify-dist.mjs         # static consistency: src/d.ts export parity, key signatures, runtime exports, provenance
  node scripts/verify-pack.mjs         # tarball boundary (incl. no scripts/ exposure regression), versions, post-install smoke
  node scripts/test-consumer.mjs       # NodeNext + skipLibCheck:false declaration consumer test (against the packed artifact)
  node scripts/test-regressions.mjs    # regression tests for the verification tooling itself
  node scripts/test-core.mjs           # core prompt bytes, safety boundaries, modes and skill surface
  node scripts/measure-prompt.mjs      # prompt-section size per mode (depends on the unpublished src/)
  node scripts/check-release-links.mjs # README/CHANGELOG/docs contain no versioned latest asset links
  node scripts/check-release-consistency.mjs --version <v>  # four-way release consistency (git tag/npm/GitHub/provenance)
  ```
- **Fully regenerate and sync `lib/`** (JS and declarations must be synced as
  one artifact; copying a single JS file is forbidden):
  ```bash
  DSH_CHECKOUT=/path/to/deepseek-harness node scripts/sync-dist.mjs
  ```
  This rebuilds inside the authoritative checkout (`tsc` for declarations +
  `tsdown` for the runtime bundle), syncs `lib/index.js`, `lib/invariant.js`,
  `lib/types/*.d.ts`, generates `dist-provenance.json` (recording the
  authoritative checkout's real commit SHA and toolchain versions), and runs
  the consistency checks automatically; it prompts you to commit when
  artifacts changed. **Full build consistency is produced by this command in
  the release process — the mirror repository's CI never rebuilds the
  authoritative monorepo.**
- **CI capability boundary (honest)**: CI (ubuntu + windows matrix) runs the
  static verification and pack/consumer tests above, but **does not rebuild
  the authoritative monorepo**; `verify:dist` is an export-surface/signature/
  runtime-export consistency check, **not** a byte-level equivalence proof
  against the authoritative build — that is guaranteed by `sync:dist` in the
  release process.
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
