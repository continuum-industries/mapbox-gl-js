#!/bin/bash
set -e

cd "$(dirname "$0")/../.."

for plugin in plugins/*/package.json; do
  npm run build -w "$(dirname "$plugin")"
done

./test/pack.sh

# Bundler pages must consume the packed artifact, not the workspace source.
rm -rf node_modules/mapbox-gl
npm install --no-save ./test/mapbox-gl.tgz
