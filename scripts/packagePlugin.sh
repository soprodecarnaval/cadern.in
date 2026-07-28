#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION=$(grep -m1 'version:' plugin/caderninhoFormatter.qml | cut -d'"' -f2)
ZIP="caderninhoFormatter-$VERSION.zip"
STAGE=".tmp-plugin"

# stage under a caderninhoFormatter/ dir so the zip extracts into that folder
rm -rf "$STAGE"
mkdir -p "$STAGE/caderninhoFormatter" public/plugin
cp plugin/*.qml plugin/*.js "$STAGE/caderninhoFormatter/"

rm -f public/plugin/caderninhoFormatter*.zip
(cd "$STAGE" && zip -r -X "$ROOT/public/plugin/$ZIP" caderninhoFormatter)
rm -rf "$STAGE"

# keep the download links in sync with the packaged version
sed -e "s/caderninhoFormatter\(-[0-9][0-9.]*\)\{0,1\}\.zip/$ZIP/g" \
    public/plugin/index.html > public/plugin/index.html.tmp
mv public/plugin/index.html.tmp public/plugin/index.html

echo "packaged public/plugin/$ZIP"
