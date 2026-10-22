# Executed verification

The following checks were run locally against this repository. These results establish the tested behavior; they do not certify the entire product roadmap or production deployment.

| Check                         | Result                                     | Scope                                                                     |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `npm run typecheck`           | Passed                                     | API and frontend TypeScript                                               |
| `npm test -- --silent`        | 29 tests passed                            | 9 domain tests, 3 React tests, 17 API/database tests                      |
| `npm run test:e2e`            | 4 browser journeys passed                  | Installed Chrome through Playwright; desktop and 390px mobile             |
| `npm run build`               | Passed                                     | Prisma generation, NestJS compilation, optimized Next.js production build |
| `npm run db:migrate`          | Passed                                     | Checked-in initial migration on local persistent PGlite                   |
| `npm run dev:local -- --demo` | Started successfully                       | Local database, migrations, seed, internal workflow runner, API and web   |
| `npm audit --omit=dev`        | 0 known production-package vulnerabilities | Registry advisory snapshot during implementation                          |

## Covered behavior

- Password authentication, verification/reset one-time token handling and session revocation.
- CSRF/origin enforcement, workspace membership and viewer permissions, cross-tenant reads/writes/deletes/exports, and database foreign-key isolation.
- CRM persistence, duplicate prevention, notes, published form submission, consent records and spam checks.
- Signed Meta webhook deduplication, labeled automation simulation and policy-window checks.
- Immutable workflow publication, graph validation, actual transactional action execution and replay protection.
- Signed Stripe fixture events, amount/account mismatch rejection, idempotent entitlement grants, full-refund revocation and paid-content access denial. These are local cryptographically signed fixtures, not provider sandbox transactions.
- Database analytics and truthful empty states.
- Browser login, CRM create/edit/reload, automation simulation, workflow publication, public form capture, core workspace pages, unconfigured-integration feedback and rejection of ordinary users at platform administration.
- Mobile navigation, horizontal-overflow checks and light/dark theme screenshots.
- Redesigned product-card creation, editing, detail viewing and deletion; the passing catalog check removes its own draft fixture.
- Visual review of 11 redesigned desktop/mobile views, including the homepage, registration, dashboard, CRM, automations, settings and connections. No page errors or horizontal overflow were found.

## Visual artifacts

Screenshots are in `artifacts/`: marketing desktop/mobile, dashboard desktop/mobile/dark, and workflow desktop. They contain explicitly local demo and `QA` records created by the tests. Mobile menu screenshots wait for the menu to close; screenshots disable transient animations.

## Not exercised here

- Docker/Compose image execution or a deployed HTTPS server; Docker was unavailable.
- Real PostgreSQL concurrency, locking under contention, capacity, backup restoration, or failover. Local integration tests use isolated PGlite; the CI configuration targets PostgreSQL 17 but has not been executed remotely.
- The production Redis/BullMQ worker topology, retry/fault injection and distributed rate limits. The local runner executes internal database workflows only.
- Live Meta app review/OAuth/private replies, Stripe sandbox/live payment acceptance, private S3 transfers or outbound SMTP/SES delivery.
- A comprehensive accessibility audit, penetration test, or full security review.

See [implementation status](STATUS.md) for remaining product features and [deployment](DEPLOYMENT.md) for environment and provider setup.

## Public website refresh

The public homepage was rebuilt with a centered blue hero, the project’s existing generated creator portrait, a dark feature section, interactive product tabs, workflow/integration illustrations, FAQ, and closing CTA. The exact requested tagline is retained. Header destinations are Home, AutoDM, Pricing, and Learn; Learn opens project-specific guides. Actual configured plan data remains the pricing source.

`npm run typecheck` and `npm run build` passed after this refresh. The marketing Playwright regression passed. A separate browser review verified all four header destinations on desktop/mobile, product tab selection, FAQ expansion, guide dialogs, and opening/closing the mobile navigation without page errors or horizontal overflow. Screenshots are in `artifacts/marketing/`.

## Pricing and personal call page — 23 October 2026

- Published the requested INR catalog: Starter Free, Creator ₹99/month, Pro ₹121/month, Custom by discussion. `scripts/plan-catalog.ts` is the initial catalog; the public page continues to read published database plans. `scripts/publish-pricing.ts` applies this catalog explicitly; normal seeds preserve subsequent administrator edits. Legacy placeholder plans are unpublished without deleting existing subscriptions.
- New workspaces use the published zero-price Starter plan with ACTIVE status and no trial expiry. The original trial fallback remains for older deployments. Existing subscriptions were not reassigned.
- Four responsive pricing cards, a recommended Creator tier, explicit quotas, and six included-toolkit groups. No unsupported unlimited messaging, scheduling, AI replies, dedicated managers, reviews, or partnerships are advertised.
- Custom links to `/book-call`, featuring Md Asjad and the supplied, unaltered office portrait. The page clearly displays no open slots. It does not create bookings or invent availability; a scheduling service/availability must be added before appointments can be accepted.
- Paid subscription checkout remains gated by the configured billing provider and Stripe price IDs; publishing prices does not enable external charging.
- All 30 Jest tests pass, including an API/database regression check for non-expiring free onboarding and lead creation. Production build passed. Browser checks cover four tiers, exact prices, call/back links, portrait loading, and overflow at 1440, 820 and 390 pixels. Screenshots are in `artifacts/pricing/`.

### Shared login with separate permissions (2026-10-23)

- Both administrator and creator accounts use `/login` and `/api/auth/login`. The server returns the destination based on the stored account role; client-supplied role/portal claims are rejected. The former `/admin/login` page redirects to `/login`.
- Verified platform admins go to `/admin`; creators go to `/app`, with existing onboarding for new workspaces. Creator visits to admin UI return to their workspace. Admin API endpoints continue checking verified super-admin authorization on every request, independently of workspace membership.
- Signing in clears cached queries and workspace selection. Logout revokes the session and returns both account types to `/login`.
- The existing Md Asjad local admin and demo creator accounts and passwords are unchanged. Local admin credentials and the independent action key remain in `.local/admin-access.json`; privileged changes still require the key and password reauthentication.
- Validation: 32 Jest/API/DB/UI tests and the full production build passed. Tests cover database-derived roles, rejected login and registration role injection, unverified admin rejection, admin API denial for creators, membership checks, role revocation and logout.
- Browser validation passed for the shared page at 1440/390/320 px, legacy-link redirect, creator-to-admin denial, all admin sections, logout, and creator → admin → creator switching in one browser without stale account data.
- One active account per browser profile. External providers and production deployment were not enabled or exercised.
