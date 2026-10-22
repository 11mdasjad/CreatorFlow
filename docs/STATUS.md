# Implementation status and acceptance boundaries

This repository delivers a substantial working scaffold, not every feature of the original enterprise product vision. Unimplemented features are not represented by fake success states.

## Verified in this environment

- Production frontend build and API TypeScript compilation.
- Checked-in PostgreSQL migration applied successfully to persistent local PGlite.
- Configurable plan seed without customer, pricing, or revenue fabrication.
- Unit tests for keyword matching, time windows, signatures, authenticated encryption, CSV injection protection and workflow validation.
- API integration tests for registration/verification, CSRF, tenant isolation, viewer restrictions, composite foreign keys, CRM persistence/duplicates/notes, form consent/spam protection, webhook deduplication, simulations, versioning, paid-access denial, empty analytics and reset-token replay/session revocation.
- Browser tests for marketing desktop/mobile, login, persisted CRM edits, draft automation simulation, workflow save/publish, unconfigured integration feedback, and mobile navigation without horizontal overflow.
- React Testing Library checks for truthful empty states, metric labels and accessible errors.
- `npm audit --omit=dev` reported no known vulnerabilities during verification. This is not a security audit guarantee.

See `docs/VERIFICATION.md` for the final executed checks and counts.

## Implemented adapters that still need provider acceptance tests

| Integration  | Implemented                                                                                                                                                                               | Still required                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Instagram    | OAuth state binding, exchange/encryption, connection status, comments webhook validation/deduplication, private-reply adapter and conservative queue                                      | Current Meta contract verification, app review, permissions, authorized test account and real webhook/reply tests    |
| Stripe       | Connect onboarding/direct charges, merchant readiness, signed webhook processing, mode/account/amount validation, idempotent grants, full-refund revocation, subscription checkout/portal | Merchant eligibility, approved countries, keys, separate endpoint secrets/configuration, sandbox and live acceptance |
| S3           | Private object keys, allowlisted MIME/size, presigned PUT, HEAD completion check, short-lived authorized GET, deletion                                                                    | Bucket/IAM/CORS setup, actual upload/download tests, malware-scanning pipeline and video distribution strategy       |
| Email        | Durable outbox, local mailbox, SMTP/SES transports, retries, failure/unknown states                                                                                                       | Sender verification, provider sandbox removal, bounce/complaint suppression, delivery testing                        |
| Redis/BullMQ | Durable event dispatch, deduplicated queue jobs, backoff, failed-job retention and heartbeat                                                                                              | Actual Redis deployment and worker/load/fault-injection acceptance tests                                             |

No real Instagram messages, payments, S3 uploads, or outbound emails were performed in this environment.

## Explicit remaining product work

- Full MFA enrollment/challenge/recovery and optional Google OAuth. Privileged admin reauthentication + an operator key are implemented; they are not a substitute for MFA.
- Automated Instagram token refresh, richer permission diagnostics/account discovery, Live/story triggers, supported message buttons, fallback rules, campaign attribution and provider delivery-event correlation.
- Workflow delays, purchase triggers, external emails, approved outbound webhooks, resource-delivery actions and eligible Instagram actions on the visual canvas. The canvas exposes only the implemented node types.
- A UI for arbitrary custom form fields (validated custom fields are supported by the API), form design customization, lead sorting controls and full activity attribution.
- Coaching/session booking, webinars, workshops, variants, discount/tax workflows, custom domains, product imagery/theme editor and a more complete order-management UI.
- Hosted video transcoding/streaming, course thumbnails, lesson reordering UI and student analytics. Ordered text lessons and external HTTPS video resources are implemented.
- Razorpay provider implementation. Stripe is the selected provider path; no jurisdiction or merchant eligibility is assumed. Do not enable payments in an unsupported market.
- Invoice synchronization, proration/entitlement change rules beyond provider portal handling, webhook reconciliation for disputes/chargebacks and robust partial-refund net-revenue reporting. Current revenue is **gross paid orders**, with fully refunded orders excluded.
- Broad analytics attribution, all requested chart/filter dimensions, billing MRR normalization, long-range exports, storage quotas and every feature entitlement dimension.
- Per-member notification read state (currently workspace-shared), optional workspace notification email fan-out, bounce/complaint handling and marketing unsubscribe workflows. No marketing campaigns are sent.
- Complete account/workspace data-export coverage, administrative retention/deletion jobs, immutable external audit retention, support email contacts and approved final legal documents.
- Formal security review, full accessibility audit, real PostgreSQL concurrency/load tests, backup restoration drills, monitoring alerts and a deployed HTTPS environment.

Admin “featureFlags” are a simple server-side workspace route kill switch, not a complete pricing/entitlements engine. Supported route/resource keys include `leads`, `forms`, `magnets`, `products`, `courses`, `automations`, `workflows`, `files`, and `integrations`. Avoid disabling settings/team routes needed for recovery. Keys other than the documented routes are stored but do not enable new product features.

The generic resource UI intentionally exposes the validated implemented fields. A production product should separate growing modules into smaller controllers/services and more task-specific editors as functionality expands.
