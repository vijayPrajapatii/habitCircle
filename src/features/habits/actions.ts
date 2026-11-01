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
  created_by: string | null
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
  creator: {
    id: string
    username: string
  } | null
  checkins: {
    id: string
    profile_id: string
    quantity: number
    status: string
    profile: {
      username: string
    } | null
  }[]
}

async function addCurrentActivity(supabase: Awaited<ReturnType<typeof createClient>>, habits: any[]) {
  const scheduleIds = habits.map(habit => habit.habit_schedules?.[0]?.id).filter(Boolean)
  if (!scheduleIds.length) {
    return habits.map(habit => ({ ...habit, occurrences: [], checkins: [] }))
  }

  const { data: occurrences } = await supabase
    .from('habit_occurrences' as any)
    .select(`
      id,
      schedule_id,
      period_start,
      period_end,
      status,
      checkins:habit_checkins (
        id,
        profile_id,
        quantity,
        status,
        profile:profiles (username)
      )
    `)
    .in('schedule_id', scheduleIds)
    .gte('period_end', new Date().toISOString())
    .order('period_start', { ascending: false })

  return habits.map(habit => {
    const schedule = habit.habit_schedules?.[0]
    const occurrence = (occurrences as any[] | null)?.find(item => item.schedule_id === schedule?.id)
    return {
      ...habit,
      occurrences: occurrence ? [occurrence] : [],
      checkins: occurrence?.checkins || [],
    }
  })
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
      created_by,
      name,
      timezone,
      created_at,
      creator:profiles!habits_created_by_fkey (id, username),
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
  const habitsWithActivity = await addCurrentActivity(supabase, habits)

  return { habits: habitsWithActivity as Habit[], error: null }
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
      created_by,
      name,
      timezone,
      created_at,
      creator:profiles!habits_created_by_fkey (id, username),
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
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (error) {
    return { habits: null, error: error.message }
  }

  const habits = (data as any[]).map(habit => ({
    ...habit,
    group: habit.groups || habit.group,
    schedule: habit.habit_schedules?.[0] || habit.schedule,
  }))
  const habitsWithActivity = await addCurrentActivity(supabase, habits)

  return { habits: habitsWithActivity as Habit[], error: null }
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

  // Verify user is an active member of the group.
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

  // Create the habit
  const { data: habit, error: habitError } = await supabase
    .from('habits')
    .insert({
      group_id,
      created_by: user.id,
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

const checkInSchema = z.object({
  habit_id: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
})

export async function checkInHabit(
  habitId: string,
  quantity = 1,
): Promise<{ checkin: { id: string } | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { checkin: null, error: 'Not authenticated' }
  }

  const result = checkInSchema.safeParse({ habit_id: habitId, quantity })
  if (!result.success) {
    return { checkin: null, error: result.error.errors[0].message }
  }

  const { data: habit } = await supabase
    .from('habits' as any)
    .select('id, group_id, habit_schedules(id)')
    .eq('id', result.data.habit_id)
    .single()
  const scheduleId = (habit as any)?.habit_schedules?.[0]?.id
  if (!habit || !scheduleId) {
    return { checkin: null, error: 'Habit schedule not found' }
  }

  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', habit.group_id)
    .eq('user_id', user.id)
    .is('left_at', null)
    .single()
  if (!membership) {
    return { checkin: null, error: 'Not authorized' }
  }

  const periodStart = new Date()
  periodStart.setUTCHours(0, 0, 0, 0)
  const periodEnd = new Date(periodStart)
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 1)

  let { data: occurrence } = await supabase
    .from('habit_occurrences' as any)
    .select('id')
    .eq('schedule_id', scheduleId)
    .eq('period_start', periodStart.toISOString())
    .maybeSingle()

  if (!occurrence) {
    const created = await supabase
      .from('habit_occurrences' as any)
      .insert({
        schedule_id: scheduleId,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
      })
      .select('id')
      .single()
    occurrence = created.data
    if (created.error && !occurrence) {
      return { checkin: null, error: created.error.message }
    }
  }

  const { data: checkin, error } = await supabase
    .from('habit_checkins' as any)
    .insert({
      occurrence_id: occurrence.id,
      profile_id: user.id,
      quantity: result.data.quantity,
      status: 'submitted',
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { checkin: null, error: 'You already checked in for this period' }
    }
    return { checkin: null, error: error.message }
  }

  return { checkin, error: null }
}