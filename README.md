# HabitCircle

Social habit accountability. Friends form a circle, commit to habits, check in, and owe each other a
small stake when someone misses. Think Linear x Stripe x a fitness app.

> **Money is a virtual ledger only.** There is no payment processing and no custody. The app records who
> owes whom; people settle up outside the app, and only the **recipient's** confirmation completes a payment.

**Status:** pre-release. Suitable for private testing without real money. See [Status](#status-and-known-gaps)
for what is and is not wired up yet.

## How it works

1. Sign up (email confirmation, timezone-aware) and create a **circle** with a stake and a currency.
2. Invite friends by code, shareable link or email.
3. Members create habits (daily, weekly, monthly or custom) and **check in** each period.
4. Missed commitments become penalties, split equally among the other members, recorded in an
   append-only ledger.
5. A leaderboard ranks consistency. It never uses money paid or received.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) |
| UI | Tailwind CSS 3, shadcn/ui-style components (Radix), lucide-react, next-themes (dark by default) |
| Forms | React Hook Form + Zod |
| Backend | Supabase: Postgres, Auth, RLS, SECURITY DEFINER functions. `@supabase/ssr`, no ORM |
| Tests | Vitest (domain and lib), pgTAP (database) |
| Hosting | Vercel |
| Package manager | pnpm |

There is no separate backend service. Server Actions and Route Handlers are thin, and every financial
write goes through a Postgres function that runs in one transaction.

## Getting started

**Prerequisites:** Node.js 20.9+ (required by Next 16), pnpm 9+, and, only if you want a local database,
Docker (Windows: Docker Desktop with WSL2) plus the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
git clone https://github.com/vijayPrajapatii/habitCircle.git
cd habitCircle
pnpm install
cp .env.example .env.local      # then fill in the values below
pnpm dev                        # http://localhost:3000
```

### Environment variables

The app currently reads **three** variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `NEXT_PUBLIC_SITE_URL` | Public origin of the app, used for e-mail confirmation and password-reset links |

`.env.example` also lists `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_*`, `RESEND_API_KEY`,
`SCHEDULER_SECRET` and `NEXT_PUBLIC_APP_NAME`. Those are reserved for planned features and are not read by the
code yet (a Zod schema for them exists in `src/lib/env.ts` but is not wired into startup). The service-role key
must never be exposed to client code or put in a `NEXT_PUBLIC_*` variable. Never commit `.env.local`.

> **Heads-up:** `pnpm dev` talks to whatever Supabase project your `.env.local` points at. If that is a hosted
> project, you are reading and writing its real data. For experiments, point it at a local stack
> (`supabase start`) or a throwaway project.

### Branding

The product name is the `APP_NAME` constant in `src/config/brand.ts`. Components and copy import it, so
renaming the product is a one-line change there.

## Commands

| Task | Command |
|---|---|
| Dev server | `pnpm dev` |
| Production build / serve | `pnpm build` / `pnpm start` |
| Typecheck | `pnpm typecheck` |
| Unit tests (Vitest) | `pnpm test` |
| Lint | `pnpm lint`: **currently broken.** Next 16 removed `next lint` and there is no ESLint config yet, so the CI lint step fails until one is added |
| Start / stop local Supabase | `supabase start` / `supabase stop` |
| Rebuild local DB from migrations + seed | `supabase db reset` (local only) |
| Database tests (pgTAP) | `supabase test db` |
| Regenerate DB types | `supabase gen types typescript --linked > src/types/supabase.ts` (or `--local`) |

## Database

Schema lives in `supabase/migrations/` (`001` to `017`), seed data in `supabase/seed.sql`, pgTAP tests in
`supabase/tests/`.

- **Row-level security is on for every table in `public`.** Clients can read what their group membership
  allows, but membership, penalties, allocations, ledger entries and payments are written **only** by
  SECURITY DEFINER functions (`create_group_with_owner`, `accept_group_invitation`, `record_habit_miss`,
  `record_peer_settlement`, `confirm_payment`, `reject_payment`, ...). See
  [`docs/decisions/002-security-lockdown.md`](docs/decisions/002-security-lockdown.md).
- **The ledger is append-only**: triggers block UPDATE, DELETE and TRUNCATE. Penalty allocations must sum
  exactly to their penalty, and a circle's currency is locked once money exists.
- **Security regression check** (read-only in effect; it runs attack scenarios inside a transaction that always
  rolls back):

  ```bash
  supabase db query --linked -f supabase/verify/security_simulation.sql
  ```

  The expected result is `SIM 44P 0F 0M` (44 pass, 0 fail, 0 masked). The CLI prints it as an error message by design.
- **Do not `supabase db push` to a hosted project whose migration history does not match the files**, since it
  would re-run migrations already applied. Review a migration, then apply it with
  `supabase db query --linked -f <file>`.
- The migration chain `001` to `016` has **not yet been proven to rebuild from an empty database** (see
  [Status](#status-and-known-gaps)); run `supabase db reset` locally before relying on it.

## Money rules

- Amounts are **integer minor units** (paise, cents) in `bigint`/`integer` columns. No floats, and no JS number
  math on money outside the tested helpers in `src/domain/money.ts`.
- Currency is stored per circle (INR, USD, EUR, GBP). There is no conversion.
- Equal split among eligible members (active at period end, excluding the offender), with remainders assigned
  deterministically so allocations always sum exactly to the penalty. The eligible set and amounts are
  snapshotted on the penalty.
- Penalties are never edited or deleted. Reversals are compensating ledger entries.
- Payment flow: sender marks sent, recipient confirms or rejects. The balance owed is derived as allocations
  minus confirmed payments.

## Time rules

Timestamps are stored in UTC (`timestamptz`) and timezones as IANA names. A habit snapshots its timezone when
created, and period boundaries (the daily reset, for example) are computed in that timezone, so changing your
profile timezone does not move the deadlines of active commitments.

## Project structure

```
src/
├── app/                 # Next.js App Router: pages, layouts, API route handlers
├── components/          # UI: shell (sidebar, bottom nav), ui primitives, feature dialogs
├── config/brand.ts      # Product name
├── domain/              # Pure logic, no I/O, no React, no Supabase: money, scheduling,
│                        #   penalties, check-in state machine (fully unit-tested)
├── features/            # Feature modules: actions, queries, schemas
│   ├── auth-profiles/   #   groups/  habits/  invitations/  settlements/
├── lib/                 # Supabase clients, redirect/timezone/username helpers, utils
├── proxy.ts             # Session refresh and route protection (Next 16 "proxy", formerly middleware)
└── types/supabase.ts    # Generated database types
supabase/
├── migrations/          # Forward-only SQL migrations
├── tests/               # pgTAP tests
├── verify/              # Re-runnable security simulation
└── seed.sql
docs/                    # Architecture, schema, business rules, threat model, roadmap, ADRs
```

Rules of thumb: Server Actions and Route Handlers authenticate (`supabase.auth.getUser()`, never
`getSession()` for authorization), validate with Zod, authorize, then call domain code or a database function.
Never trust client-submitted amounts, roles, user ids or group ids.

## Deploying (Vercel)

1. Connect the repository and set the three environment variables above for the environments you use.
2. In Supabase **Authentication > URL Configuration**, set the Site URL to your `NEXT_PUBLIC_SITE_URL` and add
   that origin (for example `https://your-app.vercel.app/**`) to the redirect allow-list, otherwise
   confirmation and password-reset links will not return to the app.
3. In Supabase **Authentication > Passwords**, enable leaked-password protection (a dashboard setting).
4. Apply any new migration to the database **before** deploying code that needs it. Migrations are written to
   stay compatible with the previously deployed code.

## Status and known gaps

Working today: sign-up and login with e-mail confirmation and password reset; circles with stakes and roles;
invitations by code, link and e-mail; habit creation and per-period check-ins in the habit's timezone;
dashboard, activity feed, notifications, consistency leaderboard and a ledger view; dark and light themes;
responsive layout from 375px up.

Not done yet:

- **Penalties are never created automatically.** The penalty and settlement actions exist, but no screen calls
  them and there is no scheduled evaluator job (scheduler choice is still a proposed ADR).
- Weekly and monthly habits still create one occurrence per day instead of accumulating quantity per period.
- Payment confirmation has server actions but no screen.
- No evidence upload, peer or admin verification flow, or e-mail delivery (Resend) yet.
- No audit-log table and no rate limiting on sensitive actions.
- `supabase db reset` and `supabase test db` have not been run against the current migrations, so the pgTAP
  suite is only a table-existence smoke test. No end-to-end (Playwright) tests.
- `pnpm lint` is broken (see Commands), so CI fails at the lint step.

The detailed, current list is in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Docs

| Document | Contents |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Project rules, architecture, domain, money, time and security rules |
| [`docs/01-architecture.md`](docs/01-architecture.md) | Architecture |
| [`docs/02-database-schema.md`](docs/02-database-schema.md) | Database schema |
| [`docs/03-business-rules.md`](docs/03-business-rules.md) | Business rules |
| [`docs/04-security-threat-model.md`](docs/04-security-threat-model.md) | Security threat model |
| [`docs/05-roadmap.md`](docs/05-roadmap.md) | Phased roadmap |
| [`docs/06-open-questions.md`](docs/06-open-questions.md) | Open questions |
| [`docs/decisions/`](docs/decisions) | Architecture decision records |
| [`docs/PROGRESS.md`](docs/PROGRESS.md) | Current state, known gaps, next steps |

## Contributing

- Work in phases (`docs/05-roadmap.md`), one branch per phase: `phase/<n>-<slug>`.
- Use [Conventional Commits](https://www.conventionalcommits.org/) with small, focused commits.
- Before opening a PR: `pnpm typecheck` and `pnpm test` pass; for database changes, a new forward-only
  migration, updated RLS and pgTAP coverage; no secrets in git; `.env.example` updated.
- Never weaken RLS, constraints or tests to make something pass.

## License

MIT
