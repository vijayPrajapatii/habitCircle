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
- ✅ /invite/accept - Accept invitation by code or link token

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