-- 004_invitations.sql
-- Group invitations with links and codes

create table if not exists public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  code text not null unique, -- short high-entropy code
  link_token uuid not null unique default gen_random_uuid(), -- for invite links
  email text, -- optional: if sent to specific email
  max_uses integer not null default 1,
  uses_count integer not null default 0,
  status invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint max_uses_positive check (max_uses > 0),
  constraint uses_not_exceed_max check (uses_count <= max_uses)
);

-- Enable RLS
alter table public.group_invitations enable row level security;

-- RLS Policies
-- Group owner/admin can read all invitations for their groups
create policy "invitations_select_admin"
  on public.group_invitations for select
  using (
    exists (
      select 1 from public.group_members
      where group_id = group_invitations.group_id
        and user_id = auth.uid()
        and left_at is null
        and role in ('owner', 'admin')
    )
  );

-- Group owner/admin can create invitations
create policy "invitations_insert_admin"
  on public.group_invitations for insert
  with check (
    exists (
      select 1 from public.group_members
      where group_id = group_invitations.group_id
        and user_id = auth.uid()
        and left_at is null
        and role in ('owner', 'admin')
    )
  );

-- Group owner/admin can revoke/update invitations
create policy "invitations_update_admin"
  on public.group_invitations for update
  using (
    exists (
      select 1 from public.group_members
      where group_id = group_invitations.group_id
        and user_id = auth.uid()
        and left_at is null
        and role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.group_members
      where group_id = group_invitations.group_id
        and user_id = auth.uid()
        and left_at is null
        and role in ('owner', 'admin')
    )
  );

-- Public can read invitation by code or token (for acceptance) - SELECT only, no WITH CHECK
create policy "invitations_select_public"
  on public.group_invitations for select
  using (true);

-- Trigger for updated_at
create trigger group_invitations_updated_at
  before update on public.group_invitations
  for each row execute function public.handle_updated_at();

-- Indexes
create index if not exists group_invitations_group_id_idx on public.group_invitations (group_id);
create index if not exists group_invitations_code_idx on public.group_invitations (code);
create index if not exists group_invitations_link_token_idx on public.group_invitations (link_token);
create index if not exists group_invitations_status_idx on public.group_invitations (status);
create index if not exists group_invitations_expires_at_idx on public.group_invitations (expires_at);

-- Function to generate short code
create or replace function public.generate_invite_code()
returns text language plpgsql volatile as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no confusing chars
  code text := '';
  i int;
begin
  for i in 1..8 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return code;
end $$;

-- Function to create invitation
create or replace function public.create_group_invitation(
  p_group_id uuid,
  p_created_by uuid,
  p_max_uses integer default 1,
  p_expires_in interval default '7 days',
  p_email text default null
)
returns public.group_invitations language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.group_invitations;
begin
  -- Verify creator is admin/owner
  if not public.has_group_role(p_group_id, p_created_by, array['owner', 'admin']) then
    raise exception 'Only owner or admin can create invitations';
  end if;

  -- Check abuse limit: max 50 active invitations per group
  if (
    select count(*) from public.group_invitations
    where group_id = p_group_id and status = 'pending' and expires_at > now()
  ) >= 50 then
    raise exception 'Too many active invitations for this group';
  end if;

  insert into public.group_invitations (group_id, created_by, code, max_uses, expires_at, email)
  values (p_group_id, p_created_by, public.generate_invite_code(), p_max_uses, now() + p_expires_in, p_email)
  returning * into v_invitation;

  return v_invitation;
end $$;

-- Function to accept invitation
create or replace function public.accept_group_invitation(
  p_code text default null,
  p_link_token uuid default null
)
returns public.group_members language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.group_invitations;
  v_member public.group_members;
begin
  -- Find invitation by code or link token
  select * into v_invitation
  from public.group_invitations
  where (p_code is not null and code = p_code)
     or (p_link_token is not null and link_token = p_link_token)
  limit 1;

  if not found then
    raise exception 'Invalid invitation';
  end if;

  -- Check invitation status
  if v_invitation.status != 'pending' then
    raise exception 'Invitation is no longer valid';
  end if;

  -- Check expiration
  if v_invitation.expires_at < now() then
    update public.group_invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'Invitation has expired';
  end if;

  -- Check max uses
  if v_invitation.uses_count >= v_invitation.max_uses then
    raise exception 'Invitation has reached maximum uses';
  end if;

  -- Check if user is already a member
  if public.is_group_member(v_invitation.group_id, auth.uid()) then
    raise exception 'Already a member of this group';
  end if;

  -- Check group max members
  if (
    select count(*) from public.group_members
    where group_id = v_invitation.group_id and left_at is null
  ) >= (
    select max_members from public.groups where id = v_invitation.group_id
  ) then
    raise exception 'Group has reached maximum members';
  end if;

  -- Check if email matches (if invitation was sent to specific email)
  if v_invitation.email is not null then
    if (select email from auth.users where id = auth.uid()) != v_invitation.email then
      raise exception 'This invitation was sent to a different email address';
    end if;
  end if;

  -- Add member
  insert into public.group_members (group_id, user_id, role)
  values (v_invitation.group_id, auth.uid(), 'member')
  returning * into v_member;

  -- Update invitation
  update public.group_invitations
  set uses_count = uses_count + 1,
      status = case when uses_count + 1 >= max_uses then 'accepted' else 'pending' end,
      updated_at = now()
  where id = v_invitation.id;

  return v_member;
end $$;