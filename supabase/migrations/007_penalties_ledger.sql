-- 007_penalties_ledger.sql
-- Penalties, allocations, ledger entries, and payments

-- Payments table (must come before ledger_entries which references it)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  amount bigint not null check (amount > 0),
  status text not null check (status in ('pending', 'confirmed', 'rejected')) default 'pending',
  evidence_path text,
  created_at timestamptz not null default now()
);

-- Penalties table - one penalty per occurrence
create table if not exists public.penalties (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.habit_checkins(id) on delete cascade,
  offender_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  status text not null check (status in ('active', 'paid', 'disputed', 'reversed', 'partially_paid')) default 'active',
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- Ensure one penalty per occurrence
create unique index if not exists penalties_occurrence_unique on public.penalties (occurrence_id);

-- Penalty Allocations - shares distributed to receivers
create table if not exists public.penalty_allocations (
  penalty_id uuid not null references public.penalties(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  share bigint not null check (share > 0),
  primary key (penalty_id, receiver_id)
);

-- Penalty allocations trigger to enforce sum equals penalty amount
create or replace function public.enforce_penalty_allocation_sum()
returns trigger language plpgsql as $$
declare
  total_share bigint;
  penalty_amount bigint;
begin
  select sum(share) into total_share
  from public.penalty_allocations
  where penalty_id = NEW.penalty_id;

  select amount into penalty_amount
  from public.penalties
  where id = NEW.penalty_id;

  if total_share != penalty_amount then
    raise exception 'Penalty allocations must sum to penalty amount';
  end if;

  return NEW;
end $$;

-- Ledger Entries - append only
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  type text not null check (type in ('debit', 'credit', 'adjust')),
  amount bigint not null check (amount != 0),
  metadata jsonb,
  related_penalty_id uuid references public.penalties(id) on delete set null,
  related_payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Enable append-only for ledger entries
create or replace function public.prevent_ledger_update()
returns trigger language plpgsql as $$
begin
  raise exception 'Ledger entries cannot be updated';
  return null;
end $$;

create trigger prevent_ledger_update_trigger
  before update or delete on public.ledger_entries
  for each row execute function public.prevent_ledger_update();

create or replace function public.prevent_ledger_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Ledger entries cannot be deleted';
  return null;
end $$;

create trigger prevent_ledger_delete_trigger
  before delete on public.ledger_entries
  for each row execute function public.prevent_ledger_delete();

-- Payments must reference a pending penalty (for ledger entries linking to payments)
create or replace function public.validate_payment_penalty()
returns trigger language plpgsql as $$
declare
  penalty_status text;
begin
  select status into penalty_status
  from public.penalties
  where id = (select related_penalty_id from public.ledger_entries where id = NEW.id);

  if penalty_status != 'active' then
    raise exception 'Payment can only reference active penalty';
  end if;

  return NEW;
end $$;

-- Enable RLS
alter table public.penalties enable row level security;
alter table public.penalty_allocations enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payments enable row level security;

-- RLS Policies for penalties
create policy "penalties_select_member" on public.penalties for select using (
  exists (
    select 1 from public.habit_checkins hc
    join public.habit_occurrences ho on ho.id = hc.occurrence_id
    join public.habit_schedules hs on hs.id = ho.schedule_id
    join public.habits h on h.id = hs.habit_id
    join public.group_members gm on gm.group_id = h.group_id
    where hc.id = penalties.occurrence_id
    and (gm.user_id = auth.uid() or penalties.offender_id = auth.uid())
    and gm.left_at is null
  )
);

-- RLS Policies for payments
create policy "payments_select_sender_receiver" on public.payments for select using (
  sender_id = auth.uid() or receiver_id = auth.uid()
);

create policy "payments_insert" on public.payments for insert with check (
  sender_id = auth.uid()
);

create policy "payments_update_status" on public.payments for update using (
  receiver_id = auth.uid() and status = 'pending'
) with check (
  status in ('confirmed', 'rejected')
);

create policy "payments_delete_pending" on public.payments for delete using (
  sender_id = auth.uid() and status = 'pending'
);

-- Index for ledger by group
create index if not exists ledger_entries_group_id_idx on public.ledger_entries (group_id);
create index if not exists ledger_entries_created_at_idx on public.ledger_entries (created_at);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists penalties_status_idx on public.penalties (status);