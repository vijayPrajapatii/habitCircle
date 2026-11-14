'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { getCurrentDailyPeriod, isSameInstant, isValidTimezone } from '@/domain/scheduling'
import { isCompletedCheckin } from '@/domain/checkin-state'

const createHabitSchema = z.object({
  group_id: z.string().uuid('Invalid circle'),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quantity', 'custom']),
  target_quantity: z
    .number({ invalid_type_error: 'Target must be a whole number between 1 and 100' })
    .int('Target must be a whole number between 1 and 100')
    .min(1, 'Target must be a whole number between 1 and 100')
    .max(100, 'Target must be a whole number between 1 and 100')
    .default(1),
  timezone: z
    .string()
    .default('UTC')
    .refine(isValidTimezone, 'Invalid timezone'),
  custom_cron: z.string().max(100).optional().nullable(),
})

/** Maps low-level database errors on delete to something a person can act on. */
function friendlyDeleteError(message: string, subject: string): string {
  if (/ledger entries cannot be (updated|deleted)/i.test(message)) {
    return `This ${subject} has recorded penalties, so it can't be deleted. The ledger is permanent.`
  }
  return message
}

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

/** An embedded relation arrives as an array (to-many) or an object (to-one). */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/**
 * Flatten the embedded `group` and `schedule` of a habits row.
 *
 * `habit_schedules.habit_id` is not unique, so PostgREST returns the
 * `schedule:habit_schedules(...)` embed as an ARRAY. Leaving it as an array made
 * `habit.schedule.id` undefined, which silently disabled every check-in lookup
 * and showed each habit as "daily, target 1".
 */
function normalizeHabitRow(row: any) {
  return {
    ...row,
    group: firstOf(row.group ?? row.groups),
    schedule: firstOf(row.schedule ?? row.habit_schedules),
  }
}

async function addCurrentActivity(supabase: Awaited<ReturnType<typeof createClient>>, habits: any[]) {
  const creatorIds = habits.map(habit => habit.created_by).filter(Boolean)
  const { data: creators } = creatorIds.length
    ? await supabase.from('profiles').select('id, username').in('id', creatorIds)
    : { data: [] }
  const creatorsById = new Map((creators || []).map(creator => [creator.id, creator]))

  const scheduleIds = habits
    .map(habit => habit.schedule?.id)
    .filter(Boolean)
  if (!scheduleIds.length) {
    return habits.map(habit => ({
      ...habit,
      creator: creatorsById.get(habit.created_by) || null,
      occurrences: [],
      checkins: [],
    }))
  }

  // The current period is midnight-to-midnight in each habit's OWN timezone
  // (a habit snapshots its timezone at creation), not UTC.
  const now = new Date()
  const periodStartByScheduleId = new Map<string, Date>()
  for (const habit of habits) {
    const scheduleId = habit.schedule?.id
    if (scheduleId) {
      periodStartByScheduleId.set(scheduleId, getCurrentDailyPeriod(habit.timezone, now).start)
    }
  }
  const distinctPeriodStarts = Array.from(
    new Set(Array.from(periodStartByScheduleId.values()).map(start => start.toISOString())),
  )

  // Only fetch occurrences that fall in a current period. This keeps the query
  // bounded as history grows and avoids ever showing a previous period's
  // check-in as if it were today's.
  const { data: occurrences } = await supabase
    .from('habit_occurrences' as any)
    .select('id, schedule_id, period_start, period_end, status')
    .in('schedule_id', scheduleIds)
    .in('period_start', distinctPeriodStarts)

  // PostgREST returns "+00:00" timestamps while Date#toISOString() returns "Z",
  // so compare instants, never strings.
  const currentPeriodOccurrences = new Map<string, any>()
  for (const occ of (occurrences as any[] | null) || []) {
    const expectedStart = periodStartByScheduleId.get(occ.schedule_id)
    if (expectedStart && isSameInstant(occ.period_start, expectedStart)) {
      currentPeriodOccurrences.set(occ.schedule_id, occ)
    }
  }

  const occurrenceIds = Array.from(currentPeriodOccurrences.values()).map(occurrence => occurrence.id)
  const { data: checkins } = occurrenceIds.length
    ? await supabase
      .from('habit_checkins' as any)
      .select('id, occurrence_id, profile_id, quantity, status')
      .in('occurrence_id', occurrenceIds)
    : { data: [] }
  const checkinProfileIds = (checkins as any[] | null)?.map(checkin => checkin.profile_id).filter(Boolean) || []
  const { data: checkinProfiles } = checkinProfileIds.length
    ? await supabase.from('profiles').select('id, username').in('id', checkinProfileIds)
    : { data: [] }
  const profilesById = new Map((checkinProfiles || []).map(profile => [profile.id, profile]))
  const checkinsByOccurrence = new Map<string, any[]>()
  for (const checkin of checkins || []) {
    const activity = {
      ...checkin,
      profile: profilesById.get(checkin.profile_id) || null,
    }
    const existing = checkinsByOccurrence.get(checkin.occurrence_id) || []
    checkinsByOccurrence.set(checkin.occurrence_id, [...existing, activity])
  }

  return habits.map(habit => {
    const scheduleId = habit.schedule?.id
    // No occurrence yet for the current period means nobody has checked in yet.
    const occurrence = scheduleId ? currentPeriodOccurrences.get(scheduleId) : null

    return {
      ...habit,
      creator: creatorsById.get(habit.created_by) || null,
      occurrences: occurrence ? [occurrence] : [],
      checkins: occurrence ? checkinsByOccurrence.get(occurrence.id) || [] : [],
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

  const habits = ((data as any[]) ?? []).map(normalizeHabitRow)
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

  const habits = ((data as any[]) ?? []).map(normalizeHabitRow)
  const habitsWithActivity = await addCurrentActivity(supabase, habits)

  return { habits: habitsWithActivity as Habit[], error: null }
}

export async function createHabit(formData: FormData): Promise<{ habit: Habit | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { habit: null, error: 'Not authenticated' }
  }

  const rawTarget = parseInt(String(formData.get('target_quantity') ?? ''), 10)
  const rawData = {
    group_id: formData.get('group_id'),
    name: formData.get('name'),
    frequency: formData.get('frequency'),
    // NaN would surface as a confusing zod message; let the schema reject it clearly.
    target_quantity: Number.isNaN(rawTarget) ? undefined : rawTarget,
    timezone: (formData.get('timezone') as string) || undefined,
    custom_cron: (formData.get('custom_cron') as string) || null,
  }

  const result = createHabitSchema.safeParse(rawData)
  if (!result.success) {
    return { habit: null, error: result.error.errors[0].message }
  }

  const { group_id, name, frequency, target_quantity, timezone, custom_cron } = result.data

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
      custom_cron: custom_cron || null,
    })

  if (scheduleError) {
    // Don't leave a habit without a schedule behind: it could never be checked
    // in and every screen would show it as "incomplete configuration".
    await supabase.from('habits').delete().eq('id', habit.id)
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
    .select('id, group_id, created_by, timezone, habit_schedules(id)')
    .eq('id', result.data.habit_id)
    .single()
  const scheduleId = (habit as any)?.habit_schedules?.[0]?.id
  if (!habit || !scheduleId) {
    return { checkin: null, error: 'Habit schedule not found' }
  }

  if ((habit as any).created_by !== user.id) {
    return { checkin: null, error: 'Only the habit creator can check in' }
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

  // The day is defined by the habit's own timezone, not UTC and not the
  // viewer's current timezone.
  const { start: periodStart, end: periodEnd } = getCurrentDailyPeriod((habit as any).timezone)

  const findOccurrence = async () => {
    const { data } = await supabase
      .from('habit_occurrences' as any)
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('period_start', periodStart.toISOString())
      .maybeSingle()
    return data as { id: string } | null
  }

  let occurrence = await findOccurrence()

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
    occurrence = (created.data as { id: string } | null) ?? null

    if (!occurrence) {
      // A concurrent request may have created the same occurrence first
      // (unique index on schedule_id + period_start). Re-read before failing.
      occurrence = await findOccurrence()
      if (!occurrence) {
        return { checkin: null, error: created.error?.message || 'Could not start today\'s check-in period' }
      }
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
      // Idempotent: a double-tap or retry must not create a second check-in.
      const { data: existingCheckin } = await supabase
        .from('habit_checkins' as any)
        .select('id, status')
        .eq('occurrence_id', occurrence.id)
        .eq('profile_id', user.id)
        .maybeSingle()

      if (existingCheckin && !isCompletedCheckin(existingCheckin.status)) {
        return { checkin: null, error: `Today is already recorded as ${existingCheckin.status}, so it can't be checked in again.` }
      }
      return { checkin: existingCheckin ? { id: existingCheckin.id } : null, error: null }
    }
    return { checkin: null, error: error.message }
  }

  return { checkin, error: null }
}

export async function deleteHabit(habitId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: habit, error: habitError } = await supabase
    .from('habits' as any)
    .select('created_by')
    .eq('id', habitId)
    .single()

  if (habitError || !habit) {
    return { success: false, error: 'Habit not found' }
  }
  if (habit.created_by !== user.id) {
    return { success: false, error: 'Only the habit creator can delete this habit' }
  }

  const { error } = await supabase
    .from('habits' as any)
    .delete()
    .eq('id', habitId)

  return error
    ? { success: false, error: friendlyDeleteError(error.message, 'habit') }
    : { success: true, error: null }
}
