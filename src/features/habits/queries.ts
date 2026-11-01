import { createClient } from '@/lib/supabase/server'

export async function getUserHabits(groupId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { habits: [], error: 'Not authenticated' }
  }

  // Get habits in the group
  const { data: habits, error } = await supabase
    .from('habits')
    .select('id, name, timezone, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (error) {
    return { habits: [], error: error.message }
  }

  // Get schedule info
  const { data: schedules } = await supabase
    .from('habit_schedules')
    .select('habit_id, frequency, target_quantity')
    .in('habit_id', habits?.map(h => h.id) || [])

  // Add schedule info to habits
  const scheduleByHabit = Object.fromEntries(
    (schedules || []).map(s => [s.habit_id, s])
  )

  const result = habits?.map(h => ({
    ...h,
    frequency: scheduleByHabit[h.id]?.frequency || 'daily',
    target_quantity: scheduleByHabit[h.id]?.target_quantity || 1,
    penalty_amount: 1000,
    checked_in: false,
  })) || []

  return { habits: result, error: null }
}