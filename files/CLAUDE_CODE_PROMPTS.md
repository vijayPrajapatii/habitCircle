# HabitCircle: Claude Code Prompt Pack

How to use this file:

1. Put `CLAUDE.md` in the repo root. It holds the stable rules Claude Code loads every session.
2. Do the setup in section 0.
3. Paste the **Phase 0** prompt first. Review the docs it produces. Answer the open decisions.
4. Then paste one phase prompt at a time. Run `/clear` between phases; `docs/PROGRESS.md` carries the memory.

---

## 0. Setup (you do this, not Claude)

- Install Node (current LTS), pnpm, Docker, Supabase CLI, GitHub CLI.
- Create an empty GitHub repo and clone it. Copy `CLAUDE.md` into the root.
- Start Claude Code in the repo and press Shift+Tab to enter Plan Mode for Phase 0.
- Optional MCP servers: Context7 (current library docs), GitHub. If you connect a Supabase MCP, point it only at a dev project, never production.
- Do not run with `--dangerously-skip-permissions`. Keep `.env.local` out of git.
- Needed later, not now: a Supabase cloud project (Phase 2+), Google OAuth client (Phase 2), Resend account and verified domain (Phase 6), Vercel project (Phase 7).

---

## 1. Decisions to approve (recommended defaults)

Phase 0 will ask about these. Answering them up front saves a round trip. Edit anything you disagree with.

| Decision | Recommended default |
|---|---|
| Where rules live | Pure TS for period/timezone/evaluation decisions (unit-testable). Postgres functions for transactional writes (penalty + allocations + ledger entries in one transaction). DB constraints as the final backstop. |
| Scheduler | Supabase `pg_cron` (or Vercel Cron if on a plan that allows frequent runs) ticks every 15 minutes and calls a secret-protected handler. Handler processes only what is due, idempotently. |
| When a penalty is created | After period end + grace period + review window (default 24h), and only if no check-in for that period is still disputed. |
| Peer review rule | One approval from any other member verifies. If nobody reviews or flags within the review window, the check-in auto-verifies. Flags move it to disputed. |
| Dispute resolution | Group admin decides. Owner decides if the admin is the disputing party. |
| Allocation rounding | Integer paise. Remainder paise go one each to eligible members in stable sort order (by user ID). Allocations always sum exactly to the penalty. |
| Eligible receivers | Active members at period end, excluding the offender. Snapshotted on the penalty. |
| Member leaves with open dues | Allowed to leave, but obligations stay in the ledger and remain collectable. |
| Late joiner | Does not share in penalties for periods that ended before they joined. |
| Group end | Final settlement summary generated; ledger stays readable. |
| Exemptions | Member requests, admin approves, per occurrence or date range. |
| Timezone changes | Habit snapshots its timezone at creation. Profile changes apply to new habits only. |
| Group size | Default max 10, hard cap 50 for the MVP. |
| Currency | INR default, stored per group, no conversion. |
| Rate limiting | Postgres-backed limiter for sensitive operations. No Redis or new service. |
| UPI | Show payee details and a UPI deep link where the payee has chosen to share a VPA. Optional per user. |
| Evidence privacy | Private bucket, signed URLs with short TTL, EXIF stripped, retention policy documented. |
| Legal | The MVP is a peer-to-peer ledger with no custody. Get proper legal advice on penalties/stakes and payments rules before any public launch. Claude Code should flag this, not decide it. |

---

## 2. Phase 0: Architecture review (paste first)

```text
Read CLAUDE.md first. This is Phase 0: design only.

Act as a startup CTO, senior architect and security engineer. Do NOT scaffold the app or write application code. Inspect the repository as it currently exists, then produce these documents in docs/:

1. 01-architecture.md
   - System overview and module boundaries (the 15 modules in CLAUDE.md)
   - Request flow for: authenticated page load, check-in submission, evidence upload, period evaluation job, payment confirmation
   - Where each business rule lives (TS domain vs Postgres function vs RLS), with reasoning
   - Scheduler design: job list, cadence, idempotency keys, timezone handling, failure/retry behavior
   - Notification architecture with a channel interface (in-app, email, future web push)
   - Folder structure for the repo
2. 02-database-schema.md
   - Mermaid ERD
   - Every table with columns, types, constraints, indexes. Start from: profiles, groups, group_members, group_invitations, habits, habit_schedules, habit_occurrences, habit_checkins, checkin_evidence, checkin_reviews, penalties, penalty_allocations, payments, settlements, notifications, activity_logs.
   - Add what is missing. Likely candidates: habit_versions, exemptions, ledger_entries (append-only), reactions, comments, notification_preferences, job_runs, rate_limits, audit_log.
   - State machines for check-in status, penalty status, payment status, invitation status
   - RLS policy matrix: table x role (owner/admin/member/non-member) x operation
   - The migration plan: which migration files, in what order, in which phase
3. 03-business-rules.md
   - Precise, testable rules for: scheduling, period evaluation (daily/weekly/monthly/custom/quantity), grace periods, exemptions, disputes, penalty calculation, equal distribution with rounding, reversals, payment confirmation, commitment locking and versioning, DST handling
   - A worked-examples table I can review (e.g. 5/5 gym sessions = no penalty; 4/5 = penalty; approved exemption = none; Rs 100 across 4 receivers = Rs 25 each; Rs 100 across 3 receivers; job run twice = one penalty)
4. 04-security-threat-model.md
   - Threats and mitigations, at minimum: cross-group data access (IDOR), role escalation, forged penalty amounts or payment status, duplicate penalties through races, replay or public access of cron endpoints, storage URL leakage, invite link/code abuse, a member verifying their own or a friend's check-ins dishonestly, changing timezone to dodge a deadline, reusing the same evidence photo, self-confirming payments, service-role key exposure
5. 05-roadmap.md
   - Phases 1 to 7 with scope, deliverables, tests and acceptance criteria per phase, and which of the 18 pages ship in which phase
6. 06-open-questions.md
   - Every ambiguous product decision, with your recommendation. Start from the defaults table I provide below; add anything I missed.

Also create docs/PROGRESS.md and docs/decisions/ with ADR 001 for the scheduler choice.

When done, give me a short summary (not a repeat of the documents), list the 5 riskiest design decisions, and STOP. Do not start Phase 1 until I approve.

Defaults to start from for 06-open-questions.md:
[paste the table from section 1 here, with any edits]
```

---

## 3. Phase prompts

Each prompt assumes the approved Phase 0 docs. Follow the Definition of Done in CLAUDE.md. Enter Plan Mode first for Phases 2, 3, 4 and 5.

### Phase 1: Project foundation

```text
Start Phase 1 from docs/05-roadmap.md. Create branch phase/1-foundation. Use Plan Mode, show me the plan, then implement after I approve.

Scope:
- Inspect the repo, then scaffold Next.js (App Router, TypeScript strict, Tailwind, ESLint, Prettier) with pnpm
- Install and configure shadcn/ui, lucide-react, next-themes, React Hook Form, Zod
- Design system: dark-by-default theme with optional light, CSS variable tokens, typography scale, base components (button, card, input, dialog, toast, skeleton, badge, avatar, empty-state)
- App shell: desktop sidebar and mobile bottom nav per CLAUDE.md, with placeholder routes
- Landing page (functional, polished, responsive)
- supabase init, local config, @supabase/ssr browser/server/middleware clients, typed env validation (src/lib/env.ts), .env.example
- src/config/brand.ts (configurable product name)
- Folder structure from docs/01-architecture.md
- Vitest configured with one example test; GitHub Actions workflow running typecheck, lint, test
- README with setup steps. Fill in the Commands section of CLAUDE.md.

Out of scope: auth flows, database tables, any business logic.

Acceptance: pnpm dev renders the landing page and shell in dark and light mode at 375px and 1280px; CI is green; fresh clone to running app takes only the README steps.
```

### Phase 2: Database and authentication

```text
Start Phase 2. Branch phase/2-auth. Use Plan Mode first.

Scope:
- Migrations (timestamped SQL files, in dependency order): extensions, enums, shared helpers (updated_at trigger), profiles, groups, group_members, group_invitations as designed in docs/02-database-schema.md. Later tables arrive in the phase that uses them.
- Profile auto-creation on signup (trigger on auth.users), username uniqueness, timezone captured and validated against IANA names
- RLS on every table, helper functions (is_group_member, has_group_role) with pinned search_path
- Auth: email+password signup and login, Google OAuth, forgot/reset password, logout, session refresh, protected routes (middleware plus server-side getUser checks)
- Pages: signup, login, forgot/reset password, onboarding (username, timezone auto-detected, avatar upload to Storage), profile, settings
- seed.sql with 5 users and one group for local development
- pgTAP tests: a user can read/update only their own profile; non-members cannot read group rows; role escalation attempts fail
- Playwright smoke test: signup -> onboarding -> dashboard -> logout

Tell me exactly which manual steps I must do (Google OAuth client, Supabase redirect URLs, email templates). Do not skip OAuth; give me the config values to paste.

Acceptance: all auth flows work locally; pgTAP and Vitest pass; supabase db reset is clean.
```

### Phase 3: Groups and habits

```text
Start Phase 3. Branch phase/3-groups-habits. Use Plan Mode first.

Scope:
- Groups: create, edit, rules configuration (validated against a versioned Zod schema), archive. Pages: group creation, group dashboard, group members, group administration.
- Invitations: shareable link and short code (high-entropy, expiry, optional max uses, revocable), email invite via Resend stub, accept/reject, join via link or code. Abuse limits.
- Membership: owner/admin/member roles, assign admins, remove members, leave group (owner must transfer first), all authorized in RLS and on the server, all audit-logged.
- Habits: migrations for habits, habit_versions, habit_schedules, habit_occurrences. Habit creation wizard (daily, selected weekdays, weekly target, monthly target, quantity-based, custom), habit details page, My Habits page.
- Scheduling engine in src/domain/scheduling: pure functions for period boundaries and occurrence generation in the habit's timezone. Idempotent occurrence generation function with a unique constraint on (habit_id, period_start).
- Commitment locking: active habits cannot be edited in place; edits create a new version effective next period.

Out of scope: check-ins, penalties, notifications.

Tests: Vitest for scheduling (daily, weekdays, weekly, monthly, quantity, DST transitions, month lengths, leap years, timezone snapshot); pgTAP for membership permissions and RLS; generate-twice idempotency test.

Acceptance: a user can create a group, invite a friend who joins, both create habits, and upcoming occurrences exist exactly once.
```

### Phase 4: Accountability

```text
Start Phase 4. Branch phase/4-accountability. Use Plan Mode first.

Scope:
- Migrations: habit_checkins, checkin_evidence, checkin_reviews, exemptions, reactions, comments (and flags/disputes as designed)
- Daily check-in page: all habits due today in the user's timezone, one-tap completion, optional note and photo, quantity entry where relevant, clear status badges
- Evidence: private Storage bucket, upload with type/size limits and EXIF stripping, signed-URL access only for group members
- Verification modes per habit: self-reported, peer review, admin review, evidence-required. Implement the review-window and auto-verify rule from the approved decisions. Users cannot review their own check-ins.
- Disputes: flag suspicious check-in, raise dispute, admin resolution, full history kept
- Exemption requests and admin approval
- Activity feed with Supabase Realtime, reactions and comments
- Pages: daily check-in, activity feed, habit details (history)

Tests: status transition rules (Vitest + pgTAP); self-review blocked; non-members cannot read evidence or feed; late check-in vs grace period; evidence-required habit cannot be verified without evidence.

Acceptance: two users in one group can check in, see each other's activity live, review, flag and resolve a dispute end to end.
```

### Phase 5: Financial engine

```text
Start Phase 5. Branch phase/5-financial-engine. Use Plan Mode first and show me the full function design before writing SQL.

Scope:
- Migrations: penalties, penalty_allocations, ledger_entries (append-only), payments, settlements, audit_log, with triggers blocking UPDATE/DELETE on append-only tables
- Period evaluator in src/domain/evaluation (pure): given occurrence, target, completed quantity, check-in statuses, exemptions, grace/review windows, returns an outcome (met, missed, excused, deferred). Weekly and monthly habits evaluate totals, never individual missed days.
- Postgres function finalize_occurrence (single transaction, idempotent, row-locked): creates the penalty, snapshots eligible members, creates allocations and ledger entries. Unique constraint guarantees one penalty per occurrence. Safe under concurrent calls.
- Equal distribution with deterministic remainder handling. Custom distribution and group pool are designed in the schema but not built.
- Reversal via compensating entries (e.g. a dispute upheld after the fact)
- Manual settlement flow: sender marks sent with reference and optional evidence; recipient confirms or rejects; only confirmation changes balances. Duplicate and self-confirmation prevented. Every action authorized and audit-logged.
- Pages: financial ledger (per-group and overall, who owes whom, pending confirmations, history), payment dialogs with confirmation steps
- Money helper module for integer minor-unit arithmetic and formatting (INR)

Tests (must all exist and pass): 5/5 sessions = no penalty; 4/5 = penalty; approved exemption = none; disputed check-in defers evaluation; Rs 100 across 4 receivers = 25 each; Rs 100 across 3 receivers sums to exactly 100; finalize twice = one penalty; 20 concurrent calls = one penalty; late joiner and leaver cases; payment cannot be completed by the sender; ledger rows cannot be updated or deleted; a user cannot call financial functions for another group.

Acceptance: end-to-end scenario passes in a test: five members, one miss, four allocations, partial payments confirmed and rejected, balances correct to the paisa.
```

### Phase 6: Notifications, scheduled jobs, analytics

```text
Start Phase 6. Branch phase/6-notifications-analytics. Use Plan Mode first.

Scope:
- Migrations: notifications, notification_preferences, job_runs
- Notification service behind a channel interface (in-app and Resend email now; web push stub left clean). Types: daily reminder, upcoming deadline, missed commitment, successful check-in, invitation, new member, disputed check-in, new penalty, payment request, payment confirmation, weekly report. Simple HTML email templates (ask before adding react-email).
- Preferences: per-type toggles, reminder times, email/in-app, all respecting the user's timezone. Pages: notifications, settings.
- Scheduler per ADR 001: secret-protected handler, runs every tick, processes only due work. Jobs: generate upcoming occurrences, send reminders, evaluate ended periods (calls finalize_occurrence), weekly reports. Every job logged to job_runs and idempotent.
- Leaderboard: completion %, current and longest streak, total completed, weekly and monthly consistency, sortable. Never ranks by money.
- Analytics: personal (totals, completion %, weekly/monthly progress, streaks, misses, history) and group (consistency, top members, activity, weekly/monthly trends) with charts
- Personal dashboard assembled from real data

Tests: reminders fire at the right local time across timezones and DST; job run twice = no duplicate notifications, occurrences or penalties; streak calculations including excused days; preference opt-outs honored; cron endpoint rejects requests without the secret.

Acceptance: simulated week with a fake clock produces correct reminders, evaluations, penalties, weekly reports and leaderboard standings.
```

### Phase 7: Production preparation

```text
Start Phase 7. Branch phase/7-production. Use Plan Mode first.

Scope:
- Security review against docs/04-security-threat-model.md: verify every threat has a mitigation and a test. Output docs/security-review.md with findings and fixes.
- RLS coverage matrix: every table x role x operation has a pgTAP test
- API and server-action tests: authorization, validation, rate limits
- Playwright e2e for core flows: signup, create group, invite, join, create habit, check in, review, penalty, payment confirm
- Performance: EXPLAIN the hot queries, add missing indexes, remove N+1 patterns, check bundle size, Realtime subscription cleanup
- Accessibility and responsive pass (375px, 768px, 1280px), light and dark
- Error monitoring and logging approach (ask before adding a service), no PII or secrets in logs
- Deployment: Vercel project, environment variables per environment, Supabase cloud migrations via CLI, cron configuration, database backups, a staging environment
- Docs: deployment guide, runbook (failed job, wrong penalty, stuck payment), env var reference
- Placeholder Terms and Privacy pages, with a note that legal review is needed

Acceptance: staging deployment works end to end; all tests green in CI; I have a launch checklist with remaining risks listed honestly.
```

---

## 4. Handy follow-up prompts

- **Review before merging:** `Review the diff of this branch as a hostile security reviewer and as a senior maintainer. List issues by severity. Do not fix anything yet.`
- **Context reset:** `Update docs/PROGRESS.md with current state, decisions and known gaps so I can /clear and continue.`
- **Stuck on a failing test:** `Explain the root cause first. Do not change the test or loosen a constraint unless you can show the test is wrong.`
- **Scope creep:** `That is out of scope for this phase. Add it to docs/06-open-questions.md as a future item and continue.`
