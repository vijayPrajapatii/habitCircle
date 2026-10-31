'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createInvitation(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const groupId = formData.get('group_id') as string
  const maxUses = parseInt(formData.get('max_uses') as string, 10) || 1
  const expiresInDays = parseInt(formData.get('expires_in_days') as string, 10) || 7
  const email = formData.get('email') as string || null

  const { data, error } = await supabase.rpc('create_group_invitation', {
    p_group_id: groupId,
    p_created_by: user.id,
    p_max_uses: maxUses,
    p_expires_in: `${expiresInDays} days`,
    p_email: email,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/dashboard/groups/${groupId}`)
  return { invitation: data }
}

export async function revokeInvitation(invitationId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('group_invitations')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', invitationId)

  if (error) {
    return { error: error.message }
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