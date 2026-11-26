# VPS deploy

The Ubuntu VPS serves the five FunIntended sites under us4atx.com from one Node process
(systemd service `funintended`, code in `/opt/funintended`, settings in `/etc/funintended.env`).

## Automatic deploys

Every push to `main` runs `.github/workflows/deploy-vps.yml` (pushes that only touch `*.md` or
`tools/` are skipped). It can also be run by hand from the repo's **Actions** tab.

The workflow packages the apps and opens a single SSH connection to the VPS, where
`vps/deploy.sh`:

1. **Backs up the database first.** With Supabase configured it saves the `fi_documents` table
   through the REST API and, for the self-hosted Supabase on the VPS, a full `pg_dump` of its
   Postgres from the `supabase-db` container. An old local data file (`FI_DEV_STORE`) is saved too
   if it still exists. `/etc/funintended.env` is only read, never changed. Backups go to
   `/var/backups/funintended/` (gzipped JSON, last 60 kept). If the backup fails, nothing is deployed.
2. Builds the new release and the five `sites/<host>/` folders with `make-sites.sh`.
3. Swaps it into `/opt/funintended` (the previous one is kept as `/opt/funintended.prev`) and restarts.
4. Checks the backend answers. If not, it puts the previous release back automatically.

GitHub secrets used: `VPS_SSH_KEY` (a deploy-only private key), `VPS_HOST`, `VPS_KNOWN_HOSTS`.

## Restoring a backup

Data file: `gunzip -c /var/backups/funintended/datafile-<stamp>.json.gz > /var/lib/funintended/data.json && systemctl restart funintended`

Supabase full dump: `gunzip -c supabase-pgdump-<stamp>.sql.gz | docker exec -i <supabase-db container> psql -U postgres -d postgres`

Supabase table only: each row in `supabase-fi_documents-<stamp>.json.gz` is `{key, data, updated_at}`; upsert them back into `fi_documents`.

Secrets (admin password, FI_SECRET, Supabase keys) live only on the server, never in this repo.
