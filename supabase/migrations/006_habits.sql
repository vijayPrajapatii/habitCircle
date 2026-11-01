-- 006_habits.sql
-- Core habit tracking tables: habits, habit_versions, habit_schedules, habit_occurrences, habit_checkins

-- Habits table
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for habits
create index if not exists habits_group_id_idx on public.habits (group_id);

-- Habit Versions - creates a new version when habit is edited
create table if not exists public.habit_versions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  version integer not null,
  payload jsonb not null,
  effective_from timestamptz not null default now()
);

-- Ensure unique version per habit
create unique index if not exists habit_versions_unique per habit on public.habit_versions (habit_id, version);

-- Habit Schedules
create table if not exists public.habit_schedules (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'quantity', 'custom')),
  target_quantity integer not null default 1,
  custom_cron text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists habit_schedules_habit_id_idx on public.habit_schedules (habit_id);

-- Habit Occurrences - one per evaluation period
create table if not exists public.habit_occurrences (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.habit_schedules(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null check (status in ('pending', 'evaluated')) default 'pending',
  created_at timestamptz not null default now()
);

-- Ensure one occurrence per schedule per period
create unique index if not exists habit_occurrences_unique on public.habit_occurrences (schedule_id, period_start);

-- Indexes
create index if not exists habit_occurrences_schedule_id_idx on public.habit_occurrences (schedule_id);
create index if not exists habit_occurrences_period_idx on public.habit_occurrences (period_start, period_end);

-- Habit Checkins - when a member submits check-in
create table if not exists public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.habit_occurrences(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null default 1,
  status text not null check (status in ('pending', 'submitted', 'verified', 'missed', 'disputed', 'excused')) default 'pending',
  created_at timestamptz not null default now()
);

-- One checkin per user per occurrence
create unique index if not exists habit_checkins_unique on public.habit_checkins (occurrence_id, profile_id);

-- Indexes
create index if not exists habit_checkins_occurrence_id_idx on public.habit_checkins (occurrence_id);
create index if not exists habit_checkins_profile_id_idx on public.habit_checkins (profile_id);

-- Checkin Evidence
create table if not exists public.checkin_evidence (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.habit_checkins(id) on delete cascade,
  storage_path text not null,
  uploaded_at timestamptz,
  status text not null check (status in ('required', 'uploaded', 'rejected')) default 'required'
);

-- Checkin Reviews
create table if not exists public.checkin_reviews (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.habit_checkins(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check (decision in ('approved', 'rejected', 'escalated')),
  comment text,
  created_at timestamptz not null default now()
);

-- Ensure one review per reviewer per checkin
create unique index if not exists checkin_reviews_unique on public.checkin_reviews (checkin_id, reviewer_id);

-- Enable RLS on all new tables
alter table public.habits enable row level security;
alter table public.habit_versions enable row level security;
alter table public.habit_schedules enable row level security;
alter table public.habit_occurrences enable row level security;
alter table public.habit_checkins enable row level security;
alter table public.checkin_evidence enable row level security;
alter table public.checkin_reviews enable row level security;

-- RLS Policies for habits
create policy "habits_select_member" on public.habits for select using (
  exists (
    select 1 from public.group_members
    where group_id = habits.group_id
    and user_id = auth.uid()
    and left_at is null
  )
);

create policy "habits_insert_member" on public.habits for insert with check (
  exists (
    select 1 from public.group_members
    where group_id = habits.group_id
    and user_id = auth.uid()
    and left_at is null
    and role in ('owner', 'admin')
  )
);

create policy "habits_update_member" on public.habits for update using (
  exists (
    select 1 from public.group_members
    where group_id = habits.group_id
    and user_id = auth.uid()
    and left_at is null
    and role in ('owner', 'admin')
  )
);

-- RLS Policies for habit_schedules
create policy "habit_schedules_select_member" on public.habit_schedules for select using (
  exists (
    select 1 from public.habits h
    join public.group_members gm on gm.group_id = h.group_id
    where h.id = habit_schedules.habit_id
    and gm.user_id = auth.uid()
    and gm.left_at is null
  )
);

-- RLS Policies for habit_occurrences
create policy "habit_occurrences_select_member" on public.habit_occurrences for select using (
  exists (
    select 1 from public.habit_schedules hs
    join public.habits h on h.id = hs.habit_id
    join public.group_members gm on gm.group_id = h.group_id
    where hs.id = habit_occurrences.schedule_id
    and gm.user_id = auth.uid()
    and gm.left_at is null
  )
);

-- RLS Policies for habit_checkins
create policy "habit_checkins_select_member" on public.habit_checkins for select using (
  exists (
    select 1 from public.habit_occurrences ho
    join public.habit_schedules hs on hs.id = ho.schedule_id
    join public.habits h on h.id = hs.habit_id
    join public.group_members gm on gm.group_id = h.group_id
    where ho.id = habit_checkins.occurrence_id
    and gm.user_id = auth.uid()
    and gm.left_at is null
  )
);

create policy "habit_checkins_insert_own" on public.habit_checkins for insert with check (
  exists (
    select 1 from public.habit_occurrences ho
    join public.habit_schedules hs on hs.id = ho.schedule_id
    join public.habits h on h.id = hs.habit_id
    join public.group_members gm on gm.group_id = h.group_id
    where ho.id = habit_checkins.occurrence_id
    and gm.user_id = auth.uid()
    and gm.left_at is null
  )
);

-- RLS Policies for checkin_reviews
create policy "checkin_reviews_select_member" on public.checkin_reviews for select using (
  exists (
    select 1 from public.habit_checkins hc
    join public.habit_occurrences ho on ho.id = hc.occurrence_id
    join public.habit_schedules hs on hs.id = ho.schedule_id
    join public.habits h on h.id = hs.habit_id
    join public.group_members gm on gm.group_id = h.group_id
    where hc.id = checkin_reviews.checkin_id
    and gm.user_id = auth.uid()
    and gm.left_at is null
    and gm.role in ('owner', 'admin')
  )
);

-- Triggers for updated_at
create trigger habits_updated_at
  before update on public.habits
  for each row execute function public.handle_updated_at();

create trigger habit_schedules_updated_at
  before update on public.habit_schedules
  for each row execute function public.handle_updated_at();