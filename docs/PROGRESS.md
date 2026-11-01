# Phase 2: Database and Authentication - IN PROGRESS

**Status**: In Progress
**Branch**: phase/2-auth (conceptual)

## What has been implemented

### Database Migrations
- ✅ 001_extensions_and_enums.sql - Extensions (uuid-ossp, pgcrypto, pg_trgm), enums (user_role, invitation_status, habit_frequency, checkin_status, verification_mode, penalty_status, payment_status, notification_type), updated_at trigger
- ✅ 002_profiles.sql - Profiles table with username, timezone, avatar, RLS policies, auto-creation trigger on auth signup
- ✅ 003_groups.sql - Groups and group_members tables, helper functions (is_group_member, has_group_role), RLS policies
- ✅ 004_invitations.sql - Group invitations with codes/links, create/accept functions, abuse limits, RLS policies

### Supabase Configuration
- ✅ supabase/config.toml - Local development config
- ✅ supabase/.env - Local environment variables
- ✅ supabase/seed.sql - Development seed data template
- ✅ supabase/tests/test_auth_groups.pgtap.sql - pgTAP tests for auth and groups

### Auth Actions (Server Actions)
- ✅ signUp - Email/password signup with username metadata
- ✅ signIn - Email/password sign in
- ✅ signOut - Sign out
- ✅ resetPassword - Password reset email
- ✅ updatePassword - Update password

### Group Actions
- ✅ createGroup - Create group with penalty, currency, timezone, max members
- ✅ updateGroup - Update group settings
- ✅ archiveGroup - Archive group (owner only)
- ✅ leaveGroup - Leave group (with owner transfer check)

### Invitation Actions
- ✅ createInvitation - Create invite with code/link, max uses, expiry, optional email restriction
- ✅ revokeInvitation - Revoke pending invitation
- ✅ acceptInvitation - Accept invite by code or link token

### Auth Pages
- ✅ /login - Sign in with email/password, Google OAuth button
- ✅ /signup - Sign up with username, email, password
- ✅ /forgot-password - Password reset request
- ✅ /reset-password - Password reset with token validation
- ✅ /onboarding - Username, timezone (auto-detected), avatar upload

### Group Pages
- ✅ /dashboard/groups - List groups, create group dialog, invite dialog
- ✅ /dashboard/groups/[groupId] - Group detail page with Habits section (all members can view habits)
- ✅ /invite/accept - Accept invitation by code or link token

### Habits Feature
- ✅ `src/features/habits/` - Created actions, schemas, types
- ✅ `/dashboard/habits` - Habits list page with create habit dialog
- ✅ Habits are visible to all group members (RLS policy: habits_select_member)

### UI Cleanup (Phase 2 focus)
- Changed navigation labels: "My Groups" → "Groups", "My Habits" → "Habits"
- Added full navigation menu to sidebar (Activity Feed, Leaderboard, Financial Ledger, Notifications)
- Created new profile page at /dashboard/profile with editable fields
- Updated Settings page to be a proper settings page (not disabled inputs)
- Updated bottom navigation for mobile (Home, Groups, Habits, Profile)
- Built full profile editing functionality with timezone select, save button, theme toggle
- Added Profile and Settings as separate user section items in sidebar

### Completed / Verified
- [x] Build verification - `npm run build` passes (TypeScript, compilation, static generation)
- [x] Fixed TypeScript errors in dashboard/page.tsx and habits/actions.ts
- [x] Fixed Habit interface to make occurrences optional (fixes type safety)
- [x] Fixed RLS policy bugs in migrations 009 and 012
- [x] Added migrations 013_fix_group_members_rls.sql and 014_finalize_rls_fixes.sql

### RLS Fix Summary
The issue was that the group creation flow requires two INSERT operations:
1. INSERT into `groups` table (needs `groups_insert_authenticated` policy)
2. INSERT into `group_members` table (needs `group_members_insert_self` policy)

The fix:
- Migration 012: `groups_insert_authenticated` allows any authenticated user to create groups
- Migration 009 (updated): `group_members_insert_self` allows users to add themselves as members
- Migration 014: Finalizes all RLS policies for group creation flow

### Mobile UI Improvements (safe-ui-edit)
- ✅ Added xs breakpoint (375px) to tailwind.config.ts for 375px viewport support
- ✅ Updated dashboard/layout.tsx - improved mobile grid layout
- ✅ Updated dashboard/page.tsx - responsive stats grid, compact habit rows, mobile-friendly typography
- ✅ Updated groups/page.tsx - responsive buttons, touch-friendly cards, mobile-optimized empty state
- ✅ Updated habits/page.tsx - responsive form layouts, mobile action buttons, truncated text for overflow
- ✅ Added mobile-friendly CSS improvements (line clamp, truncate utilities)
- Build passes: `pnpm build` ✓

### Pending / Next Steps
- [ ] Run `supabase start` and `supabase db reset` to apply migrations
- [ ] Run `supabase gen types` to generate TypeScript types
- [ ] Create group detail page (/dashboard/groups/[id])
- [ ] Create group settings page
- [ ] Create member management UI (role changes, remove)
- [ ] Google OAuth configuration (Supabase dashboard)
- [ ] Email templates (Supabase auth settings)
- [ ] Storage bucket for avatars
- [ ] Playwright smoke test: signup -> onboarding -> dashboard -> logout

## To Complete Phase 2

1. Start Docker Desktop
2. Run `pnpm install` (if not done)
3. Run `supabase start`
4. Run `supabase db reset`
5. Configure Google OAuth in Supabase dashboard
6. Set up email templates in Supabase
7. Create avatars storage bucket
8. Run `supabase gen types` 
9. Test auth flows end-to-end

## Next: Phase 3 - Groups and Habits
Once auth and groups are fully working, Phase 3 will add:
- Habit creation wizard (daily, weekly, monthly, quantity, custom)
- Habit scheduling engine (domain logic)
- Habit occurrences generation
- Commitment locking with versioning
- My Habits page