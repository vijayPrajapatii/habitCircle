# HabitCircle Progress & Milestone Tracker

**Current Phase**: Phase 3 & 4 (Habits, Scheduling Engine, Financial Ledger & Polish)
**Build Status**: ✅ `pnpm typecheck`, `pnpm test` (70 tests) and `pnpm build` pass. ❌ `pnpm lint` is broken (see below).
**Deployment Status**: Database: migration 017 is APPLIED to production (2026-11-14) and verified. App code on `fix/bug-sweep` is NOT deployed yet and not committed; until it is, the live site runs the old code against the new database (compatible, except signed-out visitors opening an invite link see a plain permission error instead of being sent to login).

---

## Production database findings and fix (migration 017: APPLIED and verified)

Read-only inspection of the live Supabase project (catalog + counts only; no user data read, no writes) on 2026-11-14:
8 users, 4 groups, 10 invitations, **0 penalties / ledger entries / payments**. Migrations 005–016 were applied by hand
(the history table lists only 001–004). Verified live: any signed-in user can insert themselves as owner of any group;
with only the public anon key all 10 invitation codes and all 8 profiles are readable; clients can write penalties,
allocations, ledger rows and `confirmed` payments; anon can execute every SECURITY DEFINER RPC.

`supabase/migrations/017_security_lockdown.sql` + `docs/decisions/002-security-lockdown.md` fix these (forward-only,
idempotent). **Status: applied to production by the owner on 2026-11-14 with `supabase db query --linked -f`.**

Evidence (all run against production inside transactions that always roll back, so nothing was saved):
`supabase/verify/security_simulation.sql` creates fixture users/groups/habits, runs 44 attack and happy-path checks as
`anon` / `authenticated` users, then raises an error carrying the result. Before 017: 14 pass, 22 FAIL, 1 masked
(M1 self-insert as owner, M3 stranger deletes another group's owner, S1/S2 anon reads invitations and profiles,
P1/P3/P4/P5 direct writes to penalties/ledger/payments, C1 `verified` check-in, G1-G4 privileges, ...). After 017 and
again after applying it for real: **44 pass, 0 fail, 0 masked**. Re-run any time (read-only in effect):
`supabase db query --linked -f supabase/verify/security_simulation.sql` (expected result `SIM 44P 0F 0M`; the CLI shows it
as an error message by design). The CLI truncates error text near 1000 characters, hence the compact format.
All 10 invitations that existed were already expired, so the world-readable codes were not usable at the time.
`supabase db advisors --linked --type security` after applying: the anon-executable and mutable-search_path warnings are
gone. Remaining by design/known: signed-in users can execute the app's own RPCs and the policy helpers, `pg_trgm` in
`public`, leaked-password protection disabled (dashboard setting: Authentication → Passwords).

Open follow-ups: reconcile the migration history table (`supabase migration repair --status applied 005 ... 017`,
needs the owner's approval); deploy the matching app code.

App-side changes already in the branch (typecheck/tests/build green): `middleware.ts` → `proxy.ts` (Next 16),
login honours a validated `redirectTo` (`src/lib/redirect.ts`, tested), `/invite/accept` sends signed-out users to login
and back and is no longer double-fired in strict mode, reset-password works with PKCE links (was always "Invalid link"),
duplicate-username sign-up message, invitation actions validate/clamp input and revoke reports a no-op, non-atomic
client fallbacks for penalties/payments removed, `confirmPayment`/`rejectPayment` server actions added (no UI yet),
legacy `/dashboard/groups/[groupId]/invite` now redirects, duplicate `package-lock.json` removed, CLAUDE.md "Commands"
filled in.

---

## Bug & Responsiveness Sweep (branch `fix/bug-sweep`)

Scope: no new features; fix bugs, make every screen responsive. UI/logic fixes are done and verified;
database / RLS / money / auth fixes are written (above) and waiting for the dry-run + apply step.

### Fixed (verified)
- **Check-in status never loaded**: `schedule:habit_schedules(...)` arrives as an array, so `habit.schedule.id` was
  undefined and every habit showed no check-ins, "daily" and "target 1x". Rows are now normalised (`normalizeHabitRow`).
- **Stale "Checked in" on a new day / wrong day boundary**: current period was compared as strings
  (`+00:00` vs `Z`, never equal) and computed in UTC. It is now computed in the habit's own timezone via
  `getCurrentDailyPeriod` (daily reset at the habit's midnight, e.g. IST, not 05:30 IST) and compared as instants.
- **Dashboard** embedded `habit_occurrences` under `habits` (invalid relation, error swallowed → always "No habits yet")
  and tested occurrence status `'verified'` (impossible per CHECK). Rebuilt on `getUserHabits()`.
- Error boundary reset on navigation (one crash no longer breaks every dashboard page until reload).
- Error states with retry on Dashboard, Habits, Circles, Circle detail, Ledger, Leaderboard, Activity, Notifications.
- Circle detail: members who left were still listed (`left_at` not selected); non-admins saw an invite form that always failed.
- Ledger: hard-coded "Good Standing", stakes of different currencies summed under one symbol, "Verified" label on
  merely-submitted check-ins. Leaderboard: counted only `submitted`, score capped at 100% after one check-in (now completion rate).
- Notifications: removed fabricated "unread" notifications; read state is now persisted; rows are keyboard-accessible.
- Money display/parse: `₹100.50` no longer rounds to `₹101`; no float math (`parseMajorUnits`, `formatMoneySafe`).
- Login: "Resend verification" button also submitted the login form. Habit/circle creation: validation + rollback of a
  habit left without a schedule. Currency restricted to supported list server-side. Circle capacity can't drop below member count.
- Responsive/a11y: sticky desktop sidebar, drawer ESC + scroll lock + hidden-when-closed (the ESC handler documented
  earlier did not exist), Habits header overflow at 375px (New Habit button was off-screen), 40–44px touch targets,
  `viewport-fit=cover`, missing favicon 404s, AA contrast for error text (was ~2:1 in dark theme) and light-theme status colours.
- Verified with headless Chrome against a local fake Supabase: 14 pages × 375/768/1280px, happy / empty / error data:
  0 horizontal overflow, 0 crashes, 0 console errors.

### Known gaps / blockers (not fixed yet)
- **RLS / money holes are live in production** until 017 is applied (see the section above).
- **Migrations are unverified from scratch**: Docker/WSL is not installed yet, so `supabase db reset` and `supabase test db`
  have not been run (Definition of Done items 2 and 3 are open). Static review suspects 010 re-creates a policy 009 created
  and 008 drops/recreates `group_invitations` with a different schema than 004/014/015 expect. Production differs from the
  repo chain (e.g. `handle_new_user` was patched by hand to read `raw_user_meta_data`), so the chain may not reproduce
  production. Consider a squashed baseline migration once Docker works.
- **No pgTAP behavioural tests for 017 yet** (only table-exists smoke tests): they must be written and run together with the
  local stack, not shipped unrun.
- **No audit log table** for financial/role-changing actions (CLAUDE.md requires one); no rate limiting on sensitive actions.
- Supabase advisor leftovers after 017: `pg_trgm` in `public`, leaked-password protection is off (dashboard setting),
  helper functions `is_group_member`/`has_group_role` remain callable by signed-in users (membership oracle).
- **Penalty / settlement flow is not wired to any screen** (`recordHabitFailure`, `getCircleSettlements`, `SettleUpDialog`
  are unused), so no penalty is ever created and the Ledger shows check-in-derived data. No evaluation job exists.
- Weekly/monthly habits still create one occurrence per day (no per-period quantity accumulation); needs an RPC.
- `pnpm lint` fails: Next 16 removed `next lint` and there is no ESLint config; CI runs it.
- `src/types/supabase.ts` was regenerated from production (`supabase gen types typescript --linked`), but no Supabase client
  uses it yet (clients are untyped, hence the `as any` casts). Adopting `createClient<Database>()` is a separate refactor.
- Primary button contrast is 3.4:1 (white on blue); needs a design decision.
- `/onboarding` is orphaned. Payment confirmation has server actions (`confirmPayment`/`rejectPayment`) but no screen yet.
- Penalty `status` is no longer flipped to `paid` by settlements; balances are allocations minus confirmed payments.

---

## Executive Summary

HabitCircle has evolved from a functional prototype into an end-to-end, startup-ready social habit accountability web application. The core user loop is complete:
1. Users register / authenticate with timezone awareness.
2. Users form private accountability groups with customizable stakes and currencies (INR, USD, EUR, GBP).
3. Members invite peers via private invite codes and direct shareable link tokens.
4. Members commit to habits with daily, weekly, or monthly cadences.
5. Daily check-ins are recorded with peer activity visibility.
6. Missed commitments flow through a zero-custody financial ledger using deterministic equal-split integer math.
7. Members track consistency on a fair-play leaderboard (no ranking by money).

---

## Architectural Milestones Completed

### 1. Pure Domain Layer (`src/domain/`)
- ✅ `src/domain/money.ts`: Integer minor units (paise/cents) precision math. Formatter, parser, deterministic equal-split with remainder allocation to first N receivers sorted by UUID.
- ✅ `src/domain/scheduling.ts`: Pure period boundary calculations (daily, weekly, monthly) using `Intl.DateTimeFormat` across any IANA timezone. Grace period and review window evaluation.
- ✅ `src/domain/penalties.ts`: Deterministic penalty calculations and immutable penalty snapshots.
- ✅ `src/domain/checkin-state.ts`: Strict state machine transitions for check-ins, penalties, and payment lifecycles.
- ✅ Full unit test suite (`src/domain/*.test.ts`).

### 2. Dashboard Experience (`/dashboard`)
- ✅ **Clean Data**: Removed all placeholder/hardcoded metrics (e.g. fake "Streak 7"). Replaced with live active habit counts, completion rates, and circle counts.
- ✅ **Dynamic Greeting**: Time-aware greeting and human-readable date.
- ✅ **Today's Priorities**: Habits divided into pending vs. completed for immediate clarity.
- ✅ **Zero State Handling**: Contextual onboarding for users with 0 groups or 0 habits.
- ✅ **Skeleton Loaders**: Zero layout-shift animated skeletons replace generic spinners.

### 3. Groups & Circles (`/dashboard/groups`, `/dashboard/groups/[groupId]`)
- ✅ **Interactive Creation Modal**: Create circles with custom name, description, penalty stake, currency, and capacity.
- ✅ **Group Detail Hub**:
  - Live group habits section with in-circle check-in and deletion controls.
  - Quick "New Habit" modal pre-bound to current group.
  - Member directory with role badges (`owner`, `admin`, `member`) and avatar initials.
  - Private tokenized invite generation with clipboard copy toast notification.
  - Group deletion and rename with confirmation dialogs.

### 4. Habits & Check-ins (`/dashboard/habits`)
- ✅ **Circle Filter**: Dropdown filter for viewing habits across specific groups or all circles.
- ✅ **Check-in Engine**: One-tap check-in with idempotent prevention of duplicate entries.
- ✅ **Peer Activity Feed**: Live check-in log per habit showing member username and verification status.
- ✅ **Habit Creator Permissions**: Creator-only controls for check-in and deletion with confirmation.

### 5. Financial Ledger & Transparency (`/dashboard/ledger`)
- ✅ **Zero-Custody Architecture**: Clear legal & financial clarity: virtual ledger tracking peer obligations without holding funds.
- ✅ **Active Exposure Metrics**: Total stakes committed across circles.
- ✅ **Equal-Split Transparency**: Explicit breakdown of per-receiver payouts for every group.
- ✅ **Transaction Stream**: Ledger event history for completed and missed commitments.

### 6. Activity Feed & Social Accountability (`/dashboard/activity`)
- ✅ Aggregated live feed of check-ins and commitments across all groups the user belongs to.
- ✅ Timestamped activity badges.

### 7. Consistency Leaderboard (`/dashboard/leaderboard`)
- ✅ **Fair Play Rule Enforcement**: Strictly ranks members by completion percentage and verified check-ins (never by financial balance).
- ✅ Top 3 podium display + circle standings table.

### 8. Settings & Profile (`/dashboard/settings`, `/dashboard/profile`)
- ✅ Reactive profile editing (display username, IANA timezone select).
- ✅ Theme switcher integration (Dark, Light, System) via `next-themes`.
- ✅ Password reset and session sign-out actions.

### 9. Startup Landing Page (`/`)
- ✅ High-converting fintech/SaaS landing page with hero, value proposition, feature grid, trust badges, and navigation CTA.

### 10. Mobile Responsiveness & Phone Compatibility (375px+)
- ✅ **Mobile Navigation Suite**:
  - `MobileTopBar`: Clean sticky header with brand mark, notification shortcut, and mobile drawer trigger.
  - `Sidebar` Drawer: Sliding responsive drawer with dimmed backdrop and ESC key listener; eliminates the intrusive floating button that previously overlapped cards.
  - `BottomNav`: Fixed 5-tab navigation bar with touch optimization, active indicator states, safe area insets (`env(safe-area-inset-bottom)`), and responsive labels.
- ✅ **Touch ergonomics & iOS polish**:
  - Form controls set to minimum 16px font-size on `<640px` viewports, preventing iOS Safari auto-zoom on input focus.
  - Minimum 44px touch targets on all interactive buttons and navigation elements.
  - `-webkit-tap-highlight-color: transparent` and `overflow-x: hidden` preventing awkward horizontal shifts.
- ✅ **Viewport Optimization**:
  - Dashboard stats dynamically wrap (3rd metric spans 2 columns on 2-col phone screens).
  - Modals and dialogs adapt cleanly to `w-[calc(100%-1.5rem)]` on mobile.
  - Leaderboard podium scales to a compact 3-column mobile layout.
  - Ledger zero-custody banner and group detail action buttons stack gracefully.

### 11. Quality & Reliability
- ✅ Error Boundary wrapper (`src/components/error-boundary.tsx`) preventing unhandled UI crashes.
- ✅ Toast system active via `<Toaster />` in `src/components/providers.tsx`.
- ✅ Responsive testing across mobile (375px) and desktop (1280px+).
- ✅ `pnpm typecheck` passed (0 errors).
- ✅ Vitest unit suite passed (45/45 tests green).
- ✅ `pnpm build` passed (all routes compiled cleanly).

### 12. Settlement & Debt Resolution (Recent Completion)
- ✅ **Settle Up Dialog** (`src/components/settlements/settle-up-dialog.tsx`):
  - UI for recording peer-to-peer settlements
  - Multiple payment methods (UPI, Cash, Bank Transfer, PayPal, Other)
  - Amount input with currency prefix
  - Transaction reference/note field
- ✅ **Settlements Actions** (`src/features/settlements/actions.ts`):
  - `getCircleSettlements`: Fetch debt/credit overview for peers
  - `recordSettlement`: Record peer payment with atomic RPC fallback
  - Ledger entries for audit trail
  - Automatic penalty marking as paid when settlement confirmed
- ✅ **Migration 016**: RLS policies and RPC functions for:
  - `record_habit_miss`: Atomic penalty creation on habit miss
  - `record_peer_settlement`: Atomic payment recording
  - Proper access controls for penalties, allocations, ledger, payments
- ✅ **Edit Group Stakes Dialog** (`src/components/groups/edit-group-stakes-dialog.tsx`):
  - Owner-only circle settings edit
  - Edit name, description, penalty amount, currency, max members
  - Visual transparency about equal-split penalty distribution
- ✅ **Habit Creation Improvements**:
  - `custom_cron` metadata support for advanced scheduling
  - Timezone-aware habit creation
  - Better frequency options (daily, weekly, monthly, quantity, custom)
- ✅ **Check-in Status Fix**:
  - Habits page now correctly shows current period check-in status
  - Prevents false "Checked in" states from previous periods

---

## Verification Commands
```powershell
# Type verification
pnpm typecheck

# Unit testing
pnpm test

# Production build
pnpm build
```

---

## Roadmap Next Steps for Deployment

1. **Supabase Production Provisioning**:
   - Apply migrations to remote Supabase project (`supabase db push` or SQL Editor).
   - Configure Auth Redirect URLs for production domain in Supabase Dashboard.
   - Set up Resend API key for outbound invite and reminder emails.
2. **Vercel Deployment**:
   - Connect GitHub repository to Vercel.
   - Configure environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXT_PUBLIC_SITE_URL`
3. **pg_cron / Evaluator Scheduler**:
   - Configure scheduled evaluation endpoint with secret key authentication.
