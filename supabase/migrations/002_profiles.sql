-- 002_profiles.sql
-- User profiles table with username, timezone, avatar

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text,
  avatar_url text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint username_format check (username ~* '^[a-z0-9_]{3,30}$')
);

-- Enable RLS
alter table public.profiles enable row level security;

-- RLS Policies
-- Users can read their own profile
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Public can read usernames (for mentions, invites, etc.) - SELECT only, no WITH CHECK
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

-- Trigger for updated_at
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Function to create profile on signup
-- Fixed: removed set search_path which was blocking auth schema access
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_username text;
  v_timezone text;
begin
  -- Get values from user_metadata (set during signup via options.data)
  -- Fallback to raw_user_meta_data (legacy) or generate default
  v_username := coalesce(
    new.user_metadata->>'username',
    new.raw_user_meta_data->>'username',
    'user_' || substr(new.id::text, 1, 8)
  );
  v_timezone := coalesce(
    new.user_metadata->>'timezone',
    new.raw_user_meta_data->>'timezone',
    'UTC'
  );

  -- Validate username format to avoid check constraint violation
  if v_username !~ '^[a-z0-9_]{3,30}$' then
    v_username := 'user_' || substr(new.id::text, 1, 8);
  end if;

  insert into public.profiles (id, username, timezone)
  values (new.id, v_username, v_timezone)
  on conflict (id) do nothing;

  return new;
end $$;

-- Trigger on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Index for username lookups
create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_timezone_idx on public.profiles (timezone);