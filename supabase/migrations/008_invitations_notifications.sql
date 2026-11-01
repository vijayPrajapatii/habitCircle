-- 008_invitations_notifications.sql
-- Group invitations and notifications

-- Check if group_invitations table needs to be recreated with inviter_id column
-- If table exists but missing inviter_id, we need to handle this
-- For a clean slate, drop and recreate:
drop table if exists public.group_invitations;

-- Group Invitations
create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  email text not null,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'revoked', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  joined_at timestamptz
);

-- One active invitation per group+email
create unique index if not exists group_invitations_active_unique
  on public.group_invitations (group_id, email)
  where status = 'pending';

-- Index for email lookup
create index if not exists group_invitations_email_idx on public.group_invitations (email);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('inapp', 'email', 'webpush')),
  payload jsonb not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Notifications for a user
create index if not exists notifications_profile_read_idx on public.notifications (profile_id, read_at);

-- Enable RLS
alter table public.group_invitations enable row level security;
alter table public.notifications enable row level security;

-- RLS Policies for group_invitations
create policy "group_invitations_select_inviter" on public.group_invitations for select using (
  inviter_id = auth.uid()
);

create policy "group_invitations_insert_inviter" on public.group_invitations for insert with check (
  inviter_id = auth.uid()
);

create policy "group_invitations_update_own" on public.group_invitations for update using (
  inviter_id = auth.uid() and status in ('pending', 'expired')
);

create policy "group_invitations_select_by_email" on public.group_invitations for select using (
  email = auth.uid()::text or email = (select email from public.profiles where id = auth.uid())
);

-- RLS Policies for notifications
create policy "notifications_select_own" on public.notifications for select using (
  profile_id = auth.uid()
);

create policy "notifications_insert" on public.notifications for insert with check (
  profile_id = auth.uid()
);

create policy "notifications_update_own" on public.notifications for update using (
  profile_id = auth.uid()
);

-- Function to mark old invitations as expired (can be called via cron)
create or replace function public.expire_old_invitations(expiry_hours integer default 48)
returns integer language plpgsql as $$
declare
  deleted_count integer;
begin
  update public.group_invitations
  set status = 'expired'
  where status = 'pending'
  and expires_at < now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end $$;

-- Trigger for updated_at
create trigger group_invitations_updated_at
  before update on public.group_invitations
  for each row execute function public.handle_updated_at();