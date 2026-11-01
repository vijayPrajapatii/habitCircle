-- Basic creation flow fixes

-- Track which member owns each habit.
alter table public.habits add column if not exists created_by uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'habits_created_by_fkey'
      and conrelid = 'public.habits'::regclass
  ) then
    alter table public.habits
      add constraint habits_created_by_fkey
      foreign key (created_by) references public.profiles(id);
  end if;
end $$;

create index if not exists habits_created_by_idx on public.habits (created_by);

drop policy if exists "habits_insert_member" on public.habits;
create policy "habits_insert_member" on public.habits for insert with check (
  exists (
    select 1 from public.group_members
    where group_id = habits.group_id
      and user_id = auth.uid()
      and left_at is null
  )
);

-- The membership read policy must not query group_members through its own RLS policy.
drop policy if exists "group_members_select_member" on public.group_members;
drop policy if exists "group_members_select_self" on public.group_members;
create policy "group_members_select_self"
  on public.group_members for select
  using (user_id = auth.uid());

-- Active group members may create schedules for habits in their groups.
drop policy if exists "habit_schedules_insert_admin" on public.habit_schedules;
drop policy if exists "habit_schedules_insert_member" on public.habit_schedules;
create policy "habit_schedules_insert_member"
  on public.habit_schedules for insert
  with check (
    exists (
      select 1
      from public.habits h
      join public.group_members gm on gm.group_id = h.group_id
      where h.id = habit_schedules.habit_id
        and gm.user_id = auth.uid()
        and gm.left_at is null
    )
  );

-- Members may create the current occurrence for a habit in their group.
drop policy if exists "habit_occurrences_insert_member" on public.habit_occurrences;
create policy "habit_occurrences_insert_member"
  on public.habit_occurrences for insert
  with check (
    exists (
      select 1
      from public.habit_schedules hs
      join public.habits h on h.id = hs.habit_id
      join public.group_members gm on gm.group_id = h.group_id
      where hs.id = habit_occurrences.schedule_id
        and h.created_by = auth.uid()
        and gm.user_id = auth.uid()
        and gm.left_at is null
    )
  );

-- A check-in must belong to the authenticated member.
drop policy if exists "habit_checkins_insert_own" on public.habit_checkins;
create policy "habit_checkins_insert_own" on public.habit_checkins for insert with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from public.habit_occurrences ho
    join public.habit_schedules hs on hs.id = ho.schedule_id
    join public.habits h on h.id = hs.habit_id
    join public.group_members gm on gm.group_id = h.group_id
    where ho.id = habit_checkins.occurrence_id
      and h.created_by = auth.uid()
      and gm.user_id = auth.uid()
      and gm.left_at is null
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

-- Fix invitation status enum assignments during acceptance.
create or replace function public.accept_group_invitation(
  p_code text default null,
  p_link_token uuid default null
)
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.group_invitations;
  v_member public.group_members;
begin
  select * into v_invitation
  from public.group_invitations
  where (p_code is not null and code = p_code)
     or (p_link_token is not null and link_token = p_link_token)
  limit 1;

  if not found then
    raise exception 'Invalid invitation';
  end if;

  if v_invitation.status <> 'pending'::public.invitation_status then
    raise exception 'Invitation is no longer valid';
  end if;

  if v_invitation.expires_at < now() then
    update public.group_invitations
    set status = 'expired'::public.invitation_status
    where id = v_invitation.id;
    raise exception 'Invitation has expired';
  end if;

  if v_invitation.uses_count >= v_invitation.max_uses then
    raise exception 'Invitation has reached maximum uses';
  end if;

  if public.is_group_member(v_invitation.group_id, auth.uid()) then
    raise exception 'Already a member of this group';
  end if;

  if (
    select count(*) from public.group_members
    where group_id = v_invitation.group_id and left_at is null
  ) >= (
    select max_members from public.groups where id = v_invitation.group_id
  ) then
    raise exception 'Group has reached maximum members';
  end if;

  if v_invitation.email is not null
     and (select email from auth.users where id = auth.uid()) <> v_invitation.email then
    raise exception 'This invitation was sent to a different email address';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_invitation.group_id, auth.uid(), 'member')
  returning * into v_member;

  update public.group_invitations
  set uses_count = uses_count + 1,
      status = case
        when uses_count + 1 >= max_uses then 'accepted'::public.invitation_status
        else 'pending'::public.invitation_status
      end,
      updated_at = now()
  where id = v_invitation.id;

  return v_member;
end;
$$;

revoke all on function public.accept_group_invitation(text, uuid) from public;
grant execute on function public.accept_group_invitation(text, uuid) to authenticated;