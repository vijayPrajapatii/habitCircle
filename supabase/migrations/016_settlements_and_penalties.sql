-- 016_settlements_and_penalties.sql
-- Enables RLS policies for penalties, allocations, ledger entries, and settlements
-- Provides atomic helper RPCs for recording missed habits and peer settlements

-- 1. Policies for penalty_allocations
drop policy if exists "penalty_allocations_select_member" on public.penalty_allocations;
create policy "penalty_allocations_select_member" on public.penalty_allocations
  for select using (
    receiver_id = auth.uid() or
    exists (
      select 1 from public.penalties p
      where p.id = penalty_allocations.penalty_id
        and p.offender_id = auth.uid()
    )
  );

drop policy if exists "penalty_allocations_insert_member" on public.penalty_allocations;
create policy "penalty_allocations_insert_member" on public.penalty_allocations
  for insert with check (
    exists (
      select 1 from public.penalties p
      where p.id = penalty_allocations.penalty_id
        and p.offender_id = auth.uid()
    )
  );

-- 2. Policies for penalties
drop policy if exists "penalties_insert_member" on public.penalties;
create policy "penalties_insert_member" on public.penalties
  for insert with check (
    offender_id = auth.uid()
  );

drop policy if exists "penalties_update_member" on public.penalties;
create policy "penalties_update_member" on public.penalties
  for update using (
    offender_id = auth.uid() or
    exists (
      select 1 from public.penalty_allocations pa
      where pa.penalty_id = penalties.id
        and pa.receiver_id = auth.uid()
    )
  );

-- 3. Policies for ledger_entries
drop policy if exists "ledger_entries_select_member" on public.ledger_entries;
create policy "ledger_entries_select_member" on public.ledger_entries
  for select using (
    public.is_group_member(group_id, auth.uid())
  );

drop policy if exists "ledger_entries_insert_member" on public.ledger_entries;
create policy "ledger_entries_insert_member" on public.ledger_entries
  for insert with check (
    public.is_group_member(group_id, auth.uid())
  );

-- 4. Atomic RPC to record a habit failure / miss
create or replace function public.record_habit_miss(
  p_habit_id uuid,
  p_notes text default null
)
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
  v_occurrence_id uuid;
  v_checkin_id uuid;
  v_penalty_id uuid;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_receiver_ids uuid[];
  v_receiver_count integer;
  v_share bigint;
  v_remainder bigint;
  v_allocated bigint := 0;
  v_idx integer := 1;
  v_cur_receiver uuid;
  v_cur_share bigint;
  v_snapshot jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Load habit
  select * into v_habit from public.habits where id = p_habit_id;
  if not found then
    raise exception 'Habit not found';
  end if;

  -- Verify active membership
  if not public.is_group_member(v_habit.group_id, v_user_id) then
    raise exception 'Not a member of this circle';
  end if;

  -- Load group
  select * into v_group from public.groups where id = v_habit.group_id;

  -- Load schedule
  select id into v_schedule_id from public.habit_schedules where habit_id = v_habit.id limit 1;
  if not found then
    raise exception 'Schedule not found for habit';
  end if;

  -- Occurrence boundary (today midnight)
  v_period_start := date_trunc('day', now() at time zone coalesce(v_habit.timezone, 'UTC'));
  v_period_end := v_period_start + interval '1 day';

  -- Find or insert occurrence
  select id into v_occurrence_id from public.habit_occurrences
  where schedule_id = v_schedule_id and period_start = v_period_start;

  if not found then
    insert into public.habit_occurrences (schedule_id, period_start, period_end, status)
    values (v_schedule_id, v_period_start, v_period_end, 'pending')
    returning id into v_occurrence_id;
  end if;

  -- Insert or update checkin
  select id into v_checkin_id from public.habit_checkins
  where occurrence_id = v_occurrence_id and profile_id = v_user_id;

  if not found then
    insert into public.habit_checkins (occurrence_id, profile_id, quantity, status)
    values (v_occurrence_id, v_user_id, 0, 'missed')
    returning id into v_checkin_id;
  else
    update public.habit_checkins set status = 'missed' where id = v_checkin_id;
  end if;

  -- Fetch eligible receivers (other active members in the circle, sorted by UUID)
  select array_agg(user_id order by user_id asc) into v_receiver_ids
  from public.group_members
  where group_id = v_habit.group_id
    and user_id <> v_user_id
    and left_at is null;

  v_receiver_count := coalesce(array_length(v_receiver_ids, 1), 0);

  -- Build snapshot
  v_snapshot := jsonb_build_object(
    'penaltyAmount', v_group.penalty_amount,
    'target', 1,
    'actual', 0,
    'targetMet', false,
    'currency', v_group.currency,
    'habit_id', v_habit.id,
    'habit_name', v_habit.name,
    'notes', p_notes
  );

  -- Insert penalty
  insert into public.penalties (occurrence_id, offender_id, amount, status, snapshot)
  values (v_checkin_id, v_user_id, v_group.penalty_amount, 'active', v_snapshot)
  returning id into v_penalty_id;

  -- Allocate shares deterministically
  if v_receiver_count > 0 then
    v_share := v_group.penalty_amount / v_receiver_count;
    v_remainder := v_group.penalty_amount % v_receiver_count;

    foreach v_cur_receiver in array v_receiver_ids loop
      v_cur_share := v_share;
      if v_idx <= v_remainder then
        v_cur_share := v_cur_share + 1;
      end if;

      if v_cur_share > 0 then
        insert into public.penalty_allocations (penalty_id, receiver_id, share)
        values (v_penalty_id, v_cur_receiver, v_cur_share)
        on conflict (penalty_id, receiver_id) do update set share = EXCLUDED.share;
      end if;

      v_idx := v_idx + 1;
    end loop;
  end if;

  -- Record debit in ledger_entries
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

revoke all on function public.record_habit_miss(uuid, text) from public;
grant execute on function public.record_habit_miss(uuid, text) to authenticated;

-- 5. Atomic RPC to record a peer-to-peer settlement
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

  if p_amount <= 0 then
    raise exception 'Settlement amount must be positive';
  end if;

  -- Verify active membership for both parties
  if not public.is_group_member(p_group_id, v_user_id) then
    raise exception 'You are not a member of this circle';
  end if;

  if not public.is_group_member(p_group_id, p_receiver_id) then
    raise exception 'Receiver is not a member of this circle';
  end if;

  -- Insert confirmed payment record
  insert into public.payments (
    sender_id,
    receiver_id,
    group_id,
    amount,
    status,
    evidence_path
  )
  values (
    v_user_id,
    p_receiver_id,
    p_group_id,
    p_amount,
    'confirmed',
    jsonb_build_object(
      'method', coalesce(p_method, 'Other'),
      'notes', p_notes,
      'settled_at', now()
    )::text
  )
  returning id into v_payment_id;

  -- Record credit/adjustment in immutable ledger
  insert into public.ledger_entries (
    group_id,
    type,
    amount,
    metadata,
    related_payment_id
  )
  values (
    p_group_id,
    'adjust',
    p_amount,
    jsonb_build_object(
      'settlement', true,
      'sender_id', v_user_id,
      'receiver_id', p_receiver_id,
      'method', p_method,
      'notes', p_notes
    ),
    v_payment_id
  );

  -- Mark active penalties for this user in this group as paid
  update public.penalties
  set status = 'paid'
  where offender_id = v_user_id
    and status = 'active'
    and id in (
      select pa.penalty_id
      from public.penalty_allocations pa
      where pa.receiver_id = p_receiver_id
    );

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'amount', p_amount
  );
end;
$$;

revoke all on function public.record_peer_settlement(uuid, uuid, bigint, text, text) from public;
grant execute on function public.record_peer_settlement(uuid, uuid, bigint, text, text) to authenticated;
