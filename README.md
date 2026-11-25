# FunIntended

Employee rewards, recognition, games, learning and mentorship platform.
One repository, three site types, five Netlify deployments.

| Site | Folder | Netlify site | `FI_CLIENT_ID` |
|---|---|---|---|
| Backend / Administration panel + central API | `apps/backend` | fibackend.netlify.app | (none) |
| Demo client: Management site | `apps/client-admin` | fidemoadmin.netlify.app | `demo` |
| Demo client: Employee site | `apps/client-employee` | fidemoemployee.netlify.app | `demo` |
| Beta client 1: Management site | `apps/client-admin` | fibetaadmin1.netlify.app | `beta1` |
| Beta client 1: Employee site | `apps/client-employee` | fiemployeebeta1.netlify.app | `beta1` |

## How it fits together

```
           ┌──────────────────────────────┐
           │  fibackend.netlify.app       │
           │  Admin panel  +  /api/*      │──► Supabase (all data)
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
  turns on the chosen modules, and prints the exact Netlify settings for its two sites. If you add the optional
  Netlify settings below, it can also create both Netlify sites for you.
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

## Deploy to Netlify

### 1. Set up Supabase (the database)

1. Create a Supabase project.
2. In the Supabase dashboard open **SQL Editor**, paste `supabase/schema.sql` and click **Run**.
3. Optional: run `supabase/seed.sql` the same way. (You can skip it: the backend creates the same starting data
   by itself the first time it runs against an empty table.)
4. From **Project Settings → API**, copy the **Project URL** and the **service_role** key. The service role key is
   secret: it goes only on the backend Netlify site, never in a client site or the browser.

### 2. Create the five Netlify sites

Netlify Functions (the API) deploy from a Git repository or the Netlify CLI, not drag-and-drop, so push this folder to
GitHub first. Then create five sites from that one repository:

1. **Backend** — New site from Git → Base directory `apps/backend`. Build command and publish folder are read from
   `apps/backend/netlify.toml`. Set environment variables:
   * `SUPABASE_URL` — your Supabase Project URL. **Required.**
   * `SUPABASE_SERVICE_ROLE_KEY` — your Supabase service_role key. **Required.**
   * `FI_SECRET` — a long random string (signs sign-in tokens). **Required.**
   * `FI_ADMIN_EMAIL`, `FI_ADMIN_PASSWORD` — your first platform admin, created on first start
     (only if you did not run seed.sql; otherwise sign in as `admin@funintended.app` / `changeme` and change it).
   * Rename the site to `fibackend`.
2. **Each client site** — New site from Git → Base directory `apps/client-admin` or `apps/client-employee`. Set:
   * `FI_API_BASE` = `https://fibackend.netlify.app/api`
   * `FI_CLIENT_ID` = `demo` or `beta1` (see table above)
   * Rename the site to match the table.

The `demo` (Acme Corp, full sample data) and `beta1` (empty, admin `admin@beta1.client` / `demo1234`) clients are
created automatically the first time the backend starts. **Change the beta admin password** from the Admin panel
before you hand it to a tester.

### Optional: one-click client sites

Set these on the backend site and the "Create on Netlify" button / checkbox will create both client sites for you:

* `NETLIFY_AUTH_TOKEN` — Netlify personal access token
* `NETLIFY_ACCOUNT_SLUG` — your Netlify team slug
* `FI_GITHUB_REPO` — e.g. `your-org/funintended`
* `FI_GITHUB_INSTALLATION_ID` — the Netlify GitHub app installation id for that repo
* `FI_GITHUB_BRANCH` — optional, default `main`

This path is written against Netlify's public API but has not been run against a live account yet.

## Project layout

```
apps/
  backend/
    api/core.mjs          the whole API: auth, platform, clients, client data
    api/seed.mjs          default modules, features, page text, catalogs, demo data
    api/store.mjs         Supabase (prod) / JSON file (local) / Netlify Blobs (fallback)
    api/netlify.mjs       optional Netlify site provisioning
    netlify/functions/api.mjs   Netlify Function entry, served at /api/*
    public/app.js         Admin panel UI
  client-admin/public/app.js     Client Management UI
  client-employee/public/app.js  Employee UI (Dashboard + 4 modules)
shared/fi.css, shared/fi.js      design system + UI helpers used by all sites
scripts/build.mjs                builds one site into apps/<site>/dist and writes config.js
scripts/dev.mjs                  local server for all three sites + API
supabase/schema.sql              the database table (run once in Supabase)
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
