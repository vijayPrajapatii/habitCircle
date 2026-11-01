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

  const { data: group, error: groupError } = await supabase
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

  if (groupError) {
    return { error: groupError.message }
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

  return { group }
}