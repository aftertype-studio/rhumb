#!/bin/sh
# Packs only what ships. Allowlist, so dev files can never leak in.
set -e
cd "$(dirname "$0")/.."
name=$(node -p "require('./package.json').name")
mkdir -p dist
rm -f "dist/$name.zip"
zip -r "dist/$name.zip" ./*.hbs partials assets locales package.json LICENSE README.md CHANGELOG.md -x '*.DS_Store'
