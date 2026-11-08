# BottleForMe codebase audit

## Scope and architecture

Audited the clean checkout of `main` at `4fd7c48`. BottleForMe is a Next.js App Router application with React, Tailwind, and Leaflet over OpenStreetMap. The home page contains the listing, Radar, Handover, and profile views. Supabase supplies authentication and PostgreSQL. Next.js route handlers provide the pickup API, and the app also serves an OpenAPI explorer and a PWA shell. Vercel hosts the public app.

A seller signs in, enters exact counts of eligible containers and private pickup instructions, chooses a seller share and direct payment method, and publishes an open pickup. Guests can browse Radar by locality. A signed-in collector reserves an open pickup and gains access to the handover details. The collector can record completion, and either participant can cancel an active pickup. Users arrange and verify payments directly.

## Confirmed findings and fixes

| Severity | Affected code | Root cause and fix |
|---|---|---|
| P0 | [Pickup list and publish API](app/api/pickups/route.ts#L10), [database migration](supabase/migrations/202611080001_secure_marketplace.sql#L18), [API data projection](lib/pickup-visibility.ts#L5) | The public API returned entire pickup rows through a service-role client. The original database policies also allowed unrestricted profile reads and pickup reads, inserts, and updates. The migration restricts profiles to their owners and removes direct client access and Realtime publication for pickups. The API returns a locality-level public projection and keeps contact and address details behind participant checks. The service key lives in a server-only module. |
| P1 | [Pickup detail and status API](app/api/pickups/%5Bid%5D/route.ts#L9), [atomic transition](supabase/migrations/202611080001_secure_marketplace.sql#L62), [Handover action](app/page.tsx#L223) | The detail endpoint used a separate mock store and allowed arbitrary status changes. The UI displayed fabricated chat and reported a claim or completion without recording it. Detail and status now use the same persisted pickup. PostgreSQL checks ownership and prior state during the update, making reservation exclusive and repeated completion safe. Handover records completion and describes payment as a separate step between users. |
| P1 | [Publish API](app/api/pickups/route.ts#L48), [validation](lib/pickup-validation.ts#L8), [listing form](app/page.tsx#L176) | Publishing accepted fabricated identities and amounts, dropped the category breakdown, and reported success on failed requests through an in-memory fallback. The server verifies the session, saves exact counts, derives the amounts, supports idempotent retries, and returns an error if storage fails. |
| P1 | [Account client](lib/auth.ts#L12), [session listener](app/page.tsx#L63), [account modal](components/AuthModal.tsx), [confirmation route](app/auth/callback/route.ts#L3) | Local profile data impersonated signed-in users and signup set a local identity before email confirmation. Role and avatar fields disagreed with the schema, and the callback reported successful verification unconditionally. Sessions now drive account state. Profile changes persist under owner-only rules, signup waits for a session, and password recovery has a dedicated form. Profile photo upload is available after sign-in and accepts JPEG, PNG, and WebP files up to 512 KB. |
| P1 | [Radar load](app/page.tsx#L109), [map renderer](components/RadarMap.tsx) | Radar showed fixtures instead of loading saved pickups. The map interpolated listing fields into HTML and lacked unmount cleanup. Radar fetches open listings, filters by locality, and provides loading, empty, and failure states. Map popups render listing text as text, group listings by approximate locality, and remove the map on unmount. |
| P1 | [Runtime dependencies](package.json), [API explorer](app/api/docs/page.tsx) | The original Next.js release was affected by published App Router advisories. Its 15.x successor still bundled a vulnerable PostCSS release, and the Swagger UI dependency tree contained flagged transitive packages and React peer conflicts. Upgraded to a patched Next.js release and React 19 and switched the explorer to Scalar. The explorer retains the same routes and restricts requests to the app's origin. [Next.js advisory](https://nextjs.org/blog/security-update-2025-12-11) |
| P2 | [Deposit calculation](lib/types.ts#L92), [form input](components/ContainerCounter.tsx), [listing screen](app/page.tsx) | Zero containers produced a deposit amount, fractional input was truncated, and the form started at 75 containers with sample contact details. Amounts now use integer cents, the form starts empty, and packing bag count is separate from container quantity. The interface distinguishes estimated voucher value from seller payment and specifies BCRS eligibility. [BCRS Malta FAQ](https://bcrsmalta.mt/faqs/) |
| P2 | [Service worker](public/sw.js#L16), [viewport and layout](app/layout.tsx), [activity dialog](components/NotificationModal.tsx) | The worker could serve cached HTML for failed API requests and keep a stale app shell. It now limits caching to shell and static assets and loads navigation from the network first. The viewport permits zoom, account and activity dialogs support keyboard dismissal, and activity copy reflects in-session events. |

## Decisions and compatibility

- The existing 70% seller-share cap, 5-point slider step, and 20-bag maximum remain the listing rules. The server accepts whole percentages from 0 to 70. The new input ceiling is 10,000 containers per listing. Cash is the default. The Revolut option remains available.
- Bag count describes packing. On the public site, the bag buttons changed the approximate bag label while the exact count stayed at 75. Pricing now uses exact counts exclusively.
- Existing ownerless rows remain in PostgreSQL and are excluded from Radar. Existing authorized pickup history is preserved. The public API now lists open pickups, and authenticated participants can request their own history. Creating new pickups requires exact category counts and a session.
- Legacy mock profiles and production demo listings have been replaced by real account and listing data. Development without Supabase still exposes labeled, read-only Radar fixtures.

## Rollout

Use a development Supabase project for verification. Apply the migration to an existing database, or apply the base schema followed by the migration on a new database. Configure the public URL and anon key and keep the service-role key in server-only environment settings. Confirm allowed Auth redirect origins for confirmation and recovery. Coordinate the migration with app rollout because the old API used a service-role client and could still bypass RLS while it was serving traffic.

Review the ownership of any legacy rows before restoring their public visibility. Check the actual Supabase grants and Auth configuration on staging before release. A limited signature scan of the tracked checkout and Git history found no matching Supabase secret keys, complete JWTs, or private key blocks.

## Verification

- `npm run lint` and `npm run typecheck` passed. The original checkout had a lint script without a lint configuration and no test suite.
- `npm run build` passed with Next.js 16.4.5 and Webpack. The build script uses Webpack because Turbopack’s CSS worker exited on this Windows host while processing the API explorer stylesheet.
- The compiled production server returned 200 for the home page, API explorer and OpenAPI JSON. With credentials intentionally absent, Radar returned 503 with `private, no-store`, and the auth callback returned a relative 307 redirect.
- `npm test` passed all six tests. Coverage includes rounding and split boundaries, count validation, trusted amount calculation, public response redaction, same-origin callback redirects, and PostgreSQL grants and pickup transitions with competing claim attempts.
- Local HTTP checks covered the home page, OpenAPI JSON, filtered pickup list and detail, missing-backend failure responses, and the relative auth callback redirect.
- Browser checks used viewport settings of 320, 375, 430, 768, and 1280 px. The listing form showed no horizontal overflow. Checks covered invalid and empty counts, bag independence, keyboard slider boundaries, the guest sign-in gate, password reset UI, Radar filtering and empty states, map markers and attribution, the Handover gate, and a successful GET request through the API explorer. The map retest produced no new console errors after zooming and switching tabs.
- `npm audit --omit=dev` reported zero production vulnerabilities. The full audit still reports eight moderate entries in the development lint toolchain, traced to one minimatch advisory. [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)

## Files changed

- App and API — `app/page.tsx`, `app/layout.tsx`, `app/api/pickups/route.ts`, `app/api/pickups/[id]/route.ts`, `app/api/docs/page.tsx`, `app/auth/callback/route.ts`.
- UI and client logic — `components/AuthModal.tsx`, `components/ContainerCounter.tsx`, `components/NotificationModal.tsx`, `components/RadarMap.tsx`, `lib/auth.ts`, `lib/avatar.ts`, `lib/mock-data.ts`, `lib/supabase.ts`, `lib/types.ts`.
- Pickup API and database — `lib/pickup-validation.ts`, `lib/pickup-visibility.ts`, `lib/pickups-server.ts`, `lib/swagger.ts`, `supabase/schema.sql`, `supabase/migrations/202611080001_secure_marketplace.sql`.
- Build, PWA, tests and setup — `.env.example`, `eslint.config.mjs`, `next.config.mjs`, `package.json`, `package-lock.json`, `public/manifest.json`, `public/sw.js`, `tsconfig.json`, `tests/marketplace.test.ts`, `README.md`, `AUDIT.md`.

## Remaining coverage

Actual email delivery, signed-in browser flows between two accounts, and the deployed Supabase configuration require a staging project. The SQL migration was exercised in embedded PostgreSQL. The Vercel deployment and production database are pending rollout.

Negotiated offers, real-time messaging, listing editing or permanent deletion, and listing photo uploads have no complete flow in the reviewed code. Cancellation is available through the persisted pickup workflow.

## Recommended improvements

Add rate limits to publication and reservation. Use two staging accounts to exercise email confirmation, recovery, and the full publish-to-handover journey. Consider seller approval before releasing pickup instructions if address harvesting becomes a concern. Track the minimatch advisory in the lint toolchain.
