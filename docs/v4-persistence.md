# V4 persistence verification

Verified locally on 2026-10-13 with the fixed package: WSL Debian, Node
24.16.0, npm DSH 0.2.0-rc.2, Cordis 4.0.4 and Schemastery 3.18.4.

## What is real

The test boots installed DSH core plugins through App Boot/Loader: Agent Loop,
commands, Session, JSONL persistence, projection registry, storage and projection
cache. Ponytail is installed from the actual npm pack, not imported from `src/`.
The only test double is an offline fixed-response LLM adapter. No user profile,
credential or session is used; no external model request is made.

Four independent host processes perform:

1. Lite/Full/Ultra/Off changes, reactivation, reset, saved default Ultra,
   ordinary turns and Chinese text deactivation.
2. Normal restart, exact comparison of the committed event prefix and more
   writes, including English text deactivation and reset.
3. Another resume and more writes, then SIGKILL of the test-owned process only
   after the real flush barrier and projection checkpoint.
4. Recovery from that termination and successful continuation.

The local reference run had 63 → 105 → 147 → 189 events and 12 completed turns.
The test checks event identities/content/sources, contiguous sequences, the
actual disk log and advancing checkpoint watermarks, not just event counts.
Mode notices have producer `ponytail`, never the retired `plugin` source.

## Run and CI

From this source repository on Linux or WSL:

```bash
node scripts/test-persistence.mjs
```

The runner creates a fresh private temporary directory, installs the pinned
DSH host and packed plugin into separate dependency trees, runs four processes,
and removes its own temporary tree after verification. Use
`PONYTAIL_VERIFY_KEEP_TEMP=1` to retain logs, event snapshots, the final JSONL,
checkpoint and `summary.json` under its `evidence/` directory.

The independent `persistence` CI job uses ubuntu-24.04 and Node 24 and uploads
evidence even on failure. This is separate from the Windows/Linux × Node 22/24
matrix, whose pack test checks all nine producer sites through real V4 admission.
The integration script and helper never ship in the npm package.

## Limits and recovery

- Saved default testing uses the real legacy `config.json` path. Newer Web
  native Settings, UI skill switches and TUI are not covered by this test.
- Session overrides deliberately live in memory. On restart, the saved
  default applies; this is unchanged behavior, not lost persisted settings.
- SIGKILL recovery covers data whose real flush already completed, not a
  promise that unflushed data survives any crash.
- The test prevents regressions in new messages. It does not automatically
  repair existing in-memory buffers poisoned by older versions. Back up
  visible unsaved content before upgrading/restarting an affected host.
- It is not a model-compliance, prompt-understanding, cost or latency benchmark.
