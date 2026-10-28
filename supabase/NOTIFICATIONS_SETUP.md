# AJD's Wireless Repairs — admin notification foundation

## What is active

The Supabase project **vxpufrahrnwmtgltjstd** contains the applied migration named **ajd_admin_notifications_foundation**. It creates:
- `ajd_notification_preferences` — owner-only administrator channel, destination, and event preferences.
- `ajd_notification_events` — generic notification metadata (no customer email, phone, or full message body).
- `ajd_notification_deliveries` — one admin-specific inbox entry per event, including read state.
- `ajd_notification_push_subscriptions` — per-admin browser subscriptions, accessible to their owner only.
- `ajd_customer_messages` — private placeholder for a future customer conversation endpoint, not public writable.
- `ajd_private.emit_notification()` and `ajd_private.track_notification_changes()` trigger functions.

The triggers record:
- New repair requests from `repair_requests`, and new admin repair check-ins in `repairs`.
- New storefront order requests in `store_purchase_requests`, plus legacy `purchase_requests`.
- Changes to a repair's `payment_status`, `deposit_amount`, or `payment_info`.
- Changes to an actual repair ticket's `status`.
- Future new rows in `ajd_customer_messages`.

**No external SMS, email, or push delivery is enabled.** Database writes only create private inbox records. This deliberately avoids unexpected fees, fake success indicators, or customer notifications without consent.

## Admin UI

Open `/settings#notifications` after signing in with an approved AJD admin account. The page supports:
- Separate SMS, email, and app push preferences.
- Destination address/phone (phone must be E.164 format like `+13055550100`).
- Five independent event switches.
- Private notification history, unread count, and mark-as-read.
- Push registration/removal when VAPID keys are present.
- A status check against the authenticated `ajd-notification-config` Edge Function.

AJD's existing `ajd_is_admin()` role check is used by the UI and new RLS policies; no service-role key is placed in browser code. Event bodies are deliberately generic, protecting customer details in notifications and on lock screens. The push display in `sw.js` uses a privacy-safe generic message.

## Provider activation (future stage)

1. **Email:** Verify a sending domain with Resend. Store `AJD_RESEND_API_KEY` and `AJD_NOTIFICATION_FROM_EMAIL` as Supabase Edge Function secrets. Implement authenticated, idempotent server-side dispatch (including retries/logging) before switching `sending_active` on.
2. **App push:** Generate a Web Push VAPID keypair, and store `AJD_WEB_PUSH_PUBLIC_KEY` and `AJD_WEB_PUSH_PRIVATE_KEY` as Supabase secrets. Admins can then register browsers. Build the server dispatch worker; subscribing alone is not enough to deliver push messages.
3. **SMS:** Configure a provider, approved messaging registration, per-admin opt-in, retry limits, suppression rules, STOP/unsubscribe handling for any future customer SMS, and a spend cap. Do not enable SMS on the existing read-only config function until fully configured and approved.
4. **Dispatcher:** Add a trusted server-side, authenticated job processor (e.g. Supabase scheduled worker) that reads pending admin events, evaluates preferences, and sends through configured providers. Use a durable outbox with idempotency keys, atomic claims, retry/backoff, and delivery receipts. Do not accept arbitrary browser-supplied recipients or service secrets.
5. **Customer messages:** Only after a secure public customer-message submission endpoint with spam protection and consent controls is added should it insert into `ajd_customer_messages`.
6. **Testing:** Verify RLS using both anonymous and admin JWTs, test service-worker installation in HTTPS, test real messages only after intentional opt-in, and confirm failed provider delivery is visible to admins.

## Server and frontend deployment

- The Edge Function `ajd-notification-config` has been deployed with JWT verification and verifies `ajd_is_admin` before returning a configuration status.
- Frontend files: `settings.html`, `ajd-notifications.js`, `ajd-notifications.css`, `ajd-admin-menu.js`, and `sw.js`.
- Changes were committed to `main` of `Jhamal96/Repair-Tracker`. Confirm the connected Cloudflare build/deployment has promoted the latest commit before testing the live website.

## Rollback / compatibility

The migration is additive: no existing repair or store records are removed or modified. To disable the notifications while preserving history, remove or disable the five `ajd_notify_*` triggers, or revert the frontend commits. Avoid deleting the new tables without first exporting any future activity history.

## Security review

All five tables have RLS enabled. Anonymous users receive no table grants. Administrator access is restricted to memberships in `ajd_admin_users`. The trigger helper functions are in the non-exposed `ajd_private` schema with public execution revoked. No SMS charges can be incurred in this implementation because there is no outbound SMS transport or sender.
