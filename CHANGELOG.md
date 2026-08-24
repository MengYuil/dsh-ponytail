# Changelog

All notable changes to `@mengyuly/dsh-ponytail` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
