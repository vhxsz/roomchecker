# Kingsway Room Check

Room verification system for Kingsway College residences. Students present a short-lived QR code, assigned checkers validate attendance room by room, and Deans manage residences, exceptions and reports. Real authentication and attendance require a configured Supabase project; the demo buttons are isolated previews, not real accounts.

## What is included

- Student, Checker and Dean roles with database-enforced permissions.
- Google OAuth exclusively for verified `@kingsway.college` identities.
- 30-second server-signed student QR credentials.
- Server validation of student, room, checker and active check event.
- Private photo evidence with mandatory Dean review.
- Dean-managed profiles, roles, floors, rooms, assignments and schedules.
- Daily, weekly, monthly and yearly reports with CSV export.
- Automatic student account creation on first school Google sign-in; no app passwords or email invites.
- Responsive mobile experiences for students and checkers.
- PostgreSQL schema, RLS policies, storage policies and starter schedules.
- Vercel-compatible Next.js application.
- Dean-managed promotion/demotion and individual-room or whole-floor checker coverage.
- Resident student workers retain their own room and student QR when promoted.
- Atomic room transfers, capacity guards and protection against roster changes mid-check.
- Maintenance requests with priorities, Dean-managed status and required resolutions.
- Personal attendance history and administrative activity log.
- Paginated attendance reports and formula-safe CSV export.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase publishable key and service-role key.
3. Generate `QR_SIGNING_SECRET` with at least 32 random characters.
4. Run `supabase/schema.sql` in the Supabase SQL Editor.
5. Run `supabase/migrations/20261005_residence_operations.sql` in the SQL Editor.
6. Run `supabase/migrations/20261005_school_google_only.sql` in the SQL Editor.
7. Run `supabase/seed.sql` in the SQL Editor.
8. Start the app:

```bash
npm install
npm run dev
```

The local app runs at `http://localhost:3000`.

## Supabase authentication

In Authentication → URL Configuration:

- Site URL: `http://localhost:3000` during local development.
- Redirect URL: `http://localhost:3000/auth/callback`.
- Add the final production callback after deployment: `https://YOUR_DOMAIN/auth/callback`.

Enable **Google** and disable **Email**, **Phone**, anonymous sign-in and any other OAuth providers in Supabase Authentication. Keep global user signups enabled so Google can create new school users.

Google's `hd=kingsway.college` parameter is only an account-picker hint, not an access-control rule. Creation is enforced by the SQL trigger and optionally the [Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook). In Authentication → Hooks, select `public.school_google_signup` for **Before User Created** to return a friendly rejection message.

The application API and database RLS independently require an exact school email, a matching verified Google identity and an OAuth-authenticated session. Password/OTP sessions are denied even for accounts that have a linked Google identity. Disable other OAuth providers: the OAuth authentication method in Supabase's JWT does not distinguish which social provider was used for an existing multi-provider account.

After the first school Google sign-in, the account starts as **Student**. For the first Dean, a trusted Supabase administrator must promote the exact school account in `public.profiles` using its verified user ID. There is no automatic first-user admin privilege. Subsequent promotions and demotions use **Users & Roles**.

Existing profiles, roles and attendance are not deleted by the migration. Personal-email accounts stop having app access. Old email/password accounts with a matching school Google identity can keep their profile and role when signing in through Google. Supabase identity linking/configuration must be tested with the actual project before relying on this migration path.

## Test accounts

The isolated Student, Checker and Dean demo buttons do not create or authenticate users. Password-based `seed:test-users` is intentionally disabled. Real tests need actual school Google accounts, then Dean-managed role assignments.

## Vercel deployment

Import `https://github.com/vhxsz/roomchecker.git` into Vercel and add these environment variables for Production, Preview and Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QR_SIGNING_SECRET`
- `NEXT_PUBLIC_SITE_URL`

Never expose `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable. After the first deployment, update `NEXT_PUBLIC_SITE_URL` and the Supabase authentication URLs to the deployed HTTPS domain, then redeploy.

## Security notes

- The service-role key is referenced only in server route handlers.
- QR signatures are checked with timing-safe comparison and expire after 30 seconds.
- Checkers can submit only for assigned active rooms.
- Photo files are private, limited to supported image formats and 5 MB.
- RLS remains the final authorization layer for browser-originated database access.
- All production activity should be audited and retained according to the school privacy policy.

## Upgrading an existing database

Run the unapplied migrations in order: `supabase/migrations/20261005_residence_operations.sql`, then `supabase/migrations/20261005_school_google_only.sql`. Do not rerun `schema.sql` or erase existing student data. The migration runs in one transaction and does not remove student records. Apply it before deploying this version: the app deliberately refuses to fall back to non-transactional role/assignment writes if the migration is missing.

Important behavior:

- One responsible checker per room. Selecting a room assigned to someone else transfers responsibility. Selecting a floor toggles all its active rooms.
- Checkers may visit `/student` for their personal QR, but cannot verify themselves.
- Closing a check records absences for unrecorded residents; pending photos remain pending until the Dean reviews them.
- Resident assignments cannot change during an open session. Move residents before deactivating their room.
- Accounts with attendance history cannot be permanently deleted; remove checker permissions or demote the user to retain attendance evidence.
- Deans open sessions manually from **Live check**. Recurring schedules are configuration, not an automatic cron service.
- The configured verification window starts when the Dean opens the session. Scans/uploads after that window are rejected; the Dean can still review submitted photos and close the session.
- QR scanning proves a valid, short-lived student credential was presented to an authorized checker, not a student's physical location. Supervision is still necessary to prevent collusion. Photos are submitted for human review; there is no facial recognition.
- Maintenance requests are not an emergency response service.

## Verification

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

`npm test` uses an isolated PostgreSQL-compatible PGlite database to execute the schema, migration and permission/transaction tests. Authentication/storage schemas are test stubs. `npm run test:e2e` runs Chrome against a separate local dev server on port 3100 and mocks the Supabase/API responses to test UI interactions; it never writes to production. Install Google Chrome or adjust the Playwright channel for your machine. These tests do not replace live Supabase/Auth/Storage and two-device camera testing.

Before live use: configure the two Supabase keys locally and in Vercel, apply both SQL migrations, enable Google and disable alternative providers, configure redirects, and test school/personal Google accounts, QR scanning with two phones, upload/review and exports against the real project. Never paste a service-role key into a public message or commit it.

Research informing the residence features: [eRezLife assignments](https://erezlife.com/assignments/) (occupancy and room changes) and [room condition reporting](https://erezlife.com/room-condition-reporting/) (maintenance/work orders).
