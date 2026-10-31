-- 001_extensions_and_enums.sql
-- Enable required extensions and define enums

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- Custom enums
create type user_role as enum ('owner', 'admin', 'member');
create type invitation_status as enum ('pending', 'accepted', 'rejected', 'revoked', 'expired');
create type habit_frequency as enum ('daily', 'weekly', 'monthly', 'quantity', 'custom');
create type checkin_status as enum ('pending', 'submitted', 'verified', 'missed', 'disputed', 'excused');
create type verification_mode as enum ('self_reported', 'peer_review', 'admin_review', 'evidence_required');
create type penalty_status as enum ('active', 'paid', 'disputed', 'reversed', 'partially_paid');
create type payment_status as enum ('pending', 'confirmed', 'rejected');
create type notification_type as enum (
  'daily_reminder', 'upcoming_deadline', 'missed_commitment',
  'successful_checkin', 'invitation', 'new_member',
  'disputed_checkin', 'new_penalty', 'payment_request',
  'payment_confirmation', 'weekly_report'
);

-- Updated at trigger function
create or replace function public.handle_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;