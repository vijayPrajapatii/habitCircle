'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, CheckCircle, Calendar, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Group {
  id: string
  name: string
  description: string
  penalty_amount: number
  currency: string
  max_members: number
  timezone: string
  created_at: string
}

interface Member {
  id: string
  user_id: string
  role: string
  joined_at: string
  profile: { username: string }
}

interface Habit {
  id: string
  name: string
  frequency: string
  target_quantity: number
  penalty_amount: number
  checked_in: boolean
}

export default function GroupPage() {
  const params = useParams<{ groupId: string }>()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params?.groupId) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const fetchData = async () => {
      // Get group details
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select(`
          *,
          members: group_members (
            id,
            user_id,
            role,
            joined_at,
            left_at,
            profiles (username)
          )
        `)
        .eq('id', params.groupId)
        .single()

      if (groupError) {
        console.error('Error fetching group:', groupError)
        setLoading(false)
        return
      }

      // Map group data
      setGroup({
        id: groupData.id,
        name: groupData.name,
        description: groupData.description,
        penalty_amount: groupData.penalty_amount,
        currency: groupData.currency,
        max_members: groupData.max_members,
        timezone: groupData.timezone,
        created_at: groupData.created_at,
      })

      // Active members only
      const activeMembers = groupData.members
        .filter(m => !m.left_at)
        .map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          profile: m.profiles,
        }))
      setMembers(activeMembers)

      // Get habits
      const { data: habitData } = await supabase
        .from('habits')
        .select('id, name, timezone, created_at')
        .eq('group_id', params.groupId)

      setHabits(habitData?.map(h => ({
        ...h,
        frequency: 'daily',
        target_quantity: 1,
        penalty_amount: 1000,
        checked_in: false,
      })) || [])

      setLoading(false)
    }

    fetchData()
  }, [params?.groupId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!group) {
    return <div>Group not found</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="text-muted-foreground">{group.description}</p>
      </div>

      {/* Members List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Members ({members.length})</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Card key={member.user_id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {(member.profile?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{member.profile?.username || 'Unknown'}</p>
                    <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Habits */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Today&apos;s Habits</h2>
          <Link href={`/dashboard/groups/${group.id}/habits/new`}>
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Habit
            </Button>
          </Link>
        </div>

        {habits.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              {habits.map((habit) => (
                <div key={habit.id} className="flex items-center justify-between p-4 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{habit.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {habit.frequency} • Penalty: ₹{habit.penalty_amount}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No habits created yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}