# HabitCircle Product Specification

## Product Overview

HabitCircle is a **social habit-accountability web app** where friends join groups, commit to habits, check in, and owe each other money when they miss. Money is tracked in a **virtual ledger only** - no payment processing, no custody.

**Visual feel**: Linear × Stripe × modern fitness app

---

## Core Features (Current Status)

### Phase 2 - Authentication & Groups ✅
- [x] User signup/login with email/password and timezone awareness
- [x] Profile creation and editing (username, timezone, theme)
- [x] Group creation with penalty rules, currency, and capacity
- [x] Group membership (join/leave)
- [x] Group invitations (tokenized shareable link & email codes)
- [x] Groups directory page (`/dashboard/groups`)
- [x] Group detail hub with members and habits (`/dashboard/groups/[groupId]`)

### Phase 3 - Habits & Scheduling ✅
- [x] **Habits page** (`/dashboard/habits`) - Filterable by circle with live check-in feed
- [x] Create habit dialog with:
  - Name, Group selection, Frequency (daily/weekly/monthly), Target quantity
- [x] Habits visible to all group members via RLS
- [x] **Group Habits Section** on group detail page with quick in-group habit creation
- [x] Pure TypeScript domain scheduling engine (`src/domain/scheduling.ts`)
- [x] Multi-timezone calculation (IANA names, UTC storage)
- [x] Grace period and review window evaluation

### Phase 4 - Check-ins, Penalties & Ledger ✅
- [x] One-tap check-in with idempotent duplicate prevention
- [x] Peer activity stream showing who checked in on each habit
- [x] Pure domain penalty calculation with deterministic equal-split remainder (`src/domain/penalties.ts`)
- [x] Minor units (paise/cents) integer financial helpers (`src/domain/money.ts`)
- [x] Zero-custody **Financial Ledger** page (`/dashboard/ledger`) with transparent group pot rules

### Phase 5 - Social & Accountability Experience ✅
- [x] Live **Activity Feed** (`/dashboard/activity`) displaying peer check-ins
- [x] **Consistency Leaderboard** (`/dashboard/leaderboard`) ranking members by completion % (never by money)
- [x] **Notification Center** (`/dashboard/notifications`) with unread tracking
- [x] Startup **Landing Page** (`/`) with fintech/SaaS positioning, hero, feature grid, and trust assurances

---

## Technical Architecture

### Stack
- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript strict mode
- **Database**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Styling**: Tailwind CSS, shadcn/ui components, Lucide icons
- **Theming**: Dark/Light/System via `next-themes`
- **Domain Layer**: Pure TypeScript in `src/domain/` (zero I/O, fully tested)
- **Testing**: Vitest (unit tests for domain & utility logic)

### Key Database Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User accounts with timezone |
| `groups` | Habit circles with penalty/currency settings |
| `group_members` | Membership with roles (`owner`, `admin`, `member`) |
| `habits` | Habit definitions |
| `habit_schedules` | Frequency + target quantity |
| `habit_occurrences` | Individual period instances |
| `habit_checkins` | Check-in submissions |
| `penalties` | Money owed for missed habits |
| `penalty_allocations` | How penalties are split among eligible receivers |
| `ledger_entries` | Append-only virtual currency records |
| `notifications` | User notifications |

---

## Verification & Build Status

- [x] `pnpm typecheck` passes with 0 errors
- [x] `pnpm build` passes with clean production bundle
- [x] Domain unit tests cover money, scheduling, penalties, and state transitions
- [x] Responsive layout verified at 375px (mobile) and 1280px+ (desktop)
- [x] Error boundary protection against unhandled React render crashes
