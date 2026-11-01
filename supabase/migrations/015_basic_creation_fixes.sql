-- Basic creation flow fixes

-- The membership read policy must not query group_members through its own RLS policy.
drop policy if exists "group_members_select_member" on public.group_members;
drop policy if exists "group_members_select_self" on public.group_members;
create policy "group_members_select_self"
  on public.group_members for select
  using (user_id = auth.uid());

-- Group admins may create schedules for habits in their groups.
create policy "habit_schedules_insert_admin"
  on public.habit_schedules for insert
  with check (
    exists (
      select 1
      from public.habits h
      join public.group_members gm on gm.group_id = h.group_id
      where h.id = habit_schedules.habit_id
        and gm.user_id = auth.uid()
        and gm.left_at is null
        and gm.role in ('owner', 'admin')
    )
  );

-- Owners may delete their groups. Related records cascade through foreign keys.
drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_delete_owner"
  on public.groups for delete
  using (
    exists (
      select 1
      from public.group_members gm
      where gm.group_id = groups.id
        and gm.user_id = auth.uid()
        and gm.left_at is null
        and gm.role = 'owner'
    )
  );

-- Create the group and its owner membership in one transaction.
create or replace function public.create_group_with_owner(
  p_name text,
  p_description text,
  p_penalty_amount integer,
  p_currency text,
  p_timezone text,
  p_max_members integer
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_group public.groups;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.groups (name, description, penalty_amount, currency, timezone, max_members, created_by)
  values (p_name, p_description, p_penalty_amount, p_currency, p_timezone, p_max_members, v_user_id)
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_user_id, 'owner');

  return v_group;
end;
$$;

revoke all on function public.create_group_with_owner(text, text, integer, text, text, integer) from public;
grant execute on function public.create_group_with_owner(text, text, integer, text, text, integer) to authenticated;

-- Fix enum-array type resolution in the existing invitation RPC.
create or replace function public.create_group_invitation(
  p_group_id uuid,
  p_created_by uuid,
  p_max_uses integer default 1,
  p_expires_in interval default '7 days',
  p_email text default null
)
returns public.group_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.group_invitations;
begin
  if not public.has_group_role(
    p_group_id,
    p_created_by,
    array['owner', 'admin']::public.user_role[]
  ) then
    raise exception 'Only owner or admin can create invitations';
  end if;

  if (
    select count(*)
    from public.group_invitations
    where group_id = p_group_id
      and status = 'pending'
      and expires_at > now()
  ) >= 50 then
    raise exception 'Too many active invitations for this group';
  end if;

  insert into public.group_invitations (group_id, created_by, code, max_uses, expires_at, email)
  values (p_group_id, p_created_by, public.generate_invite_code(), p_max_uses, now() + p_expires_in, p_email)
  returning * into v_invitation;

  return v_invitation;
end;
$$;

revoke all on function public.create_group_invitation(uuid, uuid, integer, interval, text) from public;
grant execute on function public.create_group_invitation(uuid, uuid, integer, interval, text) to authenticated;