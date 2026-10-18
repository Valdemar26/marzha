# Marzha

Unit-economics calculator for small online sellers.

Stack: Angular (standalone, signals) · Vercel Functions in `/api` · Supabase (Postgres + magic-link auth) · Vitest.

## Project layout

- `src/` — Angular app (Angular Material, Ukrainian UI): login, product list (`/products`), product editor (`/products/:id`, `/products/new`).
- `api/` — Vercel Functions (TypeScript, Node.js runtime, Web-standard `Request`/`Response` handlers). `api/_lib/` holds shared helpers (the `_` prefix keeps Vercel from exposing them as routes).
  - `GET/POST /api/products`, `GET/PUT/DELETE /api/products/:id` — every response includes `result`, computed server-side with `calculate()`. Queries run as the calling user, so Supabase RLS enforces ownership.
- `shared/calc/` — framework-free `calculate()` (no Angular, no Supabase imports), used by both the UI (live recalculation) and `api/`. The UI imports it via the `@shared/calc` alias; `api/` uses relative imports (aliases aren't resolved at runtime on Vercel).
- `shared/api/` — request/response types for `/api/products` (types only).
- `supabase/migrations/` — database schema (`products`, `cost_lines`, RLS policies).
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
3. Apply the database migrations to your Supabase project (the Supabase CLI is a dev dependency):
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
4. In Supabase, enable email magic links and add `http://localhost:4200` (and your Vercel preview/production URLs) to **Authentication → URL Configuration → Redirect URLs**.

### Run the frontend only

```bash
npm start
```

Serves the Angular app at `http://localhost:4200`. This does **not** run `/api` functions — magic-link sign-in works, but calls to `/api/health` will 404.

### Run frontend + API together

Use the Vercel CLI to emulate the full deployment locally:

```bash
vercel link      # first time only, links this directory to a Vercel project
set -a && . ./.env.local && set +a && vercel dev
```

`vercel dev` gives `/api` functions only the Vercel project's **Development** env vars, which aren't set for this project, so the line above exports `.env.local` into its environment first. Without it, every `/api` call returns `500 Server misconfigured`. Also add `http://localhost:3000` to the Supabase redirect URLs so magic links work against `vercel dev`.

This serves the Angular app and the `/api` functions on the same local port, matching production routing.

## Testing

```bash
npm test
```

Runs all Vitest unit tests: the Angular app (`src/`) and the calculator (`shared/calc/`).

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
