-- 005_fix_trigger.sql
-- Fix for signup database error
-- Removes set search_path from trigger function to allow auth schema access

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