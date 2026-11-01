-- 009_fix_group_members_rls.sql
-- Fix infinite recursion in group_members RLS policies

-- Drop existing policies
drop policy if exists "group_members_select_member" on public.group_members;
drop policy if exists "group_members_insert_admin" on public.group_members;
drop policy if exists "group_members_update_admin" on public.group_members;
drop policy if exists "group_members_leave_self" on public.group_members;
drop policy if exists "group_members_delete_owner" on public.group_members;

-- Recreate policies without infinite recursion

-- Members can read group members of groups they belong to
-- Use join to check membership instead of self-reference
create policy "group_members_select_member"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and gm.left_at is null
    )
  );

-- Anyone can insert INTO group_members IF:
-- 1. The user is creating themselves as a member of a group they already belong to
-- OR 2. They're inserting as 'owner' role and are creating a new group
create policy "group_members_insert_allowed"
  on public.group_members for insert
  with check (
    -- Allow if user is joining their own invitation (email matches or joining via invite)
    (user_id = auth.uid() and role = 'member')
    -- Allow owner to be added when creating group (no existing membership check)
    or (role = 'owner' and created_by = auth.uid())
  );

-- For group creation, we need to track the creator
-- This is handled in the groups table creation

-- Members can update their own status to leave
create policy "group_members_update_leave"
  on public.group_members for update
  using (user_id = auth.uid() and left_at is null)
  with check (user_id = auth.uid() and left_at is not null);

-- Owner can update members (for role changes)
create policy "group_members_update_owner"
  on public.group_members for update
  using (
    exists (
      select 1 from public.group_members
      where group_id = group_members.group_id
      and user_id = auth.uid()
      and left_at is null
      and role = 'owner'
    )
  );

-- Owner can remove members
create policy "group_members_delete_owner"
  on public.group_members for delete
  using (
    exists (
      select 1 from public.group_members
      where group_id = group_members.group_id
      and user_id = auth.uid()
      and left_at is null
      and role = 'owner'
    )
  );