'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createHabitSchema = z.object({
  group_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quantity', 'custom']),
  target_quantity: z.number().int().positive().default(1),
  timezone: z.string().default('UTC'),
})

export interface Habit {
  id: string
  group_id: string
  name: string
  timezone: string
  created_at: string
  group: {
    id: string
    name: string
    penalty_amount: number
    currency: string
  }
  schedule: {
    id: string
    frequency: string
    target_quantity: number
    custom_cron: string | null
  }
  occurrences: {
    id: string
    period_start: string
    period_end: string
    status: string
  }[]
}

export async function getUserHabits(userId?: string): Promise<{ habits: Habit[] | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { habits: null, error: 'Not authenticated' }
  }

  // Get user's group memberships
  const { data: memberships, error: memError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .is('left_at', null)

  if (memError) {
    return { habits: null, error: memError.message }
  }

  const groupIds = (memberships as any[] | null)?.map(m => m.group_id) || []
  if (groupIds.length === 0) {
    return { habits: [], error: null }
  }

  const { data, error } = await supabase
    .from('habits' as any)
    .select(`
      id,
      group_id,
      name,
      timezone,
      created_at,
      group:groups (
        id,
        name,
        penalty_amount,
        currency
      ),
      schedule:habit_schedules (
        id,
        frequency,
        target_quantity,
        custom_cron
      ),
      occurrences:habit_occurrences (
        id,
        period_start,
        period_end,
        status
      )
    `)
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })

  if (error) {
    return { habits: null, error: error.message }
  }

  // Transform to flatten nested data
  const habits = (data as any[]).map(h => ({
    ...h,
    group: h.groups || h.group,
    schedule: h.habit_schedules?.[0] || h.schedule
  }))

  return { habits: habits as Habit[], error: null }
}

export async function getGroupHabits(groupId: string): Promise<{ habits: Habit[] | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { habits: null, error: 'Not authenticated' }
  }

  // Verify user is a member of the group
  const { data: memberData, error: memberError } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .is('left_at', null)
    .single()

  if (memberError || !memberData) {
    return { habits: null, error: 'Not authorized' }
  }

  const { data, error } = await supabase
    .from('habits' as any)
    .select(`
      id,
      group_id,
      name,
      timezone,
      created_at,
      group:groups (
        id,
        name,
        penalty_amount,
        currency
      ),
      schedule:habit_schedules (
        id,
        frequency,
        target_quantity,
        custom_cron
      ),
      occurrences:habit_occurrences (
        id,
        period_start,
        period_end,
        status
      )
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (error) {
    return { habits: null, error: error.message }
  }

  return { habits: data as Habit[], error: null }
}

export async function createHabit(formData: FormData): Promise<{ habit: Habit | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { habit: null, error: 'Not authenticated' }
  }

  const rawData = {
    group_id: formData.get('group_id'),
    name: formData.get('name'),
    frequency: formData.get('frequency'),
    target_quantity: parseInt(formData.get('target_quantity') as string, 10),
    timezone: formData.get('timezone') as string,
  }

  const result = createHabitSchema.safeParse(rawData)
  if (!result.success) {
    return { habit: null, error: result.error.errors[0].message }
  }

  const { group_id, name, frequency, target_quantity, timezone } = result.data

  // Verify user is admin/owner of the group
  const { data: memberData, error: memberError } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', group_id)
    .eq('user_id', user.id)
    .is('left_at', null)
    .single()

  if (memberError || !memberData) {
    return { habit: null, error: 'Not authorized' }
  }

  if (!['owner', 'admin'].includes(memberData.role)) {
    return { habit: null, error: 'Only admins can create habits' }
  }

  // Create the habit
  const { data: habit, error: habitError } = await supabase
    .from('habits')
    .insert({
      group_id,
      name,
      timezone,
    })
    .select(`
      id,
      group_id,
      name,
      timezone,
      created_at,
      group:groups (
        id,
        name,
        penalty_amount,
        currency
      ),
      schedule:habit_schedules (
        id,
        frequency,
        target_quantity,
        custom_cron
      )
    `)
    .single()

  if (habitError) {
    return { habit: null, error: habitError.message }
  }

  // Create the schedule
  const { error: scheduleError } = await supabase
    .from('habit_schedules')
    .insert({
      habit_id: habit.id,
      frequency,
      target_quantity,
    })

  if (scheduleError) {
    return { habit: null, error: scheduleError.message }
  }

  // Transform the habit data to include occurrences if present
  const habitWithOccurrences = { ...habit, occurrences: [] }
  return { habit: habitWithOccurrences as unknown as Habit, error: null }
}