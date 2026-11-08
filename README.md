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

Deploy the web and mobile code entry screens before changing the Supabase **Confirm sign up** email. Set its body to [confirmation.html](supabase/templates/confirmation.html) and keep the email OTP length at six digits. In Supabase, configure custom SMTP with a verified sender such as `noreply@bottleforme.com`. The site's Auth URL and the email sender are configured separately. See [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Pickup forms accept a manually entered street address and optional door or intercom instructions by default. To enable Google Maps suggestions, set the server-only `GOOGLE_PLACES_API_KEY` in Vercel after enabling Places API (New), setting quotas, and reviewing the [Places API requirements](https://developers.google.com/maps/documentation/places/web-service/policies). Then deploy and check a Malta address. When enabled, publishing requires selecting an address from the dropdown.

## Admin dashboard

Open `/admin` and sign in with an existing BottleForMe account. Set the server-only `BOTTLEFORME_ADMIN_USER_IDS` to a comma-separated list of the selected accounts' Supabase Auth user IDs. An empty list grants access to nobody. Changing a marketplace Giver or Taker role does not grant admin access.

The dashboard lists pickup status and account profiles. It does not display street addresses, contact details, or payment handles.

## Marketplace API

Open `/api/docs` for the API explorer and `/api/docs/schema` for the OpenAPI JSON. Radar requires a verified session in Taker mode and returns open pickups from other accounts with approximate locality coordinates. Pickup instructions and contact details are available to the seller and the assigned collector during the handover.

Existing pickups without a verified seller remain in the database and are excluded from Radar. Review ownership before restoring any legacy listings. Coordinate the schema migration and app release so the old API does not keep serving private fields. See [AUDIT.md](AUDIT.md) for findings and rollout checks.
