# HabitCircle Product Specification

## Product Overview

HabitCircle is a **social habit-accountability web app** where friends join groups, commit to habits, check in, and owe each other money when they miss. Money is tracked in a **virtual ledger only** - no payment processing, no custody.

**Visual feel**: Linear × Stripe × modern fitness app

## Core Features (In Progress / Upcoming)

### Phase 2 - Authentication & Groups ✅
- [x] User signup/login with email/password
- [x] Profile creation (username, timezone, avatar)
- [x] Group creation with penalty rules
- [x] Group membership (join/leave)
- [x] Group invitations (by code and email)
- [x] Groups page - list all user's groups
- [x] Group detail page - shows members and habits

### Phase 3 - Habits & Scheduling (Current Focus)
- [x] **Habits page** (`/dashboard/habits`) - List all user's habits
- [x] Create habit dialog with:
  - Name, Group selection, Frequency (daily/weekly/monthly), Target quantity
- [x] Habits visible to ALL group members via RLS
- [ ] **Group Habits Section** on group detail page
- [ ] Habit occurrences generation (scheduler - pg_cron)
- [ ] Habit editing (creates new version, doesn't modify existing)
- [ ] Commitment locking (active commitments locked, edits create new versions)

### Phase 4 - Check-ins & Penalties (Next)
- [ ] Check-in form for submitting habit completions
- [ ] Evidence upload (photos, screenshots)
- [ ] Verification system (self-reported, peer review, admin review)
- [ ] Penalty calculation when habits are missed
- [ ] Penalty allocation (equal split among eligible members)
- [ ] Ledger entries for all penalties

### Phase 5 - Payments & Notifications (Later)
- [ ] In-app notification system (realtime via Supabase)
- [ ] Email notifications (via Resend)
- [ ] Payment confirmation flow
- [ ] Leaderboard (excludes money metrics)

---

## Technical Architecture

### Stack
- **Frontend**: Next.js 15 (App Router), React, TypeScript strict mode
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS, shadcn/ui components
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Testing**: Vitest (unit), pgTAP (database), Playwright (e2e)

### Key Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User accounts with timezone |
| `groups` | Habit groups with penalty/currency settings |
| `group_members` | Membership with role (owner/admin/member) |
| `habits` | Habit definitions |
| `habit_schedules` | Frequency + target quantity |
| `habit_occurrences` | Individual period instances |
| `habit_checkins` | Check-in submissions |
| `penalties` | Money owed for missed habits |
| `penalty_allocations` | How penalties are split |
| `ledger_entries` | Virtual currency records |
| `payments` | Pending/confirmed/rejected payments |

---

## Example User Stories

### Story 1: Create a Habit
```
As a group member
I want to create a daily habit in my group
So that I can track my consistency

Given I'm logged in and in at least one group
When I go to /dashboard/habits and click "New Habit"
And fill in: Name="Morning Run", Group="Fitness Buddies", Frequency="Daily", Target="1"
And submit the form
Then the habit appears in my habits list
And all group members can see it
```

### Story 2: View Habits in Group
```
As any group member
I want to see all habits in my group
So I know what we're all tracking

Given I'm a member of "Fitness Buddies" group
When I go to /dashboard/groups/{groupId}
And scroll to the Habits section
Then I see all habits in that group
With their names and frequencies
```

---

## API Endpoints Needed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/habits/create` | POST | Create new habit |
| `/api/habits/[id]/checkins` | POST | Submit check-in |
| `/api/payments/create` | POST | Create pending payment |
| `/api/payments/[id]/confirm` | POST | Confirm payment |
| `/api/invitations/[code]` | POST | Accept invitation |

---

## UI Components to Build

### Already Built
- Sidebar (desktop navigation)
- BottomNav (mobile navigation)
- Group list page
- Group detail page (members + habits)
- Habits list page
- Settings page

### Pending
- Check-in form component
- Habit detail view
- Payment confirmation modal
- Notification center
- Leaderboard page

---

## Database Migrations Status

| File | Status | Description |
|------|--------|-------------|
| 001 | ✅ | Extensions and enums |
| 002 | ✅ | Profiles table |
| 003 | ✅ | Groups and group_members |
| 004 | ✅ | Invitations |
| 006 | ✅ | Habits, schedules, occurrences |
| 007 | ✅ | Penalties, ledger |
| 008 | ✅ | Notifications |
| 009 | ✅ | RLS fixes for group creation |
| 011 | ✅ | Final RLS fixes |
| 013 | ✅ | Group members RLS |
| 014 | ✅ | Final RLS cleanup |

---

## Testing Requirements

Following CLAUDE.md Definition of Done:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] `supabase db reset` applies migrations cleanly
- [ ] pgTAP tests for tables/functions touched
- [ ] No secrets in git
- [ ] `.env.example` updated