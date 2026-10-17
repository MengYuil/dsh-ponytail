# Security

## Published runtime boundary

The npm package publishes only the runtime bundles, declarations, metadata,
license, documentation, and Cordis patch. Development scripts under `scripts/`
are excluded from the tarball (verified by CI).

The package defines no `preinstall`, `install`, or `postinstall` lifecycle
hook. The installed runtime entry does not import development scripts, and
`cordis.patch.yml` only inserts the plugin bundle row — it never executes
scripts.

## Development tooling

`scripts/lib/run-command.mjs` and `scripts/sync-dist.mjs` use
`node:child_process.spawnSync` to run local verification and build tools.

`scripts/test-persistence.mjs` starts four isolated real DSH test processes
on Linux. Its test-only host helper sends SIGKILL to itself after a durability
barrier, then the runner checks recovery in a new process. It never terminates
user processes or uses user profiles/credentials; only an offline fixed-response
model adapter is registered. This integration tooling is also excluded from
the npm tarball and all runtime/install entry points.

`scripts/test-host-ui.mjs` installs an explicitly selected published DSH into
a temporary test runtime and drives a real browser against an isolated local
Profile. It starts/stops only its own child host, skips onboarding without
entering credentials, and sends no model requests. Host tokens are redacted
from retained diagnostics. This maintainer-only runner is excluded from the
npm package and never runs during plugin installation.

They execute only when a maintainer explicitly runs the corresponding
repository-maintainer command (`node scripts/...`, see `package.dev.json`).
This is an intentional capability of local build tooling, not part of
the installed plugin runtime. Arguments are passed as arrays. npm verification
commands run without a shell on every platform; Windows invokes npm's CLI
through the active Node executable. The distribution sync script uses a shell
only for fixed checkout-local build-tool launchers on Windows. No command is
fed by plugin runtime input, model output, or network input. `DSH_CHECKOUT` is
used only as a local working directory / path resolution target — never as
shell code.

## Static-analysis disposition

Findings for `child_process` under `scripts/**` are classified as accepted
development-tooling risk, provided that:

- `scripts/**` remains excluded from the npm tarball;
- no install lifecycle hook invokes it;
- runtime entries do not import it;
- command arguments do not accept untrusted runtime input.

CI verifies these boundaries (`node scripts/verify-dist.mjs`, `node scripts/verify-pack.mjs`).

## Dynamic-code findings

Dynamic-code findings in published runtime bundles (e.g. the previously
inlined `new Function` from schemastery) are tracked separately and are not
covered by this accepted development-tooling disposition. Since v0.1.6 the
shipped bundle is free of `new Function` / `eval`; CI's `check-bundle` step
enforces that.

## Reporting

Security issues in this plugin should be reported privately to the repository
owner; this is a community port and is not covered by an official security
program.
