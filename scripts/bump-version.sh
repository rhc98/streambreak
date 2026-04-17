#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>  (e.g. 0.2.0)"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CARGO_TOML="$REPO_ROOT/src-tauri/Cargo.toml"
TAURI_CONF="$REPO_ROOT/src-tauri/tauri.conf.json"

# [package] 섹션의 version만 교체 (dependencies는 건드리지 않음)
awk -v ver="$VERSION" '
  /^\[package\]/ { in_pkg=1 }
  /^\[/ && !/^\[package\]/ { in_pkg=0 }
  in_pkg && /^version = / { sub(/"[^"]*"/, "\"" ver "\"") }
  { print }
' "$CARGO_TOML" > "$CARGO_TOML.tmp" && mv "$CARGO_TOML.tmp" "$CARGO_TOML"

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install with: brew install jq"
  exit 1
fi
TMP=$(mktemp)
jq ".version = \"$VERSION\"" "$TAURI_CONF" > "$TMP" && mv "$TMP" "$TAURI_CONF"

echo "Bumped to $VERSION"
echo ""
echo "Next steps:"
echo "  git add src-tauri/Cargo.toml src-tauri/tauri.conf.json"
echo "  git commit -m 'chore: bump version to $VERSION'"
echo "  git tag v$VERSION && git push && git push --tags"
