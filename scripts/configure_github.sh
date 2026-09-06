#!/usr/bin/env bash
set -euo pipefail
repo="${1:-kvnloo/north-star-railworks}"
# Repository must already contain main, dev, and nightly.
if ! gh api "repos/$repo/pages" >/dev/null 2>&1; then
  gh api --method POST "repos/$repo/pages" -f build_type=workflow >/dev/null
else
  gh api --method PUT "repos/$repo/pages" -f build_type=workflow >/dev/null
fi
settings_file="$(mktemp)"
trap 'rm -f "$settings_file"' EXIT
cat > "$settings_file" <<'JSON'
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
gh api --method PUT "repos/$repo/environments/github-pages" --input "$settings_file" >/dev/null
for branch in main dev nightly; do
  existing="$(gh api "repos/$repo/environments/github-pages/deployment-branch-policies" --jq ".branch_policies[] | select(.name == \"$branch\") | .id")"
  if [ -z "$existing" ]; then
    gh api --method POST "repos/$repo/environments/github-pages/deployment-branch-policies" -f name="$branch" -f type=branch >/dev/null
  fi
done
printf 'Configured GitHub Pages and deployment policies for %s\n' "$repo"
