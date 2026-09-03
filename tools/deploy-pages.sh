#!/bin/bash
# Publie la previsualisation sur GitHub Pages.
#
# Independant de l'hebergeur principal : `git push` est le seul canal
# necessaire, et c'est le seul qui fonctionne de facon fiable depuis
# l'environnement de developpement. A lancer apres `npm run build`.
set -e
cd "$(dirname "$0")/.."
node tools/pages.mjs
rm -rf /tmp/ghp && mkdir -p /tmp/ghp && cp -r .pages/. /tmp/ghp/
cd /tmp/ghp
git init -q -b gh-pages
git remote add origin https://github.com/mbosseu/ufc.git
git add -A
git commit -q -m "Previsualisation $(date -u +%Y-%m-%dT%H:%MZ)"
git push -f origin gh-pages
echo "→ https://mbosseu.github.io/ufc/"
