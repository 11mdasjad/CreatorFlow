# Vercel services deployment

This repository's proposed `vercel.json` deploys two independently built services. Confirm their names, public routes, and the worker hosting choice before deploying.

| Name | Build root | Runtime | Public traffic |
| --- | --- | --- | --- |
| `web` | `apps/web` | Next.js | All paths through the final `/(.*)` rewrite |
| `api` | `.` | `Dockerfile.vercel` container | No direct public rewrite; called by `web` |

The only service binding is **web → api**, injected by Vercel as `CREATORFLOW_API_URL`. Do not add this variable to project settings, `.env`, build arguments, or `NEXT_PUBLIC_*` variables. The Node.js route handler `apps/web/app/api/[[...path]]/route.ts` reads it per request. It is never read in middleware or at build time.

Requests to `/api/*` enter `web` and are forwarded to the same `/api/*` path in `api`. The internal API service therefore has no direct internet route, but its application endpoints remain publicly reachable through this gateway, subject to the API's existing authentication and authorization. The binding itself is not authentication. All other paths, including `/`, `/login`, `/app`, `/admin`, and Next.js assets, are handled by Next.js. No browser API URL changes or CORS exceptions are needed.

Webhooks remain `/api/webhooks/meta` and `/api/webhooks/stripe`; the Instagram callback remains `/api/integrations/instagram/callback`. Signed request bodies, cookies, CSRF headers, status codes, and redirects pass through unchanged. Configure any provider callbacks against the final public domain and account for Vercel Deployment Protection when accepting external webhooks.

## Project settings and infrastructure

Import the repository as **one project with Root Directory `.`**. Do not select `apps/web` as the project root: the root config owns both services. The web service uses the root npm workspace lockfile and its own `npm run build`. The API Dockerfile generates Prisma and compiles only the API; it does not rebuild Next.js or run migrations.

Provision PostgreSQL and Redis separately. Compose service names and the local PGlite database are not available in Vercel. Use endpoints reachable from Vercel, with TLS and appropriate connection limits. Set production and preview credentials separately; never point previews at the production database or queue.

Configure the following in Vercel environment settings (not in committed files):

- `APP_URL`: the exact public HTTPS origin, used for CSRF checks, email links and metadata. Preview environments need their own matching origin; a different production origin causes preview mutations to be rejected.
- `DATABASE_URL` and `DATABASE_POOL_MAX`: hosted PostgreSQL and a pool size appropriate for container scaling.
- `REDIS_URL`: hosted Redis, used for rate limiting and background jobs.
- `TOKEN_ENCRYPTION_KEY`: 64 hexadecimal characters, independently generated.
- `ADMIN_ACTION_KEY`: an independently generated secret of at least 32 characters.
- `EMAIL_PROVIDER` (`ses` or `smtp`), verified `EMAIL_FROM`, and the corresponding SES or SMTP credentials when email setup is resumed.
- Optional storage, Meta and payment settings from `.env.production.example`, only for integrations you actually enable.

**Email setup remains on hold.** The existing production `checkConfig()` rejects an unset or local email provider. This change does not weaken that check, supply a sender, or start email delivery. A complete production launch is blocked until real email setup is ready. Merely declaring a provider does not make verification emails deliverable: the worker and verified provider must also be running.

The API binds `0.0.0.0` and defaults to container port `80`. If setting `PORT` in Vercel, it must be the API's ingress port; the API honors `PORT` before the local `API_PORT` fallback. Do not set `API_INTERNAL_URL` in Vercel. That variable is retained only for local/self-hosted Docker use.

Before serving production traffic, apply `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed` from a trusted checkout configured for the intended database. Migrations are an explicit release step, not something run during image builds or every container startup. Create verified admin accounts using the existing admin workflow; do not seed local demo users in production.

## Background worker: pending hosting confirmation

`apps/api/src/worker.ts` consumes BullMQ, advances workflows, sends queued email, and cleans up expired records. It must run continuously; an HTTP service that scales to zero cannot replace it. The default config intentionally does not start it while the email setup is paused. Without a worker, queued automation/workflow/email jobs will not execute.

Once the sender is ready, choose either an external always-on worker using the existing production Compose setup or a Vercel daemon. The API image also contains the compiled worker. For a Vercel daemon, add a top-level block like this **after choosing the region and approving worker activation**:

```json
"daemons": {
  "worker": {
    "root": ".",
    "entrypoint": "Dockerfile.vercel",
    "command": ["node", "apps/api/dist/worker.js"],
    "instances": { "bom1": 1 }
  }
}
```

`bom1` is only an example, not a selected deployment region. Place the worker near its database/Redis. The worker calls PostgreSQL, Redis and external providers directly, so it needs no HTTP service binding. Vercel daemons currently run only in production, not preview environments.

## Local verification

With the Vercel CLI, Docker CLI and a running Docker daemon available, run from the repository root:

```sh
vercel dev --local --listen 3100
```

Vercel injects the binding automatically. Supply local test database/Redis credentials and the application configuration expected by the production API container; do not point this test at production data. `APP_URL` must match the test origin, including scheme and port; production configuration requires HTTPS, so use a matching local HTTPS ingress for authenticated mutation tests. Never substitute production email credentials just to smoke-test locally. The ordinary `npm run dev:local -- --demo` remains the no-Docker development path and uses the runtime localhost fallback.

Check the homepage, `/api/health`, login's two cookies, an authenticated lead read/write, and provider callback handling. Run `npm run test:proxy` to verify runtime URL resolution, signed body preservation, cookies, redirects, error handling and local compatibility. Type-check with `npm run typecheck` and build Next.js with `npm run build:web`.

## References

- [Vercel Services](https://vercel.com/docs/services)
- [Service bindings](https://vercel.com/docs/services/bindings)
- [Container runtime](https://vercel.com/docs/functions/runtimes/container)
- [Daemons](https://vercel.com/docs/daemons)
