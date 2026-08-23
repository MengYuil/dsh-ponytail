#!/bin/bash
# Build dsh-ponytail: typecheck src/ against a dsh source checkout.
# The shipped lib/ is a prebuilt bundle produced in the deepseek-harness
# monorepo (packages/community/ponytail); this script only verifies the source
# compiles against the real dsh core, which is what a maintainer editing src/
# needs before committing.
#
# Usage:  DSH_CHECKOUT=/path/to/deepseek-harness ./scripts/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECKOUT="${DSH_CHECKOUT:-}"
if [ -z "$CHECKOUT" ] || [ ! -f "$CHECKOUT/tsconfig.base.json" ]; then
  echo "build: cannot locate the dsh checkout (set DSH_CHECKOUT)" >&2
  exit 1
fi

TSC="$CHECKOUT/node_modules/.bin/tsc"
if [ ! -x "$TSC" ]; then
  echo "build: tsc not found at $TSC" >&2
  exit 1
fi

# node: types come from the checkout's @types/node.
mkdir -p "$ROOT/node_modules"
if [ ! -e "$ROOT/node_modules/@types" ]; then
  ln -s "$CHECKOUT/node_modules/@types" "$ROOT/node_modules/@types"
fi
trap 'rm -f "$ROOT/tsconfig.build.json" "$ROOT/node_modules/@types"' EXIT

cat > "$ROOT/tsconfig.build.json" <<JSON
{
  "compilerOptions": {
    "target": "es2024",
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "types": ["node"],
    "noEmit": true,
    "paths": {
      "@deepseek-ai/cordis": ["$CHECKOUT/vendor/cordis"],
      "@deepseek-ai/dsh-agent": ["$CHECKOUT/packages/core/agent"],
      "@deepseek-ai/dsh-commands": ["$CHECKOUT/packages/interaction/commands"],
      "@deepseek-ai/dsh-invariants": ["$CHECKOUT/packages/runtime-diagnostics/invariants"],
      "@deepseek-ai/dsh-llm": ["$CHECKOUT/packages/llm/llm"],
      "@deepseek-ai/dsh-skill": ["$CHECKOUT/packages/skill/skill"],
      "@deepseek-ai/dsh-system-prompt": ["$CHECKOUT/packages/core/system-prompt"]
    }
  },
  "include": ["src"]
}
JSON

"$TSC" -p "$ROOT/tsconfig.build.json"
echo "build: src typechecks against $CHECKOUT"
