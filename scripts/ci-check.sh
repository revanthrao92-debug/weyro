#!/usr/bin/env bash
# Run all CI checks: lint, typecheck, and tests.
# Usage: ./scripts/ci-check.sh
set -euo pipefail

echo "🔍 Lint..."
npm run lint

echo "📘 Typecheck..."
npm run typecheck:all

echo "🧪 Tests..."
npm test

echo "✅ All checks passed."
