#!/usr/bin/env bash
# Run by the org's node-ci (krizaka/.github) after `npm run build`, from the repository root.
set -euo pipefail
echo "::group::Docs are generated from this code"
node scripts/generate-docs.mjs --check
echo "::endgroup::"
echo "::group::The public pages stay static, in each language"
NEXT_PUBLIC_APP_URL=http://localhost:3000 node scripts/check-static-pages.mjs
echo "::endgroup::"
