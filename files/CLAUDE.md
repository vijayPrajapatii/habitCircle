# HabitCircle

Social habit-accountability web app. Friends join groups, commit to habits, check in, and owe each other money when they miss. Money is tracked in a **virtual ledger only**: no payment processing, no custody. Visual feel: Linear x Stripe x a modern fitness app.

The product name is configurable (`src/config/brand.ts` + `NEXT_PUBLIC_APP_NAME`). Never hard-code it in components, emails or copy.

## How we work

- Work in phases (`docs/05-roadmap.md`). Never start the next phase without my explicit approval.
- Use Plan Mode first for anything touching schema, money, auth or RLS. Show the plan, wait for approval.
- Do not rely on memory for Next.js, Supabase, shadcn/ui or Tailwind APIs. They change fast. Check current official docs (or the Context7 MCP if available) before using an API.
- Technical decisions: decide yourself and record a short ADR in `docs/decisions/NNN-title.md`. Product, money-rule and legal-risk decisions: ask me.
- No new dependency, service or infrastructure outside the stack below without asking. Justify any addition in one sentence.
- Never weaken RLS, constraints or tests to make something pass. Never use `--no-verify`.
- Small, focused commits (Conventional Commits). One branch per phase: `phase/<n>-<slug>`.
- Keep `docs/PROGRESS.md` current (done / in progress / known gaps / next). It is the memory between sessions.

## Definition of done (every task)

1. `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
2. `supabase db reset` applies all migrations and seed data from scratch without errors.
3. `supabase test db` (pgTAP) passes for every table or function touched.
4. No secrets in git. `.env.example` is updated.
5. UI work has loading, empty, error and success states, works at 375px and 1280px, and is keyboard accessible.
6. End with a summary: what changed, migrations added, tests run and results, known gaps, suggested next step. Do not list every file; I will use `git diff --stat`.

## Stack (fixed)

- Next.js (current stable, App Router), React, TypeScript strict, Tailwind CSS, shadcn/ui, lucide-react, React Hook Form + Zod.
- Supabase: Postgres, Auth, Storage (private buckets), Realtime. Use `@supabase/ssr`. Use generated types (`supabase gen types`), no ORM.
- Resend for email. In-app notifications. Delivery sits behind a channel interface so web push can be added later.
- Vercel for hosting. Scheduler choice is recorded in an ADR.
- Tests: Vitest (domain logic), pgTAP (RLS, DB functions), Playwright (a few core e2e flows).
- Package manager: pnpm. Local dev uses the Supabase CLI with Docker.
- Not allowed: a separate Spring Boot / FastAPI / Node backend, microservices, an ORM.

## Architecture rules

- Feature modules live in `src/features/<module>/` (components, actions, queries, schemas, types). Modules: auth-profiles, groups, invitations, habits, scheduling, checkins, evidence, verification, penalties, ledger, payments, notifications, leaderboard, analytics, group-admin.
- Pure domain logic lives in `src/domain/`: no I/O, no React, no Supabase imports. It is fully unit-tested.
- Route Handlers and Server Actions are thin: authenticate, validate (Zod), authorize, call domain or DB function, return a typed result.
- Financial writes go through Postgres functions that run in a single transaction (SECURITY DEFINER only where necessary, `search_path` pinned). The client never writes to financial tables.
- Server-only code imports `server-only`. The service-role key never reaches client code or `NEXT_PUBLIC_*` variables.
- Validate environment variables with Zod at startup (`src/lib/env.ts`).

## Domain rules (do not violate)

**Scheduling and evaluation**
- Model: habit -> schedule -> occurrences. One occurrence per evaluation period (a day for daily, a week for weekly, a month for monthly, custom for custom).
- Evaluate a period only after it ends plus grace period plus review window.
- Weekly and monthly habits compare total completed quantity or sessions against the target. Never penalize individual missed days of a weekly or monthly habit.
- Occurrence generation and evaluation jobs are idempotent. Running twice never creates duplicate occurrences or penalties.

**Commitments**
- Active commitments are locked. Edits create a new habit version effective from the next period. History and existing penalties are never rewritten.
- Penalty amount, target and schedule are snapshotted onto the occurrence or penalty row at creation.

**Check-in statuses:** pending, submitted, verified, missed, disputed, excused. A submitted check-in is not verified. Verification modes: self-reported, peer review, admin review, evidence-required. Nobody can verify or dispute-resolve their own check-in.

**Penalties**
- One penalty per occurrence, enforced by a unique constraint.
- Default distribution: equal split among eligible members (active members at period end, excluding the offender). The eligible set is snapshotted on the penalty.
- Allocation amounts are integer minor units and must sum exactly to the penalty. Remainders are assigned deterministically (documented in an ADR).
- Penalties are reversed only through compensating ledger entries.

**Ledger and payments**
- Append-only. Database triggers block UPDATE and DELETE on ledger and audit tables.
- Payment flow: sender marks sent (+ optional reference/evidence) -> recipient confirms or rejects. Only the recipient's confirmation completes a payment. Never trust the sender's claim.
- The leaderboard never uses money paid or received.

## Money rules

- Integer minor units (paise) in a `bigint`/`integer` column. Never floats, never JS number math on money outside a tested money helper.
- Currency is stored per group. No currency conversion.
- All financial calculation happens server-side or in the database.

## Time rules

- Store timestamps in UTC (`timestamptz`). Store IANA timezone names, never fixed offsets.
- A habit snapshots its timezone at creation. Changing the profile timezone must not move deadlines of active commitments.
- Period boundaries are computed in the habit's timezone and must be tested across DST transitions.

## Security rules

- RLS enabled on every table in `public`, with explicit policies and no `USING (true)` shortcuts.
- Authorization is by group membership and role (owner, admin, member), checked in RLS and again on the server.
- Use `supabase.auth.getUser()` for server-side auth checks, not `getSession()`.
- Never trust client-submitted penalty amounts, roles, payment status, user IDs or group IDs.
- Evidence lives in private buckets, accessed by short-lived signed URLs after a membership check. Restrict file type and size. Strip EXIF.
- Rate-limit sensitive operations (auth, invitations, check-ins, payment actions). Cron endpoints require a secret and are not publicly callable.
- Audit-log every financial and role-changing action.

## UI rules

- Premium dark theme by default, optional light theme (`next-themes`). Design tokens as CSS variables. Rounded cards, subtle motion, consistent spacing.
- Desktop: sidebar (Dashboard, My Groups, My Habits, Activity Feed, Leaderboard, Financial Ledger, Notifications, Settings). Mobile: bottom nav (Home, Groups, Habits, Activity, Profile).
- Must not look like a generic admin template. Money screens should feel like fintech, check-in screens like fitness apps.
- WCAG AA contrast. Use confirmation dialogs for destructive and financial actions.

## Docs map

- `docs/01-architecture.md`, `02-database-schema.md`, `03-business-rules.md`, `04-security-threat-model.md`, `05-roadmap.md`, `06-open-questions.md`
- `docs/decisions/` ADRs
- `docs/PROGRESS.md` current state

## Commands

Fill this section in during Phase 1 and keep it accurate: dev, build, typecheck, lint, test, `supabase start`, `supabase db reset`, `supabase test db`, `supabase gen types`, e2e.
