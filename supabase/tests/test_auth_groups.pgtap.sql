-- pgTAP tests for profiles, groups, group_members, group_invitations
-- Run with: supabase test db

begin;

select plan(12);

-- Test 1: profiles table exists
select has_table('public', 'profiles', 'profiles table exists');

-- Test 2: profiles has required columns
select has_column('public', 'profiles', 'id', 'profiles has id column');
select has_column('public', 'profiles', 'username', 'profiles has username column');
select has_column('public', 'profiles', 'timezone', 'profiles has timezone column');

-- Test 3: profiles has username unique constraint
select has_unique_constraint('public', 'profiles', 'username', 'profiles has unique username');

-- Test 4: profiles RLS enabled
select has_rls_enabled('public', 'profiles', 'profiles has RLS enabled');

-- Test 5: groups table exists
select has_table('public', 'groups', 'groups table exists');

-- Test 6: group_members table exists
select has_table('public', 'group_members', 'group_members table exists');

-- Test 7: group_invitations table exists
select has_table('public', 'group_invitations', 'group_invitations table exists');

-- Test 8: helper functions exist
select has_function('public', 'is_group_member', array['uuid', 'uuid'], 'is_group_member function exists');
select has_function('public', 'has_group_role', array['uuid', 'uuid', 'user_role[]'], 'has_group_role function exists');
select has_function('public', 'create_group_invitation', array['uuid', 'uuid', 'integer', 'interval', 'text'], 'create_group_invitation function exists');
select has_function('public', 'accept_group_invitation', array['text', 'uuid'], 'accept_group_invitation function exists');

select * from finish();
rollback;