# VPS deploy files

Used on the Ubuntu VPS that serves the five FunIntended sites under us4atx.com.

- `server.mjs` – Node server for the API and static sites.
- `make-sites.sh` – builds `sites/<host>/` from an `app/` folder (apps/*/public + shared) with each site's `config.js`
  for the original five sites. Sites of clients created later are served straight from `app/` (no rebuild needed).
- `provisioner/` – the hosting agent that gives every new client its two HTTPS sites (Caddy block + certificate).
  Install once as root with `sh provisioner/install.sh`; logs in `journalctl -u funintended-provision`.

Secrets (admin password, FI_SECRET, Supabase keys) live only on the server, never in this repo.
