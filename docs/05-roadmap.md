# 05 – Roadmap

## Phase 1 – Foundations (Docs & Core Skeleton)
- Scope: Create architecture, schema, business‑rules, security‑threat‑model docs; set up repo folder layout; draft ADR for scheduler choice.
- Deliverables: `docs/01-architecture.md`, `02-database-schema.md`, `03-business-rules.md`, `04-security-threat-model.md`, `PROGRESS.md`, `decisions/001-scheduler-choice.md`.
- Tests: None (documentation only).
- Acceptance: All five docs present, lint‑free markdown, ADR outlines pg_cron vs Vercel Cron with decision pending.

## Phase 2 – Core Modules & Auth
- Implement `auth-profiles`, `groups`, `invitations` feature modules.
- Add RLS policies, migrations for profiles, groups, invitations.
- Unit tests for domain auth logic; pgTAP tests for RLS.
- Acceptance: Auth flows work locally, migrations pass, tests ≥ 80 %.

## Phase 3 – Habit Scheduling & Check‑ins
- Build `habits`, `scheduling`, `checkins`, `evidence` modules.
- Scheduler jobs (pg_cron) for period generation & evaluation.
- UI for habit creation, check‑in form, evidence upload.
- Acceptance: Period generation idempotent, check‑ins stored, evidence stored securely.

## Phase 4 – Penalties & Ledger
- Implement `penalties`, `ledger`, `payments` modules.
- Financial PostgreSQL functions, append‑only ledger, payment confirmation flow.
- Tests: Money helper unit tests, pgTAP for penalty creation, ledger immutability.
- Acceptance: Penalties correctly allocated, payments confirmed, balances reflect ledger.

## Phase 5 – Notifications & Leaderboard
- Build `notifications`, `leaderboard`, `analytics` modules.
- In‑app realtime notifications, email via Resend, notification preferences.
- Leaderboard UI (excludes money).
- Acceptance: Users receive notifications, leaderboard updates in real time.

## Phase 6 – Group Admin & Extras
- Implement `group-admin` UI (role management, member removal).
- Add `reactions`, `comments`, `flag_disputes` tables and UI components.
- Acceptance: Admin can manage members, disputes resolved via UI.

## Phase 7 – Polish, Accessibility, Deploy
- WCAG AA compliance, dark/light theme, mobile‑first layout.
- End‑to‑end Playwright suite covering core flows.
- Vercel production deployment, monitoring, rate‑limit tuning.
- Acceptance: All acceptance criteria from earlier phases met, no lint/type errors, CI passes.

---
*Each phase will be tracked in `docs/PROGRESS.md`. No code will be written until Phase 1 is approved as per the process defined in `CLAUDE.md`.*