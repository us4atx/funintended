# FunIntended

Employee rewards, recognition, games, learning and mentorship platform.
One repository, three site types, all hosted on our own VPS (Ubuntu, 162.35.50.245) under us4atx.com.

| Site | Folder | Address | Client ID |
|---|---|---|---|
| Backend / Administration panel + central API | `apps/backend` | us4-app-funbackend.us4atx.com | (none) |
| Demo client: Management site | `apps/client-admin` | us4-site-fun-demo1m.us4atx.com | `demo` |
| Demo client: Employee site | `apps/client-employee` | us4-site-fun-demo1e.us4atx.com | `demo` |
| Beta client 1: Management site | `apps/client-admin` | us4-site-fun-beta1m.us4atx.com | `beta1` |
| Beta client 1: Employee site | `apps/client-employee` | us4-site-fun-beta1e.us4atx.com | `beta1` |
| Any new client | `apps/client-admin` / `apps/client-employee` | us4-site-fun-&lt;id&gt;m / &lt;id&gt;e.us4atx.com | `<id>` |

## How it fits together

```
           ┌──────────────────────────────┐
           │  us4-app-funbackend.us4atx.com│
           │  Admin panel  +  /api/*      │──► self-hosted Supabase (all data)
           └──────────────▲───────────────┘
                          │ HTTPS (token auth)
     ┌────────────────────┼─────────────────────┐
 Client Management sites            Client Employee sites
 (owners, admins, managers)         (Dashboard, Fun Rewards, Fun & Games,
                                     The Fun Train, FunFluence)
```

* **Everything is managed centrally.** All clients, users, features, page text and catalogs live in the backend's
  data store. Client sites hold no data of their own; they read their `FI_CLIENT_ID` and call the backend API.
* **Provisioning a client** (Admin panel → Clients → New Client) creates the client record, its first admin user,
  turns on the chosen modules, and sets up its two sites on the VPS automatically (see "Hosting" below).
* **Feature switches** (per client) live in the Admin panel → Clients → *client* → Features. Turning a module off hides
  it on both of that client's sites.
* **Page content**: default headings and button labels for every employee page are edited in Admin panel → Page Content.
  Each client can override them (Admin panel client page, or the client's own Settings page).
* **Catalogs**: games, trainings and rewards are defined once in the Admin panel. Each client can hide items and add
  their own from their Management site.

## Roles

| Role | Signs in to | Can do |
|---|---|---|
| Platform admin | Backend | Everything: clients, features, content, catalogs, users, admins |
| Client admin | Management + Employee | Their company's employees, settings, catalog choices, orders, training, mentorship |
| Manager | Management + Employee | Same as client admin except employees and settings |
| Employee | Employee | Recognize, post, redeem rewards, play games, take training, mentorship |

## Run it locally

Requires Node 18+.

```bash
npm run dev
```

* Admin panel: http://localhost:8801 — `admin@funintended.app` / `changeme`
* Management site: http://localhost:8802 — `admin@acme.demo` / `demo1234` (manager: `david@acme.demo`)
* Employee site: http://localhost:8803 — `sarah@acme.demo` / `demo1234`

Add `?client=beta1` (or any client id) to switch which client a local site points at.
Local data is saved in `.dev-data.json`; delete it to start fresh.

## Hosting (our VPS)

Everything runs on one Ubuntu VPS (162.35.50.245, tracked in US4 Site Admin → Infrastructure):

* **OpenPanel's Caddy** owns ports 80/443, terminates HTTPS (Let's Encrypt) and proxies to FunIntended.
* **FunIntended** is one Node process (`vps/server.mjs`, systemd unit `funintended`, 127.0.0.1:8800) that serves the
  API and every site, routing by hostname. Code lives in `/opt/funintended`, settings in `/etc/funintended.env`
  (never overwritten by a deploy).
* **Data** is in the self-hosted Supabase on the same server (table `fi_documents`, schema in `supabase/schema.sql`).

### New clients get hosting automatically

1. Admin panel → Clients → New Client. The client gets `https://us4-site-fun-<id>m.us4atx.com` (Management) and
   `https://us4-site-fun-<id>e.us4atx.com` (Employee). The FunIntended server serves them as soon as the client exists.
2. The backend drops a request into `/var/lib/funintended/provision/requests/`. The **provisioning agent**
   (`vps/provisioner/`, runs as root via systemd) checks DNS points at the VPS, writes a Caddy site block to
   `/etc/openpanel/caddy/domains/zz-fi-client-<id>.conf`, validates and reloads Caddy (rolling back if Caddy refuses),
   checks HTTPS, and writes the result to `/var/lib/funintended/provision/status/`. The client page shows that status.
3. Deleting a client removes its Caddy block the same way.

The agent only ever manages `us4-site-fun-*.us4atx.com` hostnames and its own `zz-fi-client-*.conf` files; it never
touches `/etc/funintended.env`, OpenPanel's own files, or the original sites' config.

**DNS:** add one wildcard record `*.us4atx.com  A  162.35.50.245` so every new client's address resolves without a
manual step. (Records that already exist for other names keep working; a wildcard only answers for names that have no
record of their own.) Without it the client shows "Waiting for DNS" until the two A records are added.

**One-time install of the agent** (on the VPS, as root): `sh vps/provisioner/install.sh`. Optional backend settings
(defaults match the live server): `FI_HOSTING_DOMAIN`, `FI_SITE_PREFIX`, `FI_BACKEND_HOST`, `FI_VPS_IP`, `FI_PROVISION_DIR`.

## Versions and rollout

* The version lives in `apps/backend/api/version.mjs` (with a line in `CHANGELOG.md`). Bump it with every change to
  the client sites.
* When the VPS starts a deploy with a new version, `vps/server.mjs` stores a copy of the Management and Employee
  sites in `/var/lib/funintended/releases/<version>/`. Older releases stay there.
* Every client site is pinned to a release, and a new deploy does not change any site by itself. New clients start
  on the latest release.
* **Admin panel → Releases** shows each site's release. "Roll out" plans the update (demo clients first, then beta,
  then everyone else; Management before Employee). "Update next site" switches one site at a time and checks it is
  serving the new version. If the check fails, that site goes back to its old release and the rollout pauses.
  You can also step through every remaining site with a short pause between each, pause or cancel, or put any one
  site on any release (rollback).
* The backend panel and the API always run the newest code, so API changes must keep working for releases that are
  still in use.

## Project layout

```
apps/
  backend/
    api/core.mjs          the whole API: auth, platform, clients, client data
    api/seed.mjs          default modules, features, page text, catalogs, demo data
    api/store.mjs         Supabase (VPS) / JSON file (local)
    api/hosting.mjs       client site addresses + hosting requests to the VPS provisioning agent
    api/releases.mjs      versioned client-site releases (stored per version on the VPS)
    api/version.mjs       the current version number
    public/app.js         Admin panel UI
  client-admin/public/app.js     Client Management UI
  client-employee/public/app.js  Employee UI (Dashboard + 4 modules)
shared/fi.css, shared/fi.js      design system + UI helpers used by all sites
scripts/build.mjs                builds one site into apps/<site>/dist and writes config.js (used by dev)
scripts/dev.mjs                  local server for all three sites + API
vps/server.mjs                   the production server on the VPS (API + all sites)
vps/make-sites.sh                builds the original five sites' folders
vps/provisioner/                 hosting agent for new clients (+ systemd units, install.sh)
supabase/schema.sql              the database table
supabase/seed.sql                optional starting data
```

No framework and no front-end build step: plain HTML, CSS and JavaScript modules, so any page is easy to change.

## What's a placeholder (the "bones")

* **Logos and artwork** are simple SVG/emoji stand-ins. Drop in real logos via the Logo URL field, and set an Image URL
  on any game, training or reward.
* **Games** are three small mini-games (trivia, word scramble, memory). Each catalog item has a `type` so real games
  can be plugged in.
* **Training content** advances progress by lessons; attach real content with each training's Content URL.
* **GIFs** use a placeholder graphic (a GIPHY/Tenor picker is a natural next step).
* **Join Session** shows a placeholder where a Zoom/Teams/Meet link goes.
* **Monthly recognition allowance** is stored but not enforced yet.
* **Email** (invites, password resets, notifications) is not wired up; new users get a password to share by hand.
* **Data model** keeps one JSON document per client in a single Supabase table. That keeps the bones simple and is
  fine for demo and beta clients. Before large clients or heavy concurrent use, split it into proper tables
  (users, posts, orders, assignments...) so two people saving at once can't overwrite each other.
