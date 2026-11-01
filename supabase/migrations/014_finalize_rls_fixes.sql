-- 014_finalize_rls_fixes.sql
-- Final RLS policy fixes for group creation flow
--
-- PROBLEM: Users cannot create groups due to RLS policy issues
--
-- SOLUTION: These policies allow the group creation flow:
-- 1. User creates group (INSERT to groups) - requires groups_insert_authenticated
-- 2. User becomes owner of group (INSERT to group_members) - requires group_members_insert_self
--
-- These policies are applied in order through migrations 009-012, but this migration
-- ensures they're in the correct final state.

-- Ensure groups INSERT policy allows any authenticated user
drop policy if exists "groups_insert_authenticated" on public.groups;
create policy "groups_insert_authenticated"
  on public.groups for insert
  with check (auth.uid() is not null);

-- Ensure group_members INSERT policy allows users to add themselves
drop policy if exists "group_members_insert_self" on public.group_members;
create policy "group_members_insert_self"
  on public.group_members for insert
  with check (user_id = auth.uid());

-- Ensure group_members SELECT policies work correctly
drop policy if exists "group_members_select_member" on public.group_members;
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