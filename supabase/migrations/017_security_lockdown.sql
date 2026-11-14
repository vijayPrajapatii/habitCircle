-- 017_security_lockdown.sql
--
-- Forward-only and idempotent: every statement is drop-if-exists / create-or-replace /
-- guarded, so it is safe to run on a database that already has migrations 001-016
-- (production, where 005-016 were applied by hand) and on a fresh `supabase db reset`.
--
-- Why this exists (verified against the live catalog, see docs/decisions/002-security-lockdown.md):
--   * any signed-in user could insert themselves as OWNER of ANY group
--   * anyone holding the public anon key could read every invitation code and every profile
--   * clients could insert/update penalties, allocations, ledger rows and 'confirmed' payments
--   * a payment receiver could change the amount while confirming
--   * anon could EXECUTE every SECURITY DEFINER RPC (create_group_invitation trusted a client user id)
--   * record_peer_settlement auto-confirmed the sender's own claim and marked ALL debts paid
--
-- The app only ever reads these tables directly and writes through RPCs, so removing the
-- client write policies does not change any working feature.

begin;

-- ---------------------------------------------------------------------------
-- 1. group_members / groups / invitations: membership changes only through RPCs
-- ---------------------------------------------------------------------------
-- Joining is create_group_with_owner (creator becomes owner) or accept_group_invitation.
-- No screen updates or deletes members, so those policies go as well. (The "update" ones
-- also had no WITH CHECK, and the owner/admin ones compared group_id to itself, which was
-- always true and let the owner of ANY group manage members of EVERY group.)
drop policy if exists group_members_insert_self    on public.group_members;
drop policy if exists group_members_insert_allowed on public.group_members;
drop policy if exists group_members_update_own     on public.group_members;
drop policy if exists group_members_update_self    on public.group_members;
drop policy if exists group_members_update_owner   on public.group_members;
drop policy if exists group_members_update_admin   on public.group_members;
drop policy if exists group_members_delete_owner   on public.group_members;
drop policy if exists group_members_delete_other   on public.group_members;
drop policy if exists group_members_delete_admin   on public.group_members;

-- Groups are created through create_group_with_owner so they always get an owner member.
drop policy if exists groups_insert_authenticated on public.groups;

-- Invitation codes and link tokens are bearer secrets: never world-readable.
-- Acceptance goes through accept_group_invitation (SECURITY DEFINER); owners/admins keep
-- their own select/update policies.
drop policy if exists invitations_select_public on public.group_invitations;

-- ---------------------------------------------------------------------------
-- 2. profiles: visible to yourself and to people you share (or shared) a group with
-- ---------------------------------------------------------------------------
create or replace function public.shares_group_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members peer on peer.group_id = me.group_id
    where me.user_id = auth.uid()
      and me.left_at is null
      and peer.user_id = p_other
  )
$$;

drop policy if exists profiles_select_public     on public.profiles;
drop policy if exists profiles_select_co_members  on public.profiles;
create policy profiles_select_co_members on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));

-- ---------------------------------------------------------------------------
-- 3. Money tables: written only by SECURITY DEFINER functions
-- ---------------------------------------------------------------------------
drop policy if exists penalties_insert_member            on public.penalties;
drop policy if exists penalties_update_member            on public.penalties;
drop policy if exists penalty_allocations_insert_member  on public.penalty_allocations;
drop policy if exists ledger_entries_insert_member       on public.ledger_entries;
drop policy if exists payments_insert                    on public.payments;
drop policy if exists payments_update_status             on public.payments;
-- kept: payments_select_sender_receiver, payments_delete_pending (sender cancels own pending claim)

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_sender_not_receiver'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_sender_not_receiver check (sender_id <> receiver_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Habit tables: tighten inserts
-- ---------------------------------------------------------------------------
drop policy if exists habits_insert_member on public.habits;
create policy habits_insert_member on public.habits
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = habits.group_id
        and gm.user_id = (select auth.uid())
        and gm.left_at is null
    )
  );

drop policy if exists habit_schedules_insert_member on public.habit_schedules;
create policy habit_schedules_insert_member on public.habit_schedules
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.habits h
      join public.group_members gm on gm.group_id = h.group_id
      where h.id = habit_schedules.habit_id
        and h.created_by = (select auth.uid())
        and gm.user_id = (select auth.uid())
        and gm.left_at is null
    )
  );

-- A client may only SUBMIT a check-in. 'verified'/'missed'/'excused' are set by the system
-- or by a reviewer, never by the person whose check-in it is.
drop policy if exists habit_checkins_insert_own on public.habit_checkins;
create policy habit_checkins_insert_own on public.habit_checkins
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and status = 'submitted'
    and quantity > 0
    and exists (
      select 1
      from public.habit_occurrences ho
      join public.habit_schedules hs on hs.id = ho.schedule_id
      join public.habits h on h.id = hs.habit_id
      join public.group_members gm on gm.group_id = h.group_id
      where ho.id = habit_checkins.occurrence_id
        and h.created_by = (select auth.uid())
        and gm.user_id = (select auth.uid())
        and gm.left_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------------
-- handle_updated_at() assigns NEW.updated_at; these two tables have no such column, so every
-- UPDATE on them failed with 'record "new" has no field "updated_at"'.
drop trigger if exists group_members_updated_at  on public.group_members;
drop trigger if exists habit_schedules_updated_at on public.habit_schedules;

-- Allocations must sum exactly to the penalty. Deferred so all rows of one penalty can be
-- inserted first; checked once at COMMIT.
drop trigger if exists penalty_allocations_sum_check on public.penalty_allocations;
create constraint trigger penalty_allocations_sum_check
  after insert on public.penalty_allocations
  deferrable initially deferred
  for each row execute function public.enforce_penalty_allocation_sum();

-- The ledger is append-only: UPDATE and DELETE were already blocked; block TRUNCATE too.
drop trigger if exists prevent_ledger_truncate_trigger on public.ledger_entries;
create trigger prevent_ledger_truncate_trigger
  before truncate on public.ledger_entries
  for each statement execute function public.prevent_ledger_delete();

-- Currency is stored per group and never converted: it cannot change once money exists.
create or replace function public.prevent_group_currency_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.currency is distinct from old.currency
     and (
       exists (select 1 from public.ledger_entries where group_id = old.id)
       or exists (select 1 from public.payments where group_id = old.id)
     ) then
    raise exception 'Currency cannot be changed after money has been recorded in this circle';
  end if;
  return new;
end;
$$;

drop trigger if exists groups_lock_currency on public.groups;
create trigger groups_lock_currency
  before update of currency on public.groups
  for each row execute function public.prevent_group_currency_change();

-- Dead code: not attached to any trigger and it looked up the wrong table.
drop function if exists public.validate_payment_penalty();

-- ---------------------------------------------------------------------------
-- 6. Functions
-- ---------------------------------------------------------------------------

-- Invite codes are bearer secrets: use the cryptographic generator, not random().
create or replace function public.generate_invite_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 symbols, no look-alikes
  code text := '';
  i int;
begin
  for i in 1..8 loop
    -- byte 0 of a v4 UUID is fully random; 256 is a multiple of 32, so there is no modulo bias
    code := code || substr(chars, (get_byte(uuid_send(gen_random_uuid()), 0) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- p_created_by is still accepted so already-deployed clients keep working, but it is
-- never trusted: the caller is always auth.uid().
create or replace function public.create_group_invitation(
  p_group_id uuid,
  p_created_by uuid,
  p_max_uses integer default 1,
  p_expires_in interval default interval '7 days',
  p_email text default null
)
returns public.group_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_invitation public.group_invitations;
  v_attempt integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_group_role(p_group_id, v_uid, array['owner', 'admin']::public.user_role[]) then
    raise exception 'Only owner or admin can create invitations';
  end if;

  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 100 then
    raise exception 'Max uses must be between 1 and 100';
  end if;

  if p_expires_in is null or p_expires_in <= interval '0' or p_expires_in > interval '90 days' then
    raise exception 'Invitation expiry must be between now and 90 days';
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

  for v_attempt in 1..5 loop
    begin
      insert into public.group_invitations (group_id, created_by, code, max_uses, expires_at, email)
      values (p_group_id, v_uid, public.generate_invite_code(), p_max_uses, now() + p_expires_in, v_email)
      returning * into v_invitation;
      exit;
    exception when unique_violation then
      if v_attempt = 5 then
        raise;
      end if;
    end;
  end loop;

  return v_invitation;
end;
$$;

-- Row-locks the invitation and the group so two people cannot both consume the last use or
-- the last free seat; e-mail comparison is case-insensitive.
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
  v_uid uuid := auth.uid();
  v_invitation public.group_invitations;
  v_member public.group_members;
  v_user_email text;
  v_max_members integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_code is null and p_link_token is null then
    raise exception 'Invalid invitation';
  end if;

  select * into v_invitation
  from public.group_invitations
  where (p_code is not null and code = upper(btrim(p_code)))
     or (p_link_token is not null and link_token = p_link_token)
  order by created_at
  limit 1
  for update;

  if not found then
    raise exception 'Invalid invitation';
  end if;

  if v_invitation.status <> 'pending'::public.invitation_status then
    raise exception 'Invitation is no longer valid';
  end if;

  if v_invitation.expires_at < now() then
    raise exception 'Invitation has expired';
  end if;

  if v_invitation.uses_count >= v_invitation.max_uses then
    raise exception 'Invitation has reached maximum uses';
  end if;

  select max_members into v_max_members
  from public.groups
  where id = v_invitation.group_id
  for update;

  if not found then
    raise exception 'Invalid invitation';
  end if;

  if public.is_group_member(v_invitation.group_id, v_uid) then
    raise exception 'Already a member of this group';
  end if;

  if (
    select count(*) from public.group_members
    where group_id = v_invitation.group_id and left_at is null
  ) >= v_max_members then
    raise exception 'Group has reached maximum members';
  end if;

  if v_invitation.email is not null then
    select lower(email) into v_user_email from auth.users where id = v_uid;
    if v_user_email is distinct from lower(v_invitation.email) then
      raise exception 'This invitation was sent to a different email address';
    end if;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_invitation.group_id, v_uid, 'member')
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

-- Records the caller's OWN missed habit for the current day of the HABIT's timezone.
-- Fixes: the period boundary was computed in UTC (date_trunc on a timezone-less timestamp,
-- then implicitly cast with the session time zone); an already-submitted check-in could be
-- overwritten with 'missed'; a second call died on the unique index; only the habit's owner
-- may record a miss for it; the snapshot now carries group_id and the eligible set.
create or replace function public.record_habit_miss(p_habit_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_habit public.habits;
  v_group public.groups;
  v_schedule_id uuid;
  v_target integer;
  v_tz text;
  v_local_day timestamp;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_occurrence_id uuid;
  v_checkin_id uuid;
  v_checkin_status text;
  v_penalty_id uuid;
  v_receiver_ids uuid[];
  v_receiver_count integer;
  v_share bigint;
  v_remainder bigint;
  v_idx integer := 1;
  v_cur_receiver uuid;
  v_cur_share bigint;
  v_alloc jsonb := '[]'::jsonb;
  v_snapshot jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_habit from public.habits where id = p_habit_id;
  if not found then
    raise exception 'Habit not found';
  end if;

  if not public.is_group_member(v_habit.group_id, v_user_id) then
    raise exception 'Not a member of this circle';
  end if;

  if v_habit.created_by is distinct from v_user_id then
    raise exception 'Only the habit owner can record a miss for it';
  end if;

  select * into v_group from public.groups where id = v_habit.group_id;
  if coalesce(v_group.penalty_amount, 0) <= 0 then
    raise exception 'This circle has no penalty amount set';
  end if;

  select id, coalesce(target_quantity, 1)
    into v_schedule_id, v_target
  from public.habit_schedules
  where habit_id = v_habit.id
  order by created_at
  limit 1;

  if v_schedule_id is null then
    raise exception 'Schedule not found for habit';
  end if;

  -- The day boundary is local midnight in the habit's own timezone (DST-safe: add the day
  -- on the local timestamp, then convert back).
  v_tz := coalesce(nullif(v_habit.timezone, ''), 'UTC');
  v_local_day := date_trunc('day', now() at time zone v_tz);
  v_period_start := v_local_day at time zone v_tz;
  v_period_end := (v_local_day + interval '1 day') at time zone v_tz;

  insert into public.habit_occurrences (schedule_id, period_start, period_end, status)
  values (v_schedule_id, v_period_start, v_period_end, 'pending')
  on conflict (schedule_id, period_start) do nothing;

  select id into v_occurrence_id
  from public.habit_occurrences
  where schedule_id = v_schedule_id and period_start = v_period_start;

  select id, status into v_checkin_id, v_checkin_status
  from public.habit_checkins
  where occurrence_id = v_occurrence_id and profile_id = v_user_id
  for update;

  if found then
    if v_checkin_status in ('submitted', 'verified', 'excused') then
      raise exception 'You already checked in for this period';
    end if;
    update public.habit_checkins set status = 'missed' where id = v_checkin_id;
  else
    insert into public.habit_checkins (occurrence_id, profile_id, quantity, status)
    values (v_occurrence_id, v_user_id, 0, 'missed')
    returning id into v_checkin_id;
  end if;

  if exists (select 1 from public.penalties where occurrence_id = v_checkin_id) then
    raise exception 'A penalty was already recorded for this period';
  end if;

  -- Eligible receivers: other active members, sorted by id so remainder assignment is
  -- deterministic (first N receivers get one extra minor unit).
  select array_agg(user_id order by user_id asc) into v_receiver_ids
  from public.group_members
  where group_id = v_habit.group_id
    and user_id <> v_user_id
    and left_at is null;

  v_receiver_count := coalesce(array_length(v_receiver_ids, 1), 0);
  if v_receiver_count = 0 then
    raise exception 'There is nobody else in this circle to receive the penalty';
  end if;

  v_share := v_group.penalty_amount / v_receiver_count;
  v_remainder := v_group.penalty_amount % v_receiver_count;

  foreach v_cur_receiver in array v_receiver_ids loop
    v_cur_share := v_share + case when v_idx <= v_remainder then 1 else 0 end;
    v_alloc := v_alloc || jsonb_build_array(
      jsonb_build_object('receiverId', v_cur_receiver, 'share', v_cur_share)
    );
    v_idx := v_idx + 1;
  end loop;

  v_snapshot := jsonb_build_object(
    'penaltyAmount', v_group.penalty_amount,
    'target', v_target,
    'actual', 0,
    'targetMet', false,
    'allocations', v_alloc,
    'currency', v_group.currency,
    'group_id', v_habit.group_id,
    'habit_id', v_habit.id,
    'habit_name', v_habit.name,
    'timezone', v_tz,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'eligibleMembers', to_jsonb(v_receiver_ids),
    'notes', p_notes
  );

  insert into public.penalties (occurrence_id, offender_id, amount, status, snapshot)
  values (v_checkin_id, v_user_id, v_group.penalty_amount, 'active', v_snapshot)
  returning id into v_penalty_id;

  insert into public.penalty_allocations (penalty_id, receiver_id, share)
  select v_penalty_id, (e ->> 'receiverId')::uuid, (e ->> 'share')::bigint
  from jsonb_array_elements(v_alloc) as e
  where (e ->> 'share')::bigint > 0;

  insert into public.ledger_entries (group_id, type, amount, metadata, related_penalty_id)
  values (
    v_habit.group_id,
    'debit',
    v_group.penalty_amount,
    jsonb_build_object(
      'offender_id', v_user_id,
      'habit_name', v_habit.name,
      'reason', coalesce(p_notes, 'Missed habit check-in')
    ),
    v_penalty_id
  );

  return jsonb_build_object(
    'success', true,
    'penalty_id', v_penalty_id,
    'checkin_id', v_checkin_id,
    'amount', v_group.penalty_amount,
    'currency', v_group.currency
  );
end;
$$;

-- Payment flow (domain rule): the sender MARKS a payment as sent -> it is PENDING; only the
-- recipient's confirmation completes it. The old function inserted 'confirmed' immediately,
-- allowed paying yourself, and flipped every active penalty of the sender to 'paid' no matter
-- the amount or the group.
create or replace function public.record_peer_settlement(
  p_receiver_id uuid,
  p_group_id uuid,
  p_amount bigint,
  p_method text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_receiver_id is null or p_receiver_id = v_user_id then
    raise exception 'You cannot settle with yourself';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Settlement amount must be positive';
  end if;

  if not public.is_group_member(p_group_id, v_user_id) then
    raise exception 'You are not a member of this circle';
  end if;

  if not public.is_group_member(p_group_id, p_receiver_id) then
    raise exception 'Receiver is not a member of this circle';
  end if;

  insert into public.payments (sender_id, receiver_id, group_id, amount, status, evidence_path)
  values (
    v_user_id,
    p_receiver_id,
    p_group_id,
    p_amount,
    'pending',
    jsonb_build_object(
      'method', coalesce(p_method, 'Other'),
      'notes', p_notes,
      'marked_sent_at', now()
    )::text
  )
  returning id into v_payment_id;

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'amount', p_amount,
    'status', 'pending'
  );
end;
$$;

-- Only the RECIPIENT can complete a payment. The ledger entry is written here, in the same
-- transaction as the status change. Penalty rows are not touched: the outstanding balance is
-- derived as (allocations - confirmed payments), which stays correct across later penalties.
create or replace function public.confirm_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.receiver_id <> v_uid then
    raise exception 'Only the recipient can confirm this payment';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'This payment is already %', v_payment.status;
  end if;

  if not public.is_group_member(v_payment.group_id, v_uid) then
    raise exception 'You are not a member of this circle';
  end if;

  update public.payments set status = 'confirmed' where id = v_payment.id;

  insert into public.ledger_entries (group_id, type, amount, metadata, related_payment_id)
  values (
    v_payment.group_id,
    'adjust',
    v_payment.amount,
    jsonb_build_object(
      'settlement', true,
      'sender_id', v_payment.sender_id,
      'receiver_id', v_payment.receiver_id,
      'confirmed_by', v_uid
    ),
    v_payment.id
  );

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment.id,
    'amount', v_payment.amount,
    'status', 'confirmed'
  );
end;
$$;

create or replace function public.reject_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.receiver_id <> v_uid then
    raise exception 'Only the recipient can reject this payment';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'This payment is already %', v_payment.status;
  end if;

  update public.payments set status = 'rejected' where id = v_payment.id;

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment.id,
    'status', 'rejected'
  );
end;
$$;

-- Pin search_path on the helpers the advisor flagged (all of them schema-qualify their tables).
-- The allocation check runs deferred at COMMIT, so it must see every allocation row regardless
-- of the caller's RLS visibility: SECURITY DEFINER (it is not callable as an RPC, see below).
alter function public.enforce_penalty_allocation_sum() security definer set search_path = '';
alter function public.prevent_ledger_delete()          set search_path = '';
alter function public.prevent_ledger_update()          set search_path = '';

-- ---------------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------------
-- Nothing in the app reads or writes tables as the anonymous role.
revoke all on all tables in schema public from anon;
-- RLS does not apply to TRUNCATE, and nothing needs these.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Future tables/functions are not exposed to the anonymous role by default. (A function's
-- built-in PUBLIC execute default is global, so every new RPC migration must still REVOKE it
-- explicitly and GRANT to authenticated; see docs/decisions/002-security-lockdown.md.)
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- Functions: nobody but signed-in users may call anything, and trigger/internal helpers are
-- not callable through the REST API at all. (Extension-owned functions are left alone.)
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (
        select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
  end loop;
end $$;

-- Helpers evaluated inside RLS policies must stay executable by signed-in users.
grant execute on function public.is_group_member(uuid, uuid)                      to authenticated;
grant execute on function public.has_group_role(uuid, uuid, public.user_role[])   to authenticated;
grant execute on function public.shares_group_with(uuid)                          to authenticated;

-- RPCs the app calls.
grant execute on function public.create_group_with_owner(text, text, integer, text, text, integer) to authenticated;
grant execute on function public.accept_group_invitation(text, uuid)                               to authenticated;
grant execute on function public.create_group_invitation(uuid, uuid, integer, interval, text)      to authenticated;
grant execute on function public.record_habit_miss(uuid, text)                                     to authenticated;
grant execute on function public.record_peer_settlement(uuid, uuid, bigint, text, text)            to authenticated;
grant execute on function public.confirm_payment(uuid)                                             to authenticated;
grant execute on function public.reject_payment(uuid)                                              to authenticated;

-- Trigger functions and internal helpers: not callable as RPC by anyone (triggers still fire;
-- EXECUTE is only checked when a trigger is created).
revoke all on function public.handle_new_user()                  from authenticated;
revoke all on function public.handle_updated_at()                from authenticated;
revoke all on function public.prevent_ledger_delete()            from authenticated;
revoke all on function public.prevent_ledger_update()            from authenticated;
revoke all on function public.enforce_penalty_allocation_sum()   from authenticated;
revoke all on function public.prevent_group_currency_change()    from authenticated;
revoke all on function public.generate_invite_code()             from authenticated;

commit;
