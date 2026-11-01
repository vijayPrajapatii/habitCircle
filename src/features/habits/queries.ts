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
    .select(`
      id,
      name,
      frequency,
      target_quantity,
      timezone,
      penalty_amount,
      created_at,
      schedules: habit_schedules (
        id,
        frequency,
        target_quantity
      )
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (error) {
    return { habits: [], error: error.message }
  }

  // Get checkins for today
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const { data: checkins } = await supabase
    .from('habit_checkins')
    .select('habit_id, status')
    .in('habit_id', habits?.map(h => h.id) || [])
    .eq('profile_id', user.id)

  // Mark which habits have been checked in
  const checkedInIds = checkins?.map(c => c.habit_id) || []

  const result = habits?.map(h => ({
    ...h,
    checked_in: checkedInIds.includes(h.id),
    penalty_amount: h.schedules?.[0]?.target_quantity || 1000,
  })) || []

  return { habits: result, error: null }
}

export async function getGroupHabitCheckins(groupId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { checkins: [], error: 'Not authenticated' }
  }

  // Get all habits in group
  const { data: habits } = await supabase
    .from('habits')
    .select('id, name')
    .eq('group_id', groupId)

  // Get all checkins for this group
  const { data: checkins, error } = await supabase
    .from('habit_checkins')
    .select(`
      id,
      profile_id,
      quantity,
      status,
      created_at,
      profiles(username)
    `)
    .in('habit_id', habits?.map(h => h.id) || [])
    .eq('status', 'submitted')
    .order('created_at', { ascending: false })

  if (error) {
    return { checkins: [], error: error.message }
  }

  return { checkins: checkins || [], error: null }
}