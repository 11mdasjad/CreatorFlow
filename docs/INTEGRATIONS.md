# Integration configuration and verification

## Meta Instagram Login

Required configuration: `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, `META_REDIRECT_URI`, `META_WEBHOOK_VERIFY_TOKEN`, and a 32-byte hex `TOKEN_ENCRYPTION_KEY`. The app callback is `/api/integrations/instagram/callback`. The webhook endpoint is `/api/webhooks/meta` (GET challenge, POST events).

Only eligible professional accounts and official APIs are used. The OAuth request uses `instagram_business_basic`, `instagram_business_manage_comments`, and `instagram_business_manage_messages`. Tokens remain encrypted on the backend. OAuth state is one-use, short-lived, session-bound and workspace-role checked again at callback. The account's global external ID cannot be moved into another workspace by a new OAuth callback.

Live activation additionally requires:

1. App permissions, business verification and review appropriate to your approved flow.
2. `META_APPROVED=true` **and** `META_PRIVATE_REPLY_POLICY_VERIFIED=true` after an operator verifies the current official contract.
3. A connected, nonexpired account, verified comment permission and subscribed comments webhook.
4. A specific eligible post/reel ID.
5. A valid comment-creation timestamp from the provider at execution time. Missing/unsupported timestamp reads fail closed; receipt time is not substituted.

The private-reply adapter uses `POST /{ig_user_id}/messages` with `{recipient:{comment_id}, message:{text}}`, a conservative 1,000-character text-only limit, one execution per comment, and a seven-day upper-bound check. No Live, story, follower-verification or unsolicited follow-up features are exposed. All uncertain send outcomes stop for operator investigation.

**Research limit:** Meta's private-reply/OAuth reference pages returned login/429 restrictions during implementation. Current scopes and the Instagram Login host were verified from Meta's official Postman collection; the complete private-reply/timestamp contract was not freshly verified from accessible primary documentation. The deployment must leave both live flags false until that verification and authorized-account acceptance tests pass. A provider may reject stricter eligibility conditions even inside this local time check.

Sources:

- [Meta official Instagram API with Instagram Login collection](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login)
- [Meta private replies](https://developers.facebook.com/docs/instagram-platform/private-replies)
- [Meta Business Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login)
- [Instagram webhook reference](https://developers.facebook.com/docs/graph-api/webhooks/reference/instagram)

## Stripe

Required: an eligible operating business, approved Stripe/Connect capabilities for the actual operating and customer jurisdictions, `STRIPE_SECRET_KEY`, `MERCHANT_COUNTRY`, explicit `PAYMENTS_ENABLED` / `BILLING_ENABLED` flags, and mode configuration (`STRIPE_LIVE_MODE=false` for sandbox).

For creator merchants, set `STRIPE_CONNECT_COUNTRIES` to a comma-separated allowlist of countries your platform has verified it can support. The store owner enters their merchant country under Store → Set up storefront payments. A server-created Express connected account is bound to the workspace, and the browser follows a short-lived Stripe Account Link. Provider onboarding, charge readiness and payout readiness are checked separately; returning from onboarding never grants readiness.

Configure **two webhook destinations**, not one shared signing secret:

| Destination                    | Scope                                  | Secret                          | Events                                                                                      |
| ------------------------------ | -------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| `/api/webhooks/stripe`         | Your account / platform                | `STRIPE_WEBHOOK_SECRET`         | `customer.subscription.created`, `.updated`, `.deleted`                                     |
| `/api/webhooks/stripe/connect` | Connected accounts, v1 snapshot events | `STRIPE_CONNECT_WEBHOOK_SECRET` | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded` |

The handlers verify exact raw body bytes, endpoint signatures, test/live mode and destination/account scope. Payment grants require the saved checkout ID, matching connected account, paid status, currency and amount. Event IDs and entitlements have uniqueness constraints. Full refunds revoke entitlements. Signature tests use local fixtures, never live charges.

Create immutable Stripe Price objects and save their IDs in Admin → Plans. Configure the Stripe billing portal for supported upgrades, cancellations and invoices. Existing prices should remain auditable; do not change historical product amounts to imitate a refund. Final commercial prices, tax handling, marketplace terms and the supported settlement model are operator decisions.

Reconciliation for missing/out-of-order payment events, disputes/chargebacks, partial-refund net revenue, subscription metadata/price integrity and compliance acceptance are still launch work. Missing verified payment events never unlock content. A webhook arriving before the checkout ID is committed receives an error and must be retried by Stripe.

Sources: [Connect webhooks](https://docs.stripe.com/connect/webhooks), [webhook signatures](https://docs.stripe.com/webhooks), [Account Links](https://docs.stripe.com/api/account_links/create), [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create).

## Razorpay

No Razorpay checkout is implemented or exposed. Stripe is the selected `and/or` integration path. Do not turn an unavailable Indian merchant workflow into a simulated success. A future adapter must verify use-case eligibility, subscriptions/settlement support, exact raw-body HMAC-SHA256 signatures, event-ID deduplication and account/amount/currency matching. [Official webhook verification guidance](https://razorpay.com/docs/webhooks/validate-test/).

## S3

Set `AWS_REGION` and `S3_BUCKET`. Prefer an IAM workload role; do not place AWS keys in the frontend. `infra/s3-policy.json` and `infra/s3-cors.json` are templates: replace the bucket and frontend origin. Enable S3 Block Public Access, server-side encryption and suitable lifecycle policies. Scope IAM to the exact private object prefix. Upload keys are server-generated, names sanitized on download, and MIME/size declarations are validated. A HEAD request verifies upload metadata before a file becomes ready.

Files are served as attachments with short-lived signed URLs. Do not put paid files on a public CDN origin. Add content scanning/quarantine before accepting untrusted production files; MIME/size checking alone is not malware scanning. Add video streaming/transcoding separately; current lessons use HTTPS resource links.

## Email

`EMAIL_PROVIDER=local` leaves a durable outbox and sends nothing. `smtp` uses `SMTP_URL`; `ses` uses SESv2 and the AWS workload role. Configure `EMAIL_FROM` with a verified sender. The worker records sent, failed and unknown outcomes. Provider acceptance is not evidence of mailbox delivery. Install and verify bounce/complaint/suppression processing before production. Optional marketing consent is stored separately; no marketing campaign engine is implemented.
