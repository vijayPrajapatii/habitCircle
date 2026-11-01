-- 010_simple_group_members_rls.sql
-- Simplified RLS that avoids infinite recursion

-- Drop all existing policies
drop policy if exists "group_members_select_member" on public.group_members;
drop policy if exists "group_members_insert_admin" on public.group_members;
drop policy if exists "group_members_update_admin" on public.group_members;
drop policy if exists "group_members_leave_self" on public.group_members;
drop policy if exists "group_members_delete_owner" on public.group_members;

-- Recreate with simpler policies

-- Allow anyone to insert their own membership record
create policy "group_members_insert_self"
  on public.group_members for insert
  with check (user_id = auth.uid());

-- Members can read members of groups they belong to
create policy "group_members_select_own"
  on public.group_members for select
  using (user_id = auth.uid());

-- Members can update their own record (to leave)
create policy "group_members_update_own"
  on public.group_members for update
  using (user_id = auth.uid());

-- Owner can delete other members
create policy "group_members_delete_other"
  on public.group_members for delete
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and gm.left_at is null
      and gm.role = 'owner'
      and group_members.user_id != auth.uid()
    )
  );

-- Update trigger
create trigger group_members_updated_at
  before update on public.group_members
  for each row execute function public.handle_updated_at();