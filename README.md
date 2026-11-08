# BottleForMe

BottleForMe is a free marketplace for arranging doorstep pickups of eligible Malta Beverage Container Refund Scheme (BCRS) containers. The seller and collector arrange payment directly. Voucher estimates use €0.10 per eligible container. [BCRS Malta FAQ](https://bcrsmalta.mt/faqs/)

## Local setup

1. Use Node.js 22 or later and run `npm ci`.
2. Copy `.env.example` to `.env.local` and configure a development Supabase project. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Use the browser's anon key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. For a new Supabase database, run `supabase/schema.sql` followed by `supabase/migrations/20261108083018_secure_marketplace.sql`. For a database provisioned by the original schema, apply only the migration.
4. In the production Supabase project's Auth URL Configuration, set the Site URL to `https://bottleforme.vercel.app` and add that same URL under Redirect URLs. Signup and password recovery request the current app origin. Supabase falls back to the Site URL when a requested URL is missing or isn't allowed. Add localhost to the redirect list for development as needed.
5. Run `npm run dev`. Without a Supabase configuration, the development server offers read-only Radar fixtures.

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` for local verification. Tests use an embedded PostgreSQL instance and local test records.

## Marketplace API

Open `/api/docs` for the API explorer and `/api/docs/schema` for the OpenAPI JSON. Radar returns open pickups with approximate locality coordinates. Publishing and reservations require a verified Supabase session. Pickup instructions and contact details are available to the seller and the assigned collector during the handover.

Existing pickups without a verified seller remain in the database and are excluded from Radar. Review ownership before restoring any legacy listings. Coordinate the schema migration and app release so the old API does not keep serving private fields. See [AUDIT.md](AUDIT.md) for findings and rollout checks.
