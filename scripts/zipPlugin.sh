#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$ROOT/.tmp-plugin"
OUT="$ROOT/public/plugin/caderninhoFormatter.zip"

rm -rf "$STAGE"
mkdir -p "$STAGE/caderninhoFormatter" "$(dirname "$OUT")"
cp "$ROOT"/plugin/*.qml "$ROOT"/plugin/*.js "$STAGE/caderninhoFormatter/"

rm -f "$OUT"
(cd "$STAGE" && zip -r -X "$OUT" caderninhoFormatter)

rm -rf "$STAGE"
