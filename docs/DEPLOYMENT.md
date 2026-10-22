# Deployment preparation

Docker is not installed in the implementation environment; the Dockerfiles and Compose templates are prepared but have **not** been built or deployed here. No cloud resources were created and no site was published.

## AWS-compatible topology

- HTTPS ALB or managed ingress → Next.js web service → private NestJS API.
- Private RDS PostgreSQL with TLS verification, encrypted backups/PITR and tested restoration.
- Private Redis/ElastiCache with TLS, authentication, persistence and `noeviction` for BullMQ.
- Separate worker service with the same versioned application image and scoped IAM role.
- Private S3 bucket with explicit CORS, SSE and prefix-scoped IAM.
- SES or a transactional SMTP provider with sender verification and feedback handling.
- Secrets Manager/SSM or workload secret injection for database, Redis, provider and encryption secrets.

Use the environment template as a list of required settings, not production credentials. `TOKEN_ENCRYPTION_KEY` and `ADMIN_ACTION_KEY` must be independently generated. Keep encryption key versioning/rotation and recovery plans outside the repository; current token ciphertext does not yet include a key-version identifier.

## Build and migration

```sh
cp .env.production.example .env.production
# Fill the real environment, HTTPS hostname and secrets through secure tooling.
docker compose --env-file .env.production -f compose.production.yml build
# Run the migration target before starting the application.
docker compose --env-file .env.production -f compose.production.yml up -d
```

The build embeds `APP_URL` and the internal API rewrite destination; rebuild when these change. The migration stage retains the Prisma CLI; the runtime stage removes development dependencies and runs as a non-root user. Run plan seeding as an explicit provisioning task using the migration image, then configure plans through the admin UI. Seed does not overwrite existing plan configuration.

For AWS ECS, use the same image with distinct commands:

- API: `node apps/api/dist/main.js`
- Worker: `node apps/api/dist/worker.js`
- Web: `npm run start --workspace apps/web`

The API should not be reachable directly from the internet. `/api/health` confirms database access; the Redis worker heartbeat appears in Admin → Platform overview. Add target-group health checks, service-level error/latency alerts and dead-letter alerts. Current request logs include request ID, method, status and duration, excluding request bodies, query strings and authentication material.

`infra/nginx.conf` is an optional single-host HTTPS ingress example. Supply real certificates. Do not run development servers behind a public proxy. Configure and test trusted proxy/IP extraction for your exact ingress chain before scaling rate limits; the current conservative default sees the Next.js proxy address and can group clients together. Never trust arbitrary forwarded headers on a publicly reachable API.

## Release acceptance

1. Run type checks, all Jest/RTL/integration tests, production build and Playwright journeys against real PostgreSQL/Redis in staging.
2. Run authorized Meta and payment sandbox acceptance tests with the intended merchant geography. Confirm unavailable services fail visibly without granting access or recording external success.
3. Exercise webhook replay, timeout, authorization revocation, expired tokens, queue restart, duplicate requests, refund and subscription lifecycle scenarios.
4. Verify provider signatures and destination secrets on externally delivered webhooks through HTTPS ingress.
5. Verify backup restoration, private-object access, retention/deletion, user data exports and incident response.
6. Complete the remaining security, legal, accessibility, privacy, billing reconciliation and MFA work in `STATUS.md`.
7. Set only the approved integration enablement flags. Promote the reviewed artifact, apply migrations, observe readiness, then route traffic.

CI is included but has not run on GitHub in this session. It provisions PostgreSQL 17 and Redis, tests the source, builds both applications and runs browser journeys. Worker fault/load tests remain separate acceptance work. Pin reviewed container digests and GitHub Action SHAs according to your deployment policy before production.

## Operations and retention

The worker deletes expired sessions/auth/OAuth-state tokens and removes sent-email outbox contents after 30 days. Other business records are retained until an authorized deletion. This is not a complete regulatory retention policy: set and implement a reviewed retention schedule for leads, consent, analytics, financial records, audit logs and backups before launch.

Failed BullMQ jobs remain available for inspection. Never manually requeue a `SENDING`, `UNKNOWN` or accepted Instagram execution without reconciling provider state; the provider operation has no general application idempotency key. A successful database transaction cannot prove a provider call did or did not occur during a network failure.
