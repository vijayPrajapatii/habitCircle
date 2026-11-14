'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { SUPPORTED_CURRENCIES } from '@/domain/money'
import { isValidTimezone } from '@/domain/scheduling'

// Only currencies the app can format and display. There is no conversion.
const currencySchema = z.enum(SUPPORTED_CURRENCIES, {
  errorMap: () => ({ message: 'Choose one of the supported currencies' }),
})

const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500).optional(),
  penalty_amount: z.number({ invalid_type_error: 'Enter a valid penalty amount' }).int().positive('Penalty must be positive'),
  currency: currencySchema.default('INR'),
  timezone: z.string().default('UTC').refine(isValidTimezone, 'Invalid timezone'),
  max_members: z.number({ invalid_type_error: 'Max members must be a number' }).int().min(2, 'A circle needs at least 2 members').max(50, 'A circle can have at most 50 members').default(10),
})

/** Maps low-level database errors on delete to something a person can act on. */
function friendlyDeleteError(message: string): string {
  if (/ledger entries cannot be (updated|deleted)/i.test(message)) {
    return "This circle has recorded penalties, so it can't be deleted. The ledger is permanent."
  }
  return message
}

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
    currency: (formData.get('currency') as string) || undefined,
    timezone: (formData.get('timezone') as string) || undefined,
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

const updateGroupSettingsSchema = z.object({
  group_id: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500).optional().default(''),
  penalty_amount: z.number({ invalid_type_error: 'Enter a valid penalty amount' }).int().positive('Penalty must be positive'),
  currency: currencySchema.default('INR'),
  max_members: z.number({ invalid_type_error: 'Max members must be a number' }).int().min(2, 'A circle needs at least 2 members').max(50, 'A circle can have at most 50 members').default(10),
})

export async function updateGroupSettings(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const penaltyRaw = formData.get('penalty_amount')
  const maxMembersRaw = formData.get('max_members')

  const result = updateGroupSettingsSchema.safeParse({
    group_id: formData.get('group_id'),
    name: formData.get('name'),
    description: (formData.get('description') as string) || '',
    penalty_amount: typeof penaltyRaw === 'number' ? penaltyRaw : parseInt(penaltyRaw as string, 10),
    currency: (formData.get('currency') as string) || 'INR',
    max_members: typeof maxMembersRaw === 'number' ? maxMembersRaw : parseInt(maxMembersRaw as string, 10),
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
    return { error: 'Only the circle owner can edit circle stakes and settings' }
  }

  // Capacity must not drop below the people already in the circle.
  const { count: activeMembers } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', result.data.group_id)
    .is('left_at', null)

  if (activeMembers != null && result.data.max_members < activeMembers) {
    return { error: `This circle already has ${activeMembers} members, so capacity can't be set below that.` }
  }

  const { data: group, error } = await supabase
    .from('groups')
    .update({
      name: result.data.name,
      description: result.data.description,
      penalty_amount: result.data.penalty_amount,
      currency: result.data.currency,
      max_members: result.data.max_members,
      updated_at: new Date().toISOString(),
    })
    .eq('id', result.data.group_id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { group }
}

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
    return { error: friendlyDeleteError(error.message) }
  }

  return { success: true }
}