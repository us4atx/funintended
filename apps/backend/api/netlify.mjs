// Optional: create a client's two Netlify sites straight from the admin panel.
// Needs these environment variables on the backend site:
//   NETLIFY_AUTH_TOKEN       personal access token (Netlify > User settings > Applications)
//   NETLIFY_ACCOUNT_SLUG     your Netlify team slug
//   FI_GITHUB_REPO           e.g. "your-org/funintended"
//   FI_GITHUB_INSTALLATION_ID  the Netlify GitHub app installation id for that repo
//   FI_GITHUB_BRANCH         optional, defaults to "main"
// Without them, provisioning still creates the client and returns the manual deploy steps.
const API = 'https://api.netlify.com/api/v1';

export function netlifyConfigured() {
  return Boolean(process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_ACCOUNT_SLUG && process.env.FI_GITHUB_REPO && process.env.FI_GITHUB_INSTALLATION_ID);
}

async function call(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}`, 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Netlify ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function createSite(name, base, clientId) {
  const account = process.env.NETLIFY_ACCOUNT_SLUG;
  const site = await call(`/${account}/sites`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      repo: {
        provider: 'github',
        repo: process.env.FI_GITHUB_REPO,
        branch: process.env.FI_GITHUB_BRANCH || 'main',
        installation_id: Number(process.env.FI_GITHUB_INSTALLATION_ID),
        base,
        cmd: 'npm run build',
        dir: 'dist',
      },
    }),
  });
  const apiBase = `${process.env.URL || 'https://fibackend.netlify.app'}/api`;
  await call(`/accounts/${account}/env?site_id=${site.id}`, {
    method: 'POST',
    body: JSON.stringify([
      { key: 'FI_API_BASE', scopes: ['builds'], values: [{ value: apiBase, context: 'all' }] },
      { key: 'FI_CLIENT_ID', scopes: ['builds'], values: [{ value: clientId, context: 'all' }] },
    ]),
  });
  await call(`/sites/${site.id}/builds`, { method: 'POST' }).catch(() => null);
  return site.ssl_url || site.url;
}

export async function provisionNetlifySites(client) {
  if (!netlifyConfigured()) {
    return { manual: true, message: 'Netlify auto-provisioning is not configured. Create the two sites by hand using the deploy settings shown.' };
  }
  const adminName = `fi-${client.id}-admin`;
  const employeeName = `fi-${client.id}-employee`;
  const adminUrl = await createSite(adminName, 'apps/client-admin', client.id);
  const employeeUrl = await createSite(employeeName, 'apps/client-employee', client.id);
  return { sites: { adminUrl, employeeUrl } };
}
