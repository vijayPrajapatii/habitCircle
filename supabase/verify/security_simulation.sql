-- ============================================================================
-- HabitCircle security simulation. ONE batch, ends with RAISE EXCEPTION, so the whole
-- transaction is rolled back and NOTHING is ever saved. Fixture users/groups only exist
-- inside this transaction. Read the result in the error text ("SIM RESULT ...").
-- ============================================================================

create temp table sim_results (n serial, id text, verdict text, detail text);

create function pg_temp.sim_log(p_id text, p_verdict text, p_detail text)
returns void language sql as
$f$ insert into sim_results (id, verdict, detail) values (p_id, p_verdict, p_detail) $f$;

-- Run a DML statement as a given role/user; returns 'OK:<rows>' or 'ERR:<message>'.
create function pg_temp.sim_dml(p_uid uuid, p_role text, p_sql text)
returns text language plpgsql as $f$
declare v_rows bigint;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims',
    case when p_uid is null then '{"role":"anon"}'
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    execute 'reset role';
    return 'OK:' || v_rows;
  exception when others then
    execute 'reset role';
    return 'ERR:' || left(sqlerrm, 90);
  end;
end $f$;

-- Run a query returning one value as a given role/user; returns 'VAL:<v>' or 'ERR:<message>'.
create function pg_temp.sim_scalar(p_uid uuid, p_role text, p_sql text)
returns text language plpgsql as $f$
declare v_val text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims',
    case when p_uid is null then '{"role":"anon"}'
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql into v_val;
    execute 'reset role';
    return 'VAL:' || coalesce(v_val, 'null');
  exception when others then
    execute 'reset role';
    return 'ERR:' || left(sqlerrm, 90);
  end;
end $f$;

-- The attack must NOT work: an error, zero affected rows or zero visible rows all count as blocked.
create function pg_temp.sim_blocked(p_id text, p_desc text, p_res text)
returns void language plpgsql as $f$
begin
  if p_res like 'ERR:%updated_at%' then
    perform pg_temp.sim_log(p_id, 'MASKED', p_desc || ' | only a broken trigger stops it');
  elsif p_res like 'ERR:%' or p_res = 'OK:0' or p_res = 'VAL:0' then
    perform pg_temp.sim_log(p_id, 'PASS', p_desc || ' | ' || p_res);
  else
    perform pg_temp.sim_log(p_id, 'FAIL', p_desc || ' | EXPLOITABLE ' || p_res);
  end if;
end $f$;

-- The legitimate action MUST work.
create function pg_temp.sim_works(p_id text, p_desc text, p_res text)
returns void language plpgsql as $f$
begin
  if p_res like 'ERR:%' or p_res = 'OK:0' then
    perform pg_temp.sim_log(p_id, 'FAIL', p_desc || ' | BROKEN ' || p_res);
  else
    perform pg_temp.sim_log(p_id, 'PASS', p_desc || ' | ' || p_res);
  end if;
end $f$;

do $sim$
declare
  v_owner    uuid := gen_random_uuid();
  v_member   uuid := gen_random_uuid();
  v_attacker uuid := gen_random_uuid();
  v_group uuid;  v_group2 uuid;
  v_habit uuid;  v_sched uuid;
  v_habit2 uuid; v_sched2 uuid;
  v_occ uuid; v_occ2 uuid; v_occ3 uuid; v_occ4 uuid; v_occ5 uuid;
  v_checkin uuid; v_checkin2 uuid; v_checkin5 uuid;
  v_pen uuid; v_pay uuid; v_pay2 uuid;
  v_res text; v_status text; v_cnt bigint; v_ps timestamptz;
  v_pass int; v_fail int; v_masked int; v_report text; v_detail text;
begin
  -- ---------------------------------------------------------------- fixtures (as postgres)
  insert into auth.users (id, email, aud, role) values
    (v_owner,    'sim-owner-'    || v_owner    || '@example.invalid', 'authenticated', 'authenticated'),
    (v_member,   'sim-member-'   || v_member   || '@example.invalid', 'authenticated', 'authenticated'),
    (v_attacker, 'sim-attacker-' || v_attacker || '@example.invalid', 'authenticated', 'authenticated');

  insert into public.groups (name, description, penalty_amount, currency, timezone, max_members, created_by)
  values ('sim-group', '', 1000, 'INR', 'UTC', 10, v_owner)
  returning id into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group, v_owner, 'owner'), (v_group, v_member, 'member');

  -- the attacker legitimately owns a DIFFERENT group (needed for the old owner-policy bug)
  insert into public.groups (name, description, penalty_amount, currency, timezone, max_members, created_by)
  values ('sim-group-2', '', 1000, 'INR', 'UTC', 10, v_attacker)
  returning id into v_group2;
  insert into public.group_members (group_id, user_id, role) values (v_group2, v_attacker, 'owner');

  insert into public.group_invitations (group_id, created_by, code, max_uses, expires_at)
  values (v_group, v_owner, 'SIMCODE1', 1, now() + interval '1 day');

  insert into public.habits (group_id, name, timezone, created_by)
  values (v_group, 'sim-habit', 'UTC', v_member) returning id into v_habit;
  insert into public.habit_schedules (habit_id, frequency, target_quantity)
  values (v_habit, 'daily', 1) returning id into v_sched;

  insert into public.habits (group_id, name, timezone, created_by)
  values (v_group, 'sim-habit-ist', 'Asia/Kolkata', v_member) returning id into v_habit2;
  insert into public.habit_schedules (habit_id, frequency, target_quantity)
  values (v_habit2, 'daily', 1) returning id into v_sched2;

  insert into public.habit_occurrences (schedule_id, period_start, period_end, status)
  values (v_sched, '2000-01-01 00:00+00', '2000-01-02 00:00+00', 'pending') returning id into v_occ;
  insert into public.habit_occurrences (schedule_id, period_start, period_end, status)
  values (v_sched, '2000-01-03 00:00+00', '2000-01-04 00:00+00', 'pending') returning id into v_occ2;
  insert into public.habit_occurrences (schedule_id, period_start, period_end, status)
  values (v_sched, '2000-01-05 00:00+00', '2000-01-06 00:00+00', 'pending') returning id into v_occ3;
  insert into public.habit_occurrences (schedule_id, period_start, period_end, status)
  values (v_sched, '2000-01-07 00:00+00', '2000-01-08 00:00+00', 'pending') returning id into v_occ4;
  insert into public.habit_occurrences (schedule_id, period_start, period_end, status)
  values (v_sched, '2000-01-09 00:00+00', '2000-01-10 00:00+00', 'pending') returning id into v_occ5;

  insert into public.habit_checkins (occurrence_id, profile_id, quantity, status)
  values (v_occ, v_member, 1, 'pending') returning id into v_checkin;
  insert into public.habit_checkins (occurrence_id, profile_id, quantity, status)
  values (v_occ2, v_member, 0, 'missed') returning id into v_checkin2;
  insert into public.habit_checkins (occurrence_id, profile_id, quantity, status)
  values (v_occ5, v_member, 0, 'missed') returning id into v_checkin5;

  insert into public.penalties (occurrence_id, offender_id, amount, status, snapshot)
  values (v_checkin2, v_member, 500, 'active', '{}'::jsonb) returning id into v_pen;
  insert into public.penalty_allocations (penalty_id, receiver_id, share) values (v_pen, v_owner, 500);

  insert into public.payments (sender_id, receiver_id, group_id, amount, status)
  values (v_member, v_owner, v_group, 100, 'pending') returning id into v_pay;

  -- ---------------------------------------------------------------- membership
  v_res := pg_temp.sim_dml(v_attacker, 'authenticated', format(
    $q$insert into public.group_members (group_id, user_id, role) values (%L, %L, 'owner')$q$, v_group, v_attacker));
  perform pg_temp.sim_blocked('M1', 'stranger inserts self as OWNER of someone else''s group', v_res);

  v_res := pg_temp.sim_dml(v_member, 'authenticated', format(
    $q$update public.group_members set role = 'owner' where group_id = %L and user_id = %L$q$, v_group, v_member));
  perform pg_temp.sim_blocked('M2', 'member promotes self to owner', v_res);

  v_res := pg_temp.sim_dml(v_attacker, 'authenticated', format(
    $q$delete from public.group_members where group_id = %L and user_id = %L$q$, v_group, v_owner));
  perform pg_temp.sim_blocked('M3', 'stranger removes the owner of someone else''s group', v_res);

  -- ---------------------------------------------------------------- secrets / privacy
  v_res := pg_temp.sim_scalar(null, 'anon', 'select count(*)::text from public.group_invitations');
  perform pg_temp.sim_blocked('S1', 'anonymous visitor reads invitation codes', v_res);

  v_res := pg_temp.sim_scalar(null, 'anon', 'select count(*)::text from public.profiles');
  perform pg_temp.sim_blocked('S2', 'anonymous visitor reads all profiles', v_res);

  v_res := pg_temp.sim_scalar(v_attacker, 'authenticated', format(
    $q$select count(*)::text from public.profiles where id = %L$q$, v_owner));
  perform pg_temp.sim_blocked('S3', 'stranger reads another circle''s member profile', v_res);

  v_res := pg_temp.sim_scalar(v_attacker, 'authenticated', 'select count(*)::text from public.group_invitations');
  perform pg_temp.sim_blocked('S4', 'stranger reads invitation codes', v_res);

  v_res := pg_temp.sim_scalar(v_member, 'authenticated', format(
    $q$select count(*)::text from public.profiles where id = %L$q$, v_owner));
  if v_res = 'VAL:1' then
    perform pg_temp.sim_log('S5', 'PASS', 'circle members can still see each other | ' || v_res);
  else
    perform pg_temp.sim_log('S5', 'FAIL', 'circle members can no longer see each other | BROKEN ' || v_res);
  end if;

  -- ---------------------------------------------------------------- money tables
  v_res := pg_temp.sim_dml(v_member, 'authenticated', format(
    $q$insert into public.penalties (occurrence_id, offender_id, amount, status, snapshot)
       values (%L, %L, 1, 'active', '{}'::jsonb)$q$, v_checkin, v_member));
  perform pg_temp.sim_blocked('P1', 'member writes a penalty row directly', v_res);

  v_res := pg_temp.sim_dml(v_member, 'authenticated', format(
    $q$update public.penalties set status = 'paid' where id = %L$q$, v_pen));
  perform pg_temp.sim_blocked('P2', 'offender forgives own penalty', v_res);

  v_res := pg_temp.sim_dml(v_member, 'authenticated', format(
    $q$insert into public.ledger_entries (group_id, type, amount) values (%L, 'credit', 1)$q$, v_group));
  perform pg_temp.sim_blocked('P3', 'member writes a ledger row directly', v_res);

  v_res := pg_temp.sim_dml(v_member, 'authenticated', format(
    $q$insert into public.payments (sender_id, receiver_id, group_id, amount, status)
       values (%L, %L, %L, 1, 'confirmed')$q$, v_member, v_owner, v_group));
  perform pg_temp.sim_blocked('P4', 'sender inserts an already-CONFIRMED payment', v_res);

  v_res := pg_temp.sim_dml(v_owner, 'authenticated', format(
    $q$update public.payments set status = 'confirmed', amount = 999999 where id = %L$q$, v_pay));
  perform pg_temp.sim_blocked('P5', 'receiver changes the amount while confirming', v_res);

  -- ---------------------------------------------------------------- check-ins
  v_res := pg_temp.sim_dml(v_member, 'authenticated', format(
    $q$insert into public.habit_checkins (occurrence_id, profile_id, quantity, status)
       values (%L, %L, 1, 'verified')$q$, v_occ3, v_member));
  perform pg_temp.sim_blocked('C1', 'member submits a check-in already marked VERIFIED', v_res);

  v_res := pg_temp.sim_dml(v_member, 'authenticated', format(
    $q$insert into public.habit_checkins (occurrence_id, profile_id, quantity, status)
       values (%L, %L, 1, 'submitted')$q$, v_occ4, v_member));
  perform pg_temp.sim_works('C2', 'habit owner can still submit a normal check-in', v_res);

  -- ---------------------------------------------------------------- RPC access
  v_res := pg_temp.sim_scalar(v_attacker, 'authenticated', format(
    $q$select (public.create_group_invitation(%L, %L, 1, interval '1 day', null)).code$q$, v_group, v_owner));
  perform pg_temp.sim_blocked('R1', 'stranger mints an invitation by passing the owner''s id', v_res);

  v_res := pg_temp.sim_scalar(null, 'anon', format(
    $q$select (public.create_group_invitation(%L, %L, 1, interval '1 day', null)).code$q$, v_group, v_owner));
  perform pg_temp.sim_blocked('R2', 'anonymous visitor mints an invitation', v_res);

  v_res := pg_temp.sim_scalar(null, 'anon', $q$select (public.accept_group_invitation('SIMCODE1', null)).id::text$q$);
  if v_res like 'ERR:%permission denied%' then
    perform pg_temp.sim_log('R3', 'PASS', 'anonymous visitor cannot execute accept_group_invitation | ' || v_res);
  else
    perform pg_temp.sim_log('R3', 'FAIL', 'anon can EXECUTE accept_group_invitation | ' || v_res);
  end if;

  v_res := pg_temp.sim_scalar(v_member, 'authenticated', format(
    $q$select (public.create_group_invitation(%L, %L, 1, interval '2 days', null)).code$q$, v_group, v_member));
  perform pg_temp.sim_blocked('R4', 'plain member creates an invitation', v_res);

  v_res := pg_temp.sim_scalar(v_owner, 'authenticated', format(
    $q$select (public.create_group_invitation(%L, %L, 1, interval '2 days', null)).code$q$, v_group, v_owner));
  perform pg_temp.sim_works('R5', 'owner can still create an invitation', v_res);

  v_res := pg_temp.sim_scalar(v_owner, 'authenticated', format(
    $q$select (public.create_group_invitation(%L, %L, 1, interval '2 days', null)).code$q$, v_group, v_owner));
  if v_res ~ '^VAL:[A-HJ-NP-Z2-9]{8}$' then
    perform pg_temp.sim_log('R6', 'PASS', 'invitation code is 8 chars from the safe alphabet | ' || v_res);
  else
    perform pg_temp.sim_log('R6', 'FAIL', 'unexpected invitation code format | ' || v_res);
  end if;

  v_res := pg_temp.sim_scalar(v_owner, 'authenticated', format(
    $q$select (public.create_group_invitation(%L, %L, 100000, interval '2 days', null)).code$q$, v_group, v_owner));
  perform pg_temp.sim_blocked('R7', 'owner creates an invitation with 100000 uses', v_res);

  v_res := pg_temp.sim_scalar(v_attacker, 'authenticated', $q$select (public.accept_group_invitation('simcode1', null)).role::text$q$);
  if v_res = 'VAL:member' then
    perform pg_temp.sim_log('R8', 'PASS', 'signed-in stranger can join with a valid code (lowercase accepted), as MEMBER | ' || v_res);
  else
    perform pg_temp.sim_log('R8', 'INFO', 'accept with lowercase code -> ' || v_res);
  end if;

  -- ---------------------------------------------------------------- payments flow
  v_res := pg_temp.sim_scalar(v_member, 'authenticated', format(
    $q$select (public.record_peer_settlement(%L, %L, 100, 'UPI', null))->>'payment_id'$q$, v_owner, v_group));
  if v_res like 'VAL:%' then
    v_pay2 := substr(v_res, 5)::uuid;
    select status into v_status from public.payments where id = v_pay2;
    if v_status = 'pending' then
      perform pg_temp.sim_log('F1', 'PASS', 'a marked-sent payment is PENDING until the recipient confirms');
    else
      perform pg_temp.sim_log('F1', 'FAIL', 'sender''s own claim was stored as ' || v_status || ' (recipient never confirmed)');
    end if;
    select status into v_status from public.penalties where id = v_pen;
    if v_status = 'active' then
      perform pg_temp.sim_log('F2', 'PASS', 'a 100 payment does not mark the 500 penalty paid');
    else
      perform pg_temp.sim_log('F2', 'FAIL', 'penalty is now ' || v_status || ' after a payment of 100 against 500');
    end if;
  else
    perform pg_temp.sim_log('F1', 'FAIL', 'record_peer_settlement failed unexpectedly | ' || v_res);
  end if;

  v_res := pg_temp.sim_scalar(v_member, 'authenticated', format(
    $q$select (public.record_peer_settlement(%L, %L, 100, 'UPI', null))->>'payment_id'$q$, v_member, v_group));
  perform pg_temp.sim_blocked('F3', 'member records a payment to themselves', v_res);

  if to_regprocedure('public.confirm_payment(uuid)') is null then
    perform pg_temp.sim_log('F4', 'N/A', 'confirm_payment does not exist yet');
  else
    v_res := pg_temp.sim_scalar(v_member, 'authenticated', format(
      $q$select (public.confirm_payment(%L))->>'status'$q$, v_pay2));
    perform pg_temp.sim_blocked('F4', 'SENDER confirms their own payment', v_res);

    v_res := pg_temp.sim_scalar(v_owner, 'authenticated', format(
      $q$select (public.confirm_payment(%L))->>'status'$q$, v_pay2));
    if v_res = 'VAL:confirmed' then
      select count(*) into v_cnt from public.ledger_entries where related_payment_id = v_pay2;
      if v_cnt = 1 then
        perform pg_temp.sim_log('F5', 'PASS', 'recipient confirms; exactly one ledger entry written');
      else
        perform pg_temp.sim_log('F5', 'FAIL', 'recipient confirmed but ledger entries = ' || v_cnt);
      end if;
    else
      perform pg_temp.sim_log('F5', 'FAIL', 'recipient could not confirm | ' || v_res);
    end if;

    v_res := pg_temp.sim_scalar(v_owner, 'authenticated', format(
      $q$select (public.confirm_payment(%L))->>'status'$q$, v_pay2));
    perform pg_temp.sim_blocked('F6', 'confirming the same payment twice', v_res);
  end if;

  -- ---------------------------------------------------------------- missed habit + ledger
  v_res := pg_temp.sim_scalar(v_member, 'authenticated', format(
    $q$select (public.record_habit_miss(%L, 'sim'))->>'penalty_id'$q$, v_habit2));
  if v_res like 'VAL:%' then
    select period_start into v_ps from public.habit_occurrences where schedule_id = v_sched2;
    if (v_ps at time zone 'Asia/Kolkata')::time = time '00:00' then
      perform pg_temp.sim_log('H1', 'PASS', 'day boundary is midnight in the HABIT timezone (Asia/Kolkata)');
    else
      perform pg_temp.sim_log('H1', 'FAIL', 'day boundary is ' || (v_ps at time zone 'Asia/Kolkata')::time || ' IST, not midnight');
    end if;

    select coalesce(sum(pa.share), 0) into v_cnt
    from public.penalty_allocations pa
    join public.penalties p on p.id = pa.penalty_id
    join public.habit_checkins hc on hc.id = p.occurrence_id
    join public.habit_occurrences ho on ho.id = hc.occurrence_id
    where ho.schedule_id = v_sched2;
    if v_cnt = 1000 then
      perform pg_temp.sim_log('H2', 'PASS', 'allocations sum exactly to the penalty (1000)');
    else
      perform pg_temp.sim_log('H2', 'FAIL', 'allocations sum to ' || v_cnt || ', penalty is 1000');
    end if;

    select count(*) into v_cnt from public.ledger_entries
    where group_id = v_group and type = 'debit' and related_penalty_id = substr(v_res, 5)::uuid;
    if v_cnt = 1 then
      perform pg_temp.sim_log('H3', 'PASS', 'one ledger debit written with the penalty');
    else
      perform pg_temp.sim_log('H3', 'FAIL', 'ledger debits for the penalty = ' || v_cnt);
    end if;
  else
    perform pg_temp.sim_log('H1', 'FAIL', 'record_habit_miss failed | ' || v_res);
  end if;

  v_res := pg_temp.sim_scalar(v_member, 'authenticated', format(
    $q$select (public.record_habit_miss(%L, 'again'))->>'penalty_id'$q$, v_habit2));
  perform pg_temp.sim_blocked('H4', 'a second penalty for the same period', v_res);

  v_res := pg_temp.sim_scalar(v_owner, 'authenticated', format(
    $q$select (public.record_habit_miss(%L, 'x'))->>'penalty_id'$q$, v_habit));
  perform pg_temp.sim_blocked('H5', 'owner records a miss on a habit that is not theirs', v_res);

  -- ---------------------------------------------------------------- currency lock + ledger
  v_res := pg_temp.sim_dml(v_owner, 'authenticated', format(
    $q$update public.groups set currency = 'USD' where id = %L$q$, v_group));
  perform pg_temp.sim_blocked('L1', 'change currency after money was recorded', v_res);

  v_res := pg_temp.sim_dml(v_owner, 'authenticated', format(
    $q$update public.groups set penalty_amount = 2000 where id = %L$q$, v_group));
  perform pg_temp.sim_works('L2', 'owner can still change the stake', v_res);

  v_res := pg_temp.sim_dml(v_owner, 'postgres', format(
    $q$update public.ledger_entries set amount = amount + 1 where group_id = %L$q$, v_group));
  perform pg_temp.sim_blocked('L3', 'UPDATE a ledger row (even as the table owner)', v_res);

  v_res := pg_temp.sim_dml(v_owner, 'postgres', format(
    $q$delete from public.ledger_entries where group_id = %L$q$, v_group));
  perform pg_temp.sim_blocked('L4', 'DELETE a ledger row (even as the table owner)', v_res);

  if exists (select 1 from pg_trigger where tgname = 'prevent_ledger_truncate_trigger') then
    v_res := pg_temp.sim_dml(v_owner, 'postgres', 'truncate public.ledger_entries');
    perform pg_temp.sim_blocked('L5', 'TRUNCATE the ledger', v_res);
  else
    perform pg_temp.sim_log('L5', 'N/A', 'no TRUNCATE guard before 017 (not executed: it would lock the real ledger)');
  end if;

  if exists (select 1 from pg_trigger where tgname = 'penalty_allocations_sum_check') then
    begin
      insert into public.penalties (occurrence_id, offender_id, amount, status, snapshot)
      values (v_checkin5, v_member, 10, 'active', '{}'::jsonb) returning id into v_pen;
      insert into public.penalty_allocations (penalty_id, receiver_id, share) values (v_pen, v_owner, 3);
      set constraints public.penalty_allocations_sum_check immediate;
      perform pg_temp.sim_log('L6', 'FAIL', 'allocations summing to 3 for a 10 penalty were accepted');
    exception when others then
      perform pg_temp.sim_log('L6', 'PASS', 'allocation sum is enforced | ' || left(sqlerrm, 70));
    end;
  else
    perform pg_temp.sim_log('L6', 'N/A', 'allocation-sum trigger is not attached before 017');
  end if;

  -- ---------------------------------------------------------------- privileges
  perform pg_temp.sim_log('G1',
    case when has_table_privilege('anon', 'public.profiles', 'select') then 'FAIL' else 'PASS' end,
    'anon table privileges on profiles');
  perform pg_temp.sim_log('G2',
    case when has_function_privilege('anon', 'public.record_peer_settlement(uuid,uuid,bigint,text,text)', 'execute') then 'FAIL' else 'PASS' end,
    'anon EXECUTE on record_peer_settlement');
  perform pg_temp.sim_log('G3',
    case when has_table_privilege('authenticated', 'public.ledger_entries', 'truncate') then 'FAIL' else 'PASS' end,
    'signed-in TRUNCATE on ledger_entries');
  perform pg_temp.sim_log('G4',
    case when has_function_privilege('authenticated', 'public.handle_updated_at()', 'execute') then 'FAIL' else 'PASS' end,
    'signed-in EXECUTE on trigger function handle_updated_at');

  -- ---------------------------------------------------------------- report (always aborts)
  -- The CLI cuts error text at ~1000 characters, so: counts first, then one letter per test
  -- (P pass, F fail, M masked, N n/a, I info), then short details for anything that is not a pass.
  select count(*) filter (where verdict = 'PASS'),
         count(*) filter (where verdict = 'FAIL'),
         count(*) filter (where verdict = 'MASKED'),
         string_agg(id || '=' || left(verdict, 1), ' ' order by n),
         left(string_agg(id || ' ' || left(detail, 70), E'\n' order by n) filter (where verdict <> 'PASS'), 450)
    into v_pass, v_fail, v_masked, v_report, v_detail
  from sim_results;

  raise exception E'SIM %P %F %M (rolled back)\n%\n%',
    v_pass, v_fail, v_masked, v_report, coalesce(v_detail, 'no non-pass lines');
end
$sim$;
