#!/bin/sh
# Builds sites/<host>/ from app/ with each site's config.js. Run from this folder.
set -e
API=https://us4-app-funbackend.us4atx.com/api
rm -rf sites; mkdir sites
mk(){ mkdir -p sites/$1; cp -r app/$2/. sites/$1/; cp -r app/shared sites/$1/shared
  printf 'window.FI_CONFIG = {"apiBase":"%s","clientId":"%s","site":"%s"};\n' "$3" "$4" "$2" > sites/$1/config.js; }
mk us4-app-funbackend.us4atx.com backend /api ""
mk us4-site-fun-demo1m.us4atx.com client-admin $API demo
mk us4-site-fun-demo1e.us4atx.com client-employee $API demo
mk us4-site-fun-beta1m.us4atx.com client-admin $API beta1
mk us4-site-fun-beta1e.us4atx.com client-employee $API beta1
