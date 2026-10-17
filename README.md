# Marzha

Unit-economics calculator for small online sellers.

Stack: Angular (standalone, signals) · Vercel Functions in `/api` · Supabase (Postgres + magic-link auth) · Vitest.

## Project layout

- `src/` — Angular app (login page + authenticated "Products" page).
- `api/` — Vercel Functions (TypeScript, Node.js runtime, Web-standard `Request`/`Response` handlers).
- `shared/calc/` — framework-free TypeScript (no Angular, no Supabase imports) shared by `src/` and `api/`. Empty for now. Import it from either side via the `@shared/calc` path alias.
- `scripts/generate-env.mjs` — writes `src/environments/environment.ts` from env vars before `ng serve`/`ng build` (local: from `.env.local`; on Vercel: from the platform's env vars).

## Local setup

Requires Node 22 (see `.nvmrc`, pinned via `engines` in `package.json`) — `@supabase/supabase-js` requires a native `WebSocket` global at client-construction time (for its Realtime module, even unused), which Node 20 doesn't provide by default. `/api/health.ts` itself avoids this by verifying the JWT with a plain `fetch` call instead of constructing a full Supabase client, but any future `/api` route that does call `createClient()` needs Node 22.

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in your Supabase project's values:
   ```
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```
   `.env.local` is gitignored — never commit it. `SUPABASE_SERVICE_ROLE_KEY` is only read server-side (in `/api`) and must never be referenced from `src/`.
3. In Supabase, enable email magic links and add `http://localhost:4200` (and your Vercel preview/production URLs) to **Authentication → URL Configuration → Redirect URLs**.

### Run the frontend only

```bash
npm start
```

Serves the Angular app at `http://localhost:4200`. This does **not** run `/api` functions — magic-link sign-in works, but calls to `/api/health` will 404.

### Run frontend + API together

Use the Vercel CLI to emulate the full deployment locally:

```bash
vercel link      # first time only, links this directory to a Vercel project
vercel dev
```

This serves the Angular app and the `/api` functions on the same local port, matching production routing.

## Testing

```bash
npm test
```

Runs the Vitest unit tests for the Angular app.

## Building

```bash
npm run build
```

Outputs the production browser bundle to `dist/marzha/browser` (configured as `outputDirectory` in `vercel.json`).

## Deploying

```bash
vercel        # preview deployment
vercel --prod # production deployment
```

In the Vercel project settings, set these environment variables (Production, Preview, and Development as needed):

| Variable | Exposed to | Notes |
|---|---|---|
| `SUPABASE_URL` | Client + server | Public project URL. |
| `SUPABASE_ANON_KEY` | Client + server | Safe to expose; access is governed by Supabase RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | **Never** import or reference this from `src/`. Only `/api` functions should read it. |

## Verifying the auth chain

1. Run `vercel dev` (or deploy a preview) and open the app.
2. On the login page, enter your email and submit. Check your inbox and click the magic link — you should land on `/products` signed in.
3. Grab your access token: open DevTools → Application → Local Storage → your app's origin, find the `sb-<project-ref>-auth-token` entry, and copy the `access_token` field from its JSON value.
4. Call the health endpoint with that token:
   ```bash
   curl -H "Authorization: Bearer <access_token>" https://<your-deployment>/api/health
   ```
   A successful response returns `{ "userId": "<your-supabase-user-id>" }`, confirming the chain: Angular → Supabase magic-link auth → `/api/health` → Supabase JWT verification.
