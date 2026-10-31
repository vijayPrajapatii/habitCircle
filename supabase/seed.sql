-- seed.sql
-- Development seed data for local testing

-- Note: This runs after auth.users are created via Supabase Auth
-- Run this after creating test users through the signup flow

-- Example: Create test profiles (run after manual signup)
-- insert into public.profiles (id, username, full_name, timezone)
-- values
--   ('00000000-0000-0000-0000-000000000001', 'alice', 'Alice Johnson', 'America/New_York'),
--   ('00000000-0000-0000-0000-000000000002', 'bob', 'Bob Smith', 'America/Los_Angeles'),
--   ('00000000-0000-0000-0000-000000000003', 'carol', 'Carol Williams', 'Europe/London'),
--   ('00000000-0000-0000-0000-000000000004', 'dave', 'Dave Brown', 'Asia/Tokyo'),
--   ('00000000-0000-0000-0000-000000000005', 'eve', 'Eve Davis', 'Australia/Sydney')
-- on conflict (id) do update set
--   username = excluded.username,
--   full_name = excluded.full_name,
--   timezone = excluded.timezone;

-- Example group (replace with actual user IDs)
-- insert into public.groups (id, name, description, penalty_amount, currency, timezone, max_members, created_by)
-- values
--   ('11111111-1111-1111-1111-111111111111', 'Morning Runners', 'Daily 5km run group', 5000, 'INR', 'America/New_York', 10, '00000000-0000-0000-0000-000000000001');

-- Example group members
-- insert into public.group_members (group_id, user_id, role)
-- values
--   ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'owner'),
--   ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'member'),
--   ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'member'),
--   ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', 'member'),
--   ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'member');

-- Example invitation (replace with actual IDs)
-- select public.create_group_invitation(
--   '11111111-1111-1111-1111-111111111111',
--   '00000000-0000-0000-0000-000000000001',
--   5, -- max uses
--   '7 days'
-- );