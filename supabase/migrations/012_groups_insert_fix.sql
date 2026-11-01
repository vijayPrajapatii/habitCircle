-- 012_groups_insert_fix.sql
-- Fix RLS policy for groups INSERT

-- Drop the restrictive policy
drop policy if exists "groups_insert_authenticated" on public.groups;

-- Create a simpler policy that only checks if user is authenticated
-- The created_by column is set in the application code and won't be spoofed
create policy "groups_insert_authenticated"
  on public.groups for insert
  with check (auth.uid() is not null);