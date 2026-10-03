# Kingsway Room Check — Product Plan

## Roles

- **Dean:** full administration, students, rooms, floors, checker assignments, schedules, exceptions and reports.
- **Checker:** sees only assigned floors, scans student QR codes, records photo exceptions and submits a floor.
- **Student:** signs in, sees room/check schedule and presents a short-lived QR credential.

## Verification model

The QR contains a signed, short-lived verification payload tied to the authenticated student ID. The server validates signature, expiration, active session and current room assignment before accepting it. A QR screenshot therefore expires quickly. If a phone is unavailable, the checker captures a photo and the verification stays in `photo_review` until a Dean approves or rejects it.

## Core workflows

1. Dean imports or creates students, creates rooms and assigns students/checkers.
2. Dean configures recurring Study Hall and Night Check templates.
3. A check event opens automatically or manually for the scheduled time.
4. Checker scans students room by room; duplicate, expired and wrong-room codes are rejected.
5. Photo exceptions enter the Dean review queue.
6. Dashboards aggregate completion, punctuality, absence, photo exceptions and checker accuracy by day/week/session/floor.

## Delivery phases

1. Product prototype and responsive role workflows.
2. Supabase project, Google/email authentication, schema and storage bucket.
3. Server-validated rotating QR tokens and production camera scanning.
4. CSV roster import, exportable reports, notification rules and audit log.
5. Pilot with one floor, privacy review, training and full dorm rollout.
