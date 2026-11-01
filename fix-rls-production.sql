-- Fix RLS policies for group creation flow
-- Run this in Supabase Dashboard > SQL Editor
-- This fixes the issue: "new row violates row-level security policy for table 'groups'"

-- 1. Fix groups INSERT policy
-- Allows any authenticated user to create a group
DROP POLICY IF EXISTS "groups_insert_authenticated" ON public.groups;
CREATE POLICY "groups_insert_authenticated"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Drop recursive/infinite policies on group_members
DROP POLICY IF EXISTS "group_members_insert_admin" ON public.group_members;
DROP POLICY IF EXISTS "group_members_update_admin" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete_owner" ON public.group_members;

-- 3. Create new safe policies for group_members
-- Allows users to insert their own membership (when creating a group or joining)
DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;
CREATE POLICY "group_members_insert_self"
  ON public.group_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allows users to update their own membership (to leave)
DROP POLICY IF EXISTS "group_members_update_self" ON public.group_members;
CREATE POLICY "group_members_update_self"
  ON public.group_members FOR UPDATE
  USING (user_id = auth.uid());

-- Allows group owner to update other members (for role changes)
DROP POLICY IF EXISTS "group_members_update_owner" ON public.group_members;
CREATE POLICY "group_members_update_owner"
  ON public.group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.left_at IS NULL
        AND gm.role = 'owner'
    )
  );

-- Allows group owner to delete members
DROP POLICY IF EXISTS "group_members_delete_owner" ON public.group_members;
CREATE POLICY "group_members_delete_owner"
  ON public.group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_members.group_id
        AND user_id = auth.uid()
        AND left_at IS NULL
        AND role = 'owner'
    )
  );

-- 4. Fix groups SELECT policy (members can read groups they belong to)
DROP POLICY IF EXISTS "groups_select_member" ON public.groups;
CREATE POLICY "groups_select_member"
  ON public.groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = groups.id
        AND user_id = auth.uid()
        AND left_at IS NULL
    )
  );

-- 5. Fix groups UPDATE policy (owner can update)
DROP POLICY IF EXISTS "groups_update_owner" ON public.groups;
CREATE POLICY "groups_update_owner"
  ON public.groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = groups.id
        AND user_id = auth.uid()
        AND left_at IS NULL
        AND role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = groups.id
        AND user_id = auth.uid()
        AND left_at IS NULL
        AND role = 'owner'
    )
  );

-- 6. Re-enable RLS on groups if it got disabled
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- 7. Remove the recursive membership read policy
DROP POLICY IF EXISTS "group_members_select_member" ON public.group_members;
DROP POLICY IF EXISTS "group_members_select_own" ON public.group_members;
DROP POLICY IF EXISTS "group_members_select_self" ON public.group_members;
CREATE POLICY "group_members_select_self"
  ON public.group_members FOR SELECT
  USING (user_id = auth.uid());

-- 8. Allow group admins and owners to create habit schedules
DROP POLICY IF EXISTS "habit_schedules_insert_admin" ON public.habit_schedules;
CREATE POLICY "habit_schedules_insert_admin"
  ON public.habit_schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.habits h
      JOIN public.group_members gm ON gm.group_id = h.group_id
      WHERE h.id = habit_schedules.habit_id
        AND gm.user_id = auth.uid()
        AND gm.left_at IS NULL
        AND gm.role IN ('owner', 'admin')
    )
  );

-- 9. Make group creation atomic and return the created group safely
CREATE OR REPLACE FUNCTION public.create_group_with_owner(
  p_name TEXT,
  p_description TEXT,
  p_penalty_amount INTEGER,
  p_currency TEXT,
  p_timezone TEXT,
  p_max_members INTEGER
)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_group public.groups;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.groups (name, description, penalty_amount, currency, timezone, max_members, created_by)
  VALUES (p_name, p_description, p_penalty_amount, p_currency, p_timezone, p_max_members, v_user_id)
  RETURNING * INTO v_group;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group.id, v_user_id, 'owner');

  RETURN v_group;
END;
$$;

REVOKE ALL ON FUNCTION public.create_group_with_owner(TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_with_owner(TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER) TO authenticated;

-- 10. Fix the invitation RPC's enum-array type resolution
CREATE OR REPLACE FUNCTION public.create_group_invitation(
  p_group_id UUID,
  p_created_by UUID,
  p_max_uses INTEGER DEFAULT 1,
  p_expires_in INTERVAL DEFAULT '7 days',
  p_email TEXT DEFAULT NULL
)
RETURNS public.group_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.group_invitations;
BEGIN
  IF NOT public.has_group_role(
    p_group_id,
    p_created_by,
    ARRAY['owner', 'admin']::public.user_role[]
  ) THEN
    RAISE EXCEPTION 'Only owner or admin can create invitations';
  END IF;

  IF (
    SELECT count(*)
    FROM public.group_invitations
    WHERE group_id = p_group_id
      AND status = 'pending'
      AND expires_at > now()
  ) >= 50 THEN
    RAISE EXCEPTION 'Too many active invitations for this group';
  END IF;

  INSERT INTO public.group_invitations (group_id, created_by, code, max_uses, expires_at, email)
  VALUES (
    p_group_id,
    p_created_by,
    public.generate_invite_code(),
    p_max_uses,
    now() + p_expires_in,
    p_email
  )
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
END;
$$;

REVOKE ALL ON FUNCTION public.create_group_invitation(UUID, UUID, INTEGER, INTERVAL, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_invitation(UUID, UUID, INTEGER, INTERVAL, TEXT) TO authenticated;

-- Success message
SELECT 'RLS policies fixed. Group and habit creation are ready.';