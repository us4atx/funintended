# VPS deploy files

Used on the Ubuntu VPS that serves the five FunIntended sites under us4atx.com.

- `server.mjs` – Node server for the API and static sites.
- `make-sites.sh` – builds `sites/<host>/` from an `app/` folder (apps/*/public + shared) with each site's `config.js`.

Secrets (admin password, FI_SECRET, Supabase keys) live only on the server, never in this repo.
