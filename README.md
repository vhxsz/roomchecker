# Kingsway Room Check

Production-ready room verification system for Kingsway College residences. Students present a short-lived QR code, assigned checkers validate attendance room by room, and Deans manage residences, exceptions and reports.

## What is included

- Student, Checker and Dean roles with database-enforced permissions.
- Google OAuth and email/password authentication through Supabase Auth.
- 30-second server-signed student QR credentials.
- Server validation of student, room, checker and active check event.
- Private photo evidence with mandatory Dean review.
- Student directory, room/floor assignments, schedules and reporting UI.
- Responsive mobile experiences for students and checkers.
- PostgreSQL schema, RLS policies, storage policies and starter schedules.
- Vercel-compatible Next.js application.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase publishable key and service-role key.
3. Generate `QR_SIGNING_SECRET` with at least 32 random characters.
4. Run `supabase/schema.sql` in the Supabase SQL Editor.
5. Run `supabase/seed.sql` in the SQL Editor.
6. Start the app:

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

Enable the Google provider and use the callback URL shown by Supabase in the Google Cloud OAuth client. Email/password authentication can remain enabled for personal-email access.

## Test accounts

Choose a strong temporary password in `TEST_USERS_PASSWORD`, then run:

```bash
npm run seed:test-users
```

This creates or configures:

- `dean@kingsway.college` — Dean
- `checker@kingsway.college` — Checker
- `student@kingsway.college` — Student

Remove or disable test accounts before production rollout.

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
