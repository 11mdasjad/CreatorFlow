# CreatorFlow

A functional full-stack creator-business SaaS scaffold: Next.js App Router + NestJS + PostgreSQL/Prisma, with Redis/BullMQ workers, official-provider adapters, and a responsive original UI.

**This is not a production certification or a claim that the entire original product roadmap is finished.** Core local flows work and are tested. Live Meta, payments, S3, and email delivery require credentials, approvals, and provider acceptance tests. See [implementation status](docs/STATUS.md) and [deployment](docs/DEPLOYMENT.md).

## Start locally — no Docker required

Use Node 22.12+ (22 LTS recommended) and npm.

```sh
npm ci
npm run dev:local -- --demo
```

Open **http://127.0.0.1:3000**. Use this exact hostname so the session origin check matches.

The optional `--demo` flag creates **Demo Studio**, an explicitly local fixture:

- Email: `demo@creatorflow.local`
- Password: `CreatorFlow-demo-2026!`

It does not seed customer endorsements, revenue, connected accounts, or message activity. Browser tests may add records prefixed `QA`; these are local test records. Never enable the demo seed in production; the script refuses production mode.

The local command starts persistent PGlite on port 5433, applies migrations, seeds configurable plans, starts a database-backed internal-workflow runner, and starts the frontend (3000) and API (4000). Files persist in `.local/postgres`. It explicitly disables live external operations. Ctrl+C stops its child processes. PGlite is a developer convenience, **not** the production PostgreSQL topology or a concurrency/load-test substitute.

To create your own account: register, run `npm run mailbox -- --local` in another terminal, open the local verification link, sign in, and complete onboarding. The local mailbox prints development-only email contents; nothing is sent externally. The supplied `.env` for this workspace points to the local PGlite database.

## Run with PostgreSQL, Redis, and email infrastructure

```sh
cp .env.example .env
# Configure DATABASE_URL and REDIS_URL for the Compose services.
docker compose up -d postgres redis mailpit
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
# In another terminal:
npm run worker
```

Default Compose database credentials are development-only. To send test emails to Mailpit, set `EMAIL_PROVIDER=smtp` and `SMTP_URL=smtp://127.0.0.1:1025`. Its inbox is at `http://127.0.0.1:8025`. `EMAIL_PROVIDER=local` keeps messages in the database outbox.

## Applications

| Area                              | Entry point     | Access                                |
| --------------------------------- | --------------- | ------------------------------------- |
| Marketing and product information | `/`             | Public                                |
| Customer workspace                | `/app`          | Session + verified email + membership |
| Platform administration           | `/admin`        | Verified platform super admin         |
| Lead capture                      | `/f/{slug}`     | Published forms only                  |
| Storefront                        | `/store/{slug}` | Published stores/products only        |
| Student/purchase library          | `/learn`        | Verified customer and entitlement     |
| OpenAPI / Swagger                 | `/api/docs`     | Development only                      |
| Readiness                         | `/api/health`   | Database-backed health response       |

Create an admin explicitly after registering and verifying an account:

```sh
npm run admin:create -- verified-user@example.com
```

Admin and creator accounts both sign in at `/login` through `/api/auth/login`.
The server derives the account role from the database: verified platform admins
open `/admin`; creators open `/app` (or onboarding for a new workspace).
The old `/admin/login` URL redirects to `/login`. There is no role selector and
public registration cannot grant admin privileges. Admin API endpoints still
check the role on every request, separately from workspace membership checks.
The browser uses one active account at a time; use separate browser profiles to
keep both signed in simultaneously.

For local development, with `dev:local` running, `npm run admin:local` creates a
separate **Md Asjad** platform administrator at `admin@creatorflow.local`. It
does not promote or modify `demo@creatorflow.local`. The generated password and
privileged action key are saved in `.local/admin-access.json` with owner-only
permissions. Restart `dev:local` once after creating this account to load its
action key. The command refuses production/nonlocal databases, and rerunning it
does not reset an existing account. This file is private and ignored by Git.

Privileged admin mutations also require password reauthentication and an independent `ADMIN_ACTION_KEY`. This is a supplemental operator control, **not TOTP/WebAuthn MFA**. Do not give it to ordinary workspace administrators.

## Included functionality

- Argon2id passwords; hashed, expiring sessions and one-time links; email verification, reset, session revocation, CSRF and origin checks.
- Server-side owner/admin/editor/viewer authorization; workspace membership verification; tenant-scoped reads/writes; composite foreign keys for cross-tenant relations.
- CRM creation/editing, tags, status, notes, duplicate email protection, pagination, search, filtering, and formula-safe CSV exports.
- Published forms, optional marketing consent records, custom-field API support, honeypot and request limits.
- Lead magnets, resource-delivery tokens, transactional email outbox, private S3 upload/download adapters.
- Draft/edit/duplicate/pause automation rules, exact/contains matching and a labeled simulation. Official Meta OAuth and signed-webhook adapter, event deduplication, send claims, retry classification, and conservative policy gates.
- Visual workflow editor with lead/form triggers, conditions, tag/status/notification actions, bounded graph validation, immutable published versions, and transactional execution.
- Product/store management, Stripe Connect direct-charge checkout architecture, signed payment processing, idempotent entitlements and full-refund revocation.
- Ordered course modules and lessons, free/paid enrollment, entitlement checks and persisted student progress.
- Database-derived overview and lead-growth chart; separate currency totals; no fabricated activity. API acceptance is not presented as delivery/read confirmation.
- Team invitations and roles, settings, in-app notifications, support tickets, admin plan configuration, monitoring and audit records.
- Docker build stages, local and production Compose templates, ingress/IAM examples, CI, Jest/RTL/Playwright tests.

## Commands

```sh
npm run typecheck
npm test                    # Unit, RTL, API, DB/security tests
npm run build               # Prisma + API + frontend production build
npm run test:e2e             # Start local app and create demo first
npm run db:dev              # Author a new Prisma migration
npm run db:migrate          # Apply checked-in migrations
npm run db:seed             # Seed plans without overwriting admin changes
```

On macOS the Playwright config uses installed Google Chrome when present. Otherwise run `npx playwright install chromium`. Integration tests use an isolated PGlite process on 5434 unless `TEST_DATABASE_URL` points to an already-migrated test PostgreSQL database. CI uses PostgreSQL 17. Never set `TEST_DATABASE_URL` to a production database.

## Repository map

```text
apps/web/app/          Next.js pages and layouts
apps/web/components/   Dashboard, marketing, forms, workflow canvas, admin UI
apps/api/src/          NestJS controllers, guards, domain logic and adapters
apps/api/src/worker.ts Redis/BullMQ dispatcher, message sender and email outbox
prisma/               Relational schema and checked-in SQL migration
scripts/              Local setup, seed, mailbox, admin and test tooling
tests/                Playwright browser journeys
infra/                Nginx and S3 IAM/CORS examples
docs/                 Architecture, security, integrations, deployment, status
artifacts/            Browser screenshots from verification
```

Next.js 16.4.2, React 19.3.1, NestJS 12.2.0, Prisma 7.10.1 and TypeScript 5.9.3 were resolved against the package registry for this implementation. Direct dependencies and the npm lockfile are pinned. Prisma's `latest` tag pointed at a prerelease, so the stable 7.x line was selected instead. NestJS 12 is ESM; the application runs on Node's supported ESM interop, and Jest 29 uses the documented local test transformer.
