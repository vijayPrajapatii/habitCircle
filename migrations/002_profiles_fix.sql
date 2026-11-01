-- Fix for profile creation during signup
-- This migration updates the trigger to also check user_metadata

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, timezone)
  values (
    new.id,
    coalesce(new.user_metadata->>'username', new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.user_metadata->>'timezone', new.raw_user_meta_data->>'timezone', 'UTC')
  )
  on conflict (id) do nothing;
  return new;
end $$;
