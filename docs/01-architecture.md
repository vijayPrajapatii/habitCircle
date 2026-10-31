# 01 – Architecture Overview

## System Overview & Module Boundaries

The HabitCircle application is a **single‑page Next.js (App Router) web app** backed by **Supabase** (PostgreSQL, Auth, Storage, Realtime).  All business‑critical logic lives in two layers:

| Layer | Responsibility | Location |
|-------|----------------|----------|
| **Feature modules** | UI components, route handlers, server actions, Supabase queries & mutations. | `src/features/<module>/` |
| **Domain layer** | Pure TypeScript business rules, state‑machines, money helpers, validation. No I/O, no React, no Supabase imports. | `src/domain/` |

The project defines **15 feature modules** (as mandated in the `CLAUDE.md` architecture rules):

1. `auth-profiles`
2. `groups`
3. `invitations`
4. `habits`
5. `scheduling`
6. `checkins`
7. `evidence`
8. `verification`
9. `penalties`
10. `ledger`
11. `payments`
12. `notifications`
13. `leaderboard`
14. `analytics`
15. `group-admin`

Each module contains its own **components**, **actions** (client‑side calls), **queries** (Supabase reads), **schemas** (Zod for request validation), and **types** (generated from the database).  Server‑only code imports `server-only` and uses the **service‑role** key; the client never sees it.

## Core Request Flows

### 1️⃣ Authenticated Page Load
1. Browser sends request to Next.js page.
2. `server-only` entry point calls `supabase.auth.getUser()`.
3. RLS policies on every table enforce the user’s group membership/role.
4. The route handler invokes domain‑level “load dashboard” logic which orchestrates several feature queries (profile, groups, upcoming habit occurrences, notifications).
5. Data is returned as JSON to the React component; the UI renders with loading / empty / error states.

### 2️⃣ Check‑in Submission
1. User fills a check‑in form; client validates with Zod.
2. Server Action receives the payload, authenticates the user, and runs a **domain‑level `submitCheckIn`** function.
3. The function calls a **PostgreSQL function `submit_checkin`** (SECURITY DEFINER) that:
   - Inserts a row in `habit_checkins`.
   - Creates a placeholder `checkin_evidence` row if evidence is required.
   - Sets status = `submitted`.
4. RLS ensures only the owner can create the row.
5. The API returns the new check‑in ID; the client redirects to the detail view.

### 3️⃣ Evidence Upload
1. Client obtains a **signed URL** from Supabase Storage (`GET /api/evidence/upload-url`).
2. File is uploaded directly to the private bucket.
3. Server Action updates the `checkin_evidence` row with the storage path and marks the evidence status `uploaded`.
4. A domain rule verifies file type, size, and strips EXIF (via a Postgres trigger that calls a stored procedure).

### 4️⃣ Period Evaluation Job (Scheduler)
1. Scheduler (see **Scheduler Design** below) triggers `evaluate_period` for each habit schedule that just ended.
2. The job runs a **transactional PL/pgSQL function** that:
   - Generates the next `habit_occurrence` if needed (idempotent via `ON CONFLICT DO NOTHING`).
   - Calculates completed quantity vs. target.
   - If the target is missed, creates a **penalty row** with snap‑shotted amount, target, and eligible members.
   - Inserts ledger entries for the penalty (append‑only).
3. All writes are performed in a single transaction; on failure the job is retried (see retry policy).

### 5️⃣ Payment Confirmation
1. Recipient receives an in‑app notification with a **payment‑confirm** action.
2. Server Action calls `confirm_payment(payment_id, receipt_url?)` which:
   - Verifies the payment is still `pending`.
   - Inserts a ledger entry crediting the recipient and debiting the sender.
   - Updates `payments` status to `confirmed`.
3. The sender cannot unilaterally mark a payment as complete – only the recipient’s confirmation changes state.

## Where Business Rules Live
| Rule Type | Preferred Location | Reasoning |
|-----------|-------------------|-----------|
| **Pure domain calculations** (e.g., penalty split, money rounding, state‑machine transitions) | `src/domain/` (TypeScript) | Fully unit‑testable, no I/O, deterministic across environments. |
| **Cross‑entity consistency & atomic writes** (e.g., creating a penalty and its ledger entries) | PostgreSQL stored procedures (SECURITY DEFINER) | Guarantees atomicity, runs in the database where the data lives; prevents client‑side race conditions. |
| **Row‑level access control** | Row‑Level Security (RLS) policies on each table | Enforced by the database for every query, regardless of client or server code. |
| **Time‑zone calculations & period boundaries** | PostgreSQL functions (`calculate_period_bounds`) | Uses `timestamptz` and `AT TIME ZONE` reliably; avoids divergent JS timezone libraries. |
| **Rate‑limit enforcement** | Supabase edge functions / Postgres `pg_cron` guard tables | Centralised, cannot be bypassed by a compromised front‑end. |

## Scheduler Design

| Aspect | Design Decision |
|--------|-----------------|
| **Job list** | A `cron.jobs` table stores: `job_id`, `name`, `schedule_cron`, `handler_function` (SQL function name), `enabled`, `last_run_at`, `run_status`. |
| **Cadence** | - Daily habit occurrence generation – `0 0 * * *` (UTC).<br>- Weekly evaluation – `0 2 * * 1` (Monday 02:00 UTC).<br>- Monthly evaluation – `0 3 1 * *` (first of month 03:00 UTC). |
| **Idempotency** | Each job records a **run token** (`run_id UUID`). The handler function checks `WHERE NOT EXISTS (SELECT 1 FROM job_runs WHERE job_id = $1 AND run_id = $2)`.  This guarantees that a retry or duplicate schedule does not create duplicate rows. |
| **Timezone handling** | All timestamps stored in UTC. The habit’s IANA timezone is stored on the habit row; period boundaries are computed inside the SQL function using `AT TIME ZONE`. The scheduler itself runs in UTC, so no DST surprises. |
| **Failure / Retry** | Jobs are wrapped in a `BEGIN … EXCEPTION … END` block. On failure, the job status is set to `failed` and the `run_at` is left unchanged. A **retry policy** (exponential back‑off, max 3 attempts) is implemented by a separate “watchdog” cron that selects failed jobs older than 5 min and re‑queues them with a new `run_id`. |

## Notification Architecture

1. **Channel Interface** – `src/lib/notifications/channel.ts` defines an abstract `Channel` with `send(to: UserId, payload: NotificationPayload): Promise<void>`.
2. **Implementations**
   - **In‑app** – writes to `notifications` table; a real‑time subscription (Supabase Realtime) pushes to the client.
   - **Email** – uses **Resend**; the email service is called from a server‑only helper that implements the same `Channel` interface.
   - **Future Web‑Push** – a stub implementation that conforms to the interface; swapping in a concrete service later requires only registering the new channel.
3. **Dispatch** – A `NotificationService` composes the required channels based on user preferences (`notification_preferences` table) and calls them in parallel.

## Repository Folder Structure (high‑level)
```
habitCircle/
├─ .claude/                # Claude‑Code config & settings
├─ src/
│  ├─ app/                # Next.js App Router entry points
│  ├─ features/           # 15 feature modules (see above)
│  ├─ domain/             # Pure business‑logic TypeScript
│  ├─ lib/                # Shared utilities (env, money, notifications)
│  ├─ styles/             # Tailwind config, CSS variables
│  └─ config/             # Brand & env defaults
├─ supabase/
│  ├─ migrations/         # SQL migration files
│  ├─ functions/          # Postgres functions (SQL/PLPGSQL)
│  └─ policies/           # RLS policy definitions
├─ tests/
│  ├─ unit/               # Vitest tests for domain layer
│  ├─ pg/                 # pgTAP tests (RLS, functions)
│  └─ e2e/                # Playwright scenarios
├─ docs/
│  ├─ 01-architecture.md
│  ├─ 02-database-schema.md
│  ├─ 03-business-rules.md
│  ├─ 04-security-threat-model.md
│  ├─ 05-roadmap.md
│  ├─ 06-open-questions.md
│  ├─ PROGRESS.md
│  └─ decisions/
│      └─ 001-scheduler-choice.md
└─ package.json, pnpm-lock.yaml, etc.
```

---
*This document captures the high‑level architecture, request flows, rule placement, scheduler, notification design, and repo layout required for Phase 1.*