# BottleForMe

BottleForMe is a free marketplace for arranging doorstep pickups of eligible Malta Beverage Container Refund Scheme (BCRS) containers. The seller and collector arrange payment directly. Voucher estimates use €0.10 per eligible container. [BCRS Malta FAQ](https://bcrsmalta.mt/faqs/)

## Local setup

1. Use Node.js 22 or later and run `npm ci`.
2. Copy `.env.example` to `.env.local` and configure a development Supabase project. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Use the browser's anon key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. For a new Supabase database, run `supabase/schema.sql`, then apply the migrations in `supabase/migrations/` in order. For an existing database, apply only its pending migrations.
4. In the production Supabase project's Auth URL Configuration, set the Site URL to `https://www.bottleforme.com` and add that same URL under Redirect URLs. Signup and password recovery request the current app origin. Supabase falls back to the Site URL when a requested URL is missing or isn't allowed. Add localhost to the redirect list for development as needed.
5. Run `npm run dev`.

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` for local verification. Tests use an embedded PostgreSQL instance and local test records.

## Signup email and pickup addresses

In a staging Supabase project, enable **Confirm email**, set the email OTP length to **6** with a **10-minute expiry**, and keep the signup/resend minimum interval at **60 seconds**. Set **Confirm sign up** to the [code-only template](supabase/templates/confirmation.html) with the subject **Your BottleForMe verification code**. Keep the password recovery template and redirect URLs configured for the same environment. Supabase applies its own Auth rate limits alongside the app's cooldown. [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates) · [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)

Supabase's built-in SMTP is limited to project team addresses. On free projects where template editing requires custom SMTP, configure a supported SMTP sender before switching the template. A verified sender such as `noreply@bottleforme.com` is optional for OTP itself. [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

Use a fresh staging email to test signup, the resend countdown, a wrong code, a code past expiry, a valid code, and a replay of that code from a signed-out browser. Verify that password sign-in is blocked before confirmation and works afterward, and run a password reset separately.

Pickup forms accept a manually entered street address and optional door or intercom instructions by default. To enable Google Maps suggestions, set the server-only `GOOGLE_PLACES_API_KEY` in Vercel after enabling Places API (New), setting quotas, and reviewing the [Places API requirements](https://developers.google.com/maps/documentation/places/web-service/policies). Then deploy and check a Malta address. When enabled, publishing requires selecting an address from the dropdown.

## Admin dashboard

Open `/admin` and sign in with an existing BottleForMe account. Set the server-only `BOTTLEFORME_ADMIN_USER_IDS` to a comma-separated list of the selected accounts' Supabase Auth user IDs. An empty list grants access to nobody. Changing a marketplace Giver or Taker role does not grant admin access.

The dashboard lists pickups and profiles, including account email addresses. In Profiles, send an in-app notification to one account or all confirmed accounts. Recipients see messages in the notification bell on web and mobile.

## Web Push

Configure a Web Push VAPID key pair with `BOTTLEFORME_VAPID_PUBLIC_KEY` and the server-only `BOTTLEFORME_VAPID_PRIVATE_KEY`. Keep the production key pair stable so browser subscriptions remain valid. Admin messages and pickup updates use the existing inbox and push worker. Signed-in users can turn lock-screen alerts on or off from the web inbox. On iPhone or iPad, open BottleForMe from the Home Screen to enable alerts.

## Marketplace API

Open `/api/docs` for the API explorer and `/api/docs/schema` for the OpenAPI JSON. Radar requires a verified session in Taker mode and returns open pickups from other accounts with approximate locality coordinates. Pickup instructions and contact details are available to the seller and the assigned collector during the handover.

### Pickup scheduling

Apply the pending pickup scheduling migration before deploying the app or API. New listings created in the updated apps require at least one availability window. Listings created before the update can still be reserved directly. Owners can edit availability while a listing is open. Any pending proposals remain visible and require a response. Confirming a pickup closes the listing to competing requests. A cancelled confirmed arrangement closes that listing.

All displayed times use Europe/Malta. If a manually entered time falls in the missing or repeated hour at a daylight-saving change, choose another time. Scheduling alerts appear in the in-app inbox and use the existing mobile push queue for registered devices. Verify the new scheduling flow with one Giver and two Takers in staging, including a competing acceptance, a counteroffer, and cancellation after confirmation.

Existing pickups without a verified seller remain in the database and are excluded from Radar. Review ownership before restoring any legacy listings. Coordinate the schema migration and app release so the old API does not keep serving private fields. See [AUDIT.md](AUDIT.md) for findings and rollout checks.
