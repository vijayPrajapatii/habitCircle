import { createClient } from '@/lib/supabase/server'

export async function getUserGroups() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { groups: [], error: 'Not authenticated' }
  }

  const { data: groups, error } = await supabase
    .from('group_members')
    .select(`
      group_id,
      role,
      joined_at,
      groups:groups (
        id,
        name,
        description,
        penalty_amount,
        currency,
        max_members,
        timezone,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', user.id)
    .is('left_at', null)
    .order('joined_at', { ascending: false })

  if (error) {
    return { groups: [], error: error.message }
  }

  // Flatten the data
  const result = groups?.map(g => ({
    id: g.groups.id,
    name: g.groups.name,
    description: g.groups.description,
    penalty_amount: g.groups.penalty_amount,
    currency: g.groups.currency,
    max_members: g.groups.max_members,
    timezone: g.groups.timezone,
    created_at: g.groups.created_at,
    updated_at: g.groups.updated_at,
  })) || []

  return { groups: result, error: null }
}

export async function getGroupDetail(groupId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { group: null, members: [], error: 'Not authenticated' }
  }

  // Get group details
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select(`
      *,
      members: group_members (
        id,
        user_id,
        role,
        joined_at,
        left_at,
        profiles (id, username, email)
      )
    `)
    .eq('id', groupId)
    .single()

  if (groupError) {
    return { group: null, members: [], error: groupError.message }
  }

  // Filter active members and map profiles
  const activeMembers = group.members
    .filter(m => !m.left_at)
    .map(m => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      profile: m.profiles,
    }))

  return { group, members: activeMembers, error: null }
}