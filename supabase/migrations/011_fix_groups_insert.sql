-- 011_fix_groups_insert.sql
-- Fix for group creation INSERT policy

-- Update the groups INSERT policy to be more permissive for creation
drop policy if exists "groups_insert_authenticated" on public.groups;

create policy "groups_insert_authenticated"
  on public.groups for insert
  with check (auth.uid() is not null and created_by = auth.uid());

-- Drop the problematic group_members_insert_admin policy
drop policy if exists "group_members_insert_admin" on public.group_members;

-- Create a simpler, non-recursive policy
create policy "group_members_insert_allowed"
  on public.group_members for insert
  with check (
    user_id = auth.uid()
  );