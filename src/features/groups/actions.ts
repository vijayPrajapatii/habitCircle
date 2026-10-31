'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  penalty_amount: z.number().int().positive(),
  currency: z.string().length(3).default('INR'),
  timezone: z.string().default('UTC'),
  max_members: z.number().int().min(2).max(50).default(10),
})

export async function createGroup(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const rawData = {
    name: formData.get('name'),
    description: formData.get('description') || '',
    penalty_amount: parseInt(formData.get('penalty_amount') as string, 10),
    currency: formData.get('currency') as string,
    timezone: formData.get('timezone') as string,
    max_members: parseInt(formData.get('max_members') as string, 10),
  }

  const result = createGroupSchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input' }
  }

  const { name, description, penalty_amount, currency, timezone, max_members } = result.data

  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      name,
      description,
      penalty_amount,
      currency,
      timezone,
      max_members,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Add creator as owner
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: 'owner',
    })

  if (memberError) {
    return { error: memberError.message }
  }

  revalidatePath('/dashboard/groups')
  return { group }
}

export async function updateGroup(groupId: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const rawData = {
    name: formData.get('name'),
    description: formData.get('description') || '',
    penalty_amount: parseInt(formData.get('penalty_amount') as string, 10),
    currency: formData.get('currency') as string,
    timezone: formData.get('timezone') as string,
    max_members: parseInt(formData.get('max_members') as string, 10),
  }

  const result = createGroupSchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input' }
  }

  const { name, description, penalty_amount, currency, timezone, max_members } = result.data

  const { error } = await supabase
    .from('groups')
    .update({
      name,
      description,
      penalty_amount,
      currency,
      timezone,
      max_members,
    })
    .eq('id', groupId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/dashboard/groups/${groupId}`)
  revalidatePath('/dashboard/groups')
  return { success: true }
}

export async function archiveGroup(groupId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('groups')
    .update({ is_archived: true })
    .eq('id', groupId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/groups')
  return { success: true }
}

export async function leaveGroup(groupId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check if user is owner
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .is('left_at', null)
    .single()

  if (membership?.role === 'owner') {
    return { error: 'Owner must transfer ownership before leaving' }
  }

  const { error } = await supabase
    .from('group_members')
    .update({ left_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/groups')
  return { success: true }
}