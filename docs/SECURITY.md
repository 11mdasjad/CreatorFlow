# Security model and review notes

Reviewed against the [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/) at an implementation-design level. This is not an independent penetration test.

## Implemented controls

- Argon2id password hashing; bounded password input; generic login/reset messages.
- High-entropy session and CSRF values, session token hashes, expiry and revocation.
- HTTP-only session cookies, SameSite=Lax and Secure cookies in production; exact-origin and session-bound CSRF header checks for authenticated mutations.
- Server authorization for every workspace read/write; owner/admin rules on privileged tenant actions; verified super-admin checks on platform routes.
- Composite tenant foreign keys and row locks for quota-sensitive mutations. SQL values in raw aggregate queries are bound parameters; no input is interpolated into SQL identifiers.
- React text rendering; no untrusted HTML rendering. HTTPS-only user resource URLs and output attachment disposition for stored downloads.
- AES-256-GCM encrypted OAuth token storage; no social tokens or session secrets in browser localStorage.
- Raw-body HMAC/Stripe signature checks, event deduplication and amount/currency/merchant matching.
- Conservative provider eligibility gates, no blind retry after ambiguous external sends.
- MIME/size allowlists, private storage keys, HEAD completion checks, owner/entitlement-gated signed downloads.
- Rate limiting with Redis in production; failure to reach the limiter fails closed. Local development uses an in-process fallback.
- Helmet/Next security headers, no sensitive request-body/query logging, audit actions and guarded production configuration.
- Workspace/account export and deletion endpoints; full-refund entitlement revocation.

## Known limitations that block an unqualified production-ready claim

- Full end-user MFA and privileged MFA are not implemented. The admin operator key plus password are only supplemental controls. Planned MFA: store encrypted TOTP secrets or WebAuthn credentials, issue a short-lived pre-auth challenge session, enforce second-factor completion before the ordinary session, hash recovery codes and audit recovery/reset flows.
- No Google OAuth; add OIDC state/nonce/PKCE with explicit account linking and verified-email rules before exposing a button.
- CSP currently permits inline scripts for Next.js; production hardening should use request-scoped nonces and remove unsafe-inline. HTTPS/HSTS are supplied by ingress, which is not deployed here.
- No malware scanning, video-processing pipeline, external immutable audit sink, security alert provider, comprehensive retention job or complete privacy export of every record type.
- No database RLS. Cross-tenant protection relies on scoped API access and relational constraints; run regression and concurrency tests for every added endpoint.
- No full bounce/complaint suppression or unsubscribe engine. Only transactional messages are implemented; marketing consent is recorded but no marketing messages are sent.
- Rate-limit proxy attribution, per-account quotas under real concurrency, event retention and worker restart behavior require staging validation.
- PostgreSQL and Redis backup/restore, secret rotation, incident runbooks, payment dispute/chargeback reconciliation and independent security/accessibility reviews remain operator work.

Never commit `.env`, access tokens, private keys, local database files, provider payload dumps or production credentials. The demo fixture is intentionally public test material and is prohibited by its script in production.
