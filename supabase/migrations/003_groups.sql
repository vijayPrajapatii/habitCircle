-- 003_groups.sql
-- Groups and group memberships

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  penalty_amount integer not null default 1000, -- in minor units (paise)
  currency text not null default 'INR',
  timezone text not null default 'UTC',
  max_members integer not null default 10,
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint penalty_amount_positive check (penalty_amount > 0),
  constraint max_members_range check (max_members between 2 and 50)
);

-- Group members
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role user_role not null default 'member',
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

-- Partial unique index for active memberships (one active membership per user per group)
create unique index if not exists group_members_active_unique
  on public.group_members (group_id, user_id)
  where left_at is null;

-- Enable RLS
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Helper functions for RLS
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = p_user_id
      and left_at is null
  )
$$;

create or replace function public.has_group_role(p_group_id uuid, p_user_id uuid, p_roles user_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = p_user_id
      and left_at is null
      and role = any(p_roles)
  )
$$;

-- Groups RLS Policies
-- Members can read groups they belong to
create policy "groups_select_member"
  on public.groups for select
  using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id
        and user_id = auth.uid()
        and left_at is null
    )
  );

-- Owner can update group
create policy "groups_update_owner"
  on public.groups for update
  using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id
        and user_id = auth.uid()
        and left_at is null
        and role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.group_members
      where group_id = groups.id
        and user_id = auth.uid()
        and left_at is null
        and role = 'owner'
    )
  );

-- Authenticated users can create groups
create policy "groups_insert_authenticated"
  on public.groups for insert
  with check (auth.uid() is not null);

-- Group members RLS Policies
-- Members can read group members of groups they belong to
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

-- Owner/Admin can add members
create policy "group_members_insert_admin"
  on public.group_members for insert
  with check (
    exists (
      select 1 from public.group_members
      where group_id = group_members.group_id
        and user_id = auth.uid()
        and left_at is null
        and role in ('owner', 'admin')
    )
  );

-- Owner/Admin can update roles
create policy "group_members_update_admin"
  on public.group_members for update
  using (
    exists (
      select 1 from public.group_members
      where group_id = group_members.group_id
        and user_id = auth.uid()
        and left_at is null
        and role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.group_members
      where group_id = group_members.group_id
        and user_id = auth.uid()
        and left_at is null
        and role in ('owner', 'admin')
    )
  );

-- Members can leave (update left_at)
create policy "group_members_leave_self"
  on public.group_members for update
  using (user_id = auth.uid() and left_at is null)
  with check (user_id = auth.uid() and left_at is not null);

-- Owner can remove members
create policy "group_members_delete_owner"
  on public.group_members for delete
  using (
    exists (
      select 1 from public.group_members
      where group_id = group_members.group_id
        and user_id = auth.uid()
        and left_at is null
        and role = 'owner'
    )
  );

-- Triggers for updated_at
create trigger groups_updated_at
  before update on public.groups
  for each row execute function public.handle_updated_at();

-- Indexes
create index if not exists groups_created_by_idx on public.groups (created_by);
create index if not exists group_members_group_id_idx on public.group_members (group_id);
create index if not exists group_members_user_id_idx on public.group_members (user_id);