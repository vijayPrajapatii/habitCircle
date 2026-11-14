'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Mirrors the limits enforced in the database (create_group_invitation): the client is never trusted,
// but rejecting here gives a clear message without a round trip.
const createInvitationSchema = z.object({
  group_id: z.string().uuid('Invalid group'),
  max_uses: z.number().int().min(1, 'Max uses must be at least 1').max(100, 'Max uses cannot exceed 100'),
  expires_in_days: z.number().int().min(1, 'Expiry must be at least 1 day').max(90, 'Expiry cannot exceed 90 days'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').nullable(),
})

function intOrDefault(raw: FormDataEntryValue | null, fallback: number): number {
  const parsed = parseInt(String(raw ?? ''), 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export async function createInvitation(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const rawEmail = String(formData.get('email') ?? '').trim()
  const result = createInvitationSchema.safeParse({
    group_id: formData.get('group_id'),
    max_uses: intOrDefault(formData.get('max_uses'), 1),
    expires_in_days: intOrDefault(formData.get('expires_in_days'), 7),
    email: rawEmail === '' ? null : rawEmail,
  })
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { group_id, max_uses, expires_in_days, email } = result.data

  // p_created_by is kept for compatibility with the deployed function signature; the database
  // ignores it and always uses the authenticated user. Role checks happen in the function.
  const { data, error } = await supabase.rpc('create_group_invitation', {
    p_group_id: group_id,
    p_created_by: user.id,
    p_max_uses: max_uses,
    p_expires_in: `${expires_in_days} days`,
    p_email: email,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/dashboard/groups/${group_id}`)
  return { invitation: data }
}

export async function revokeInvitation(invitationId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  if (!z.string().uuid().safeParse(invitationId).success) {
    return { error: 'Invalid invitation' }
  }

  // Row-level security limits this to owners/admins of the invitation's group. When it matches
  // nothing (not allowed, or already gone) PostgREST returns no error, so check the rows.
  const { data, error } = await supabase
    .from('group_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .select('id')

  if (error) {
    return { error: error.message }
  }
  if (!data || data.length === 0) {
    return { error: 'Invitation not found, or you are not allowed to revoke it' }
  }

  revalidatePath('/dashboard/groups')
  return { success: true }
}

export async function acceptInvitation(code: string | null, linkToken: string | null) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data, error } = await supabase.rpc('accept_group_invitation', {
    p_code: code,
    p_link_token: linkToken,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/groups')
  return { member: data }
}
