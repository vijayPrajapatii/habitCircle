'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500).optional(),
  penalty_amount: z.number().int().positive('Penalty must be positive'),
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
    return { error: result.error.errors[0].message }
  }

  const { name, description, penalty_amount, currency, timezone, max_members } = result.data

  const { data: group, error: groupError } = await supabase.rpc('create_group_with_owner', {
    p_name: name,
    p_description: description,
    p_penalty_amount: penalty_amount,
    p_currency: currency,
    p_timezone: timezone,
    p_max_members: max_members,
  })

  if (groupError) {
    return { error: groupError.message }
  }

  return { group }
}

const updateGroupNameSchema = z.object({
  group_id: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
})

export async function updateGroupName(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const result = updateGroupNameSchema.safeParse({
    group_id: formData.get('group_id'),
    name: formData.get('name'),
  })
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', result.data.group_id)
    .eq('user_id', user.id)
    .is('left_at', null)
    .single()

  if (membershipError || !membership || membership.role !== 'owner') {
    return { error: 'Only the group owner can rename this group' }
  }

  const { data: group, error } = await supabase
    .from('groups')
    .update({ name: result.data.name })
    .eq('id', result.data.group_id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { group }
}

const deleteGroupSchema = z.object({
  group_id: z.string().uuid(),
})

export async function deleteGroup(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const result = deleteGroupSchema.safeParse({
    group_id: formData.get('group_id'),
  })
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', result.data.group_id)
    .eq('user_id', user.id)
    .is('left_at', null)
    .single()

  if (membershipError || !membership || membership.role !== 'owner') {
    return { error: 'Only the group owner can delete this group' }
  }

  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', result.data.group_id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}