'use client'

import { Target, Flame, Users, Calendar, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface Habit {
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
  occurrences?: {
    id: string
    period_start: string
    period_end: string
    status: string
  }[]
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string | number
  description: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-xl sm:text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function HabitRow({
  name,
  frequency,
  time,
  status,
}: {
  name: string
  frequency: string
  time: string
  status: 'pending' | 'completed'
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-3 w-3 rounded-full ${
            status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/30'
          }`}
        />
        <div className="min-w-0">
          <p className="font-medium text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px]">{name}</p>
          <p className="text-xs text-muted-foreground">{frequency} • {time}</p>
        </div>
      </div>
      <span
        className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${
          status === 'completed'
            ? 'bg-green-500/10 text-green-500'
            : 'bg-muted-foreground/10 text-muted-foreground'
        }`}
      >
        {status === 'completed' ? 'Done' : 'Pending'}
      </span>
    </div>
  )
}

function formatHabitTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function DashboardPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [habitCount, setHabitCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load user's groups
      const { data: groupData, error: groupError } = await supabase
        .from('group_members' as any)
        .select('groups (id, name)')
        .eq('user_id', user.id)
        .is('left_at', null)

      if (!groupError && groupData) {
        const flat = (groupData as any[]).flatMap((g: any) => g.groups || [])
        const uniqueGroups = Array.from(new Map(flat.map(g => [g.id, g])).values())
        setGroups(uniqueGroups)
      }

      // Build consistent group IDs list from either source
      const groupIds: string[] = groups.length > 0 && groups !== null
        ? groups.map(g => g.id)
        : (groupData as any[] | null)?.flatMap((g: any) => g.groups?.id || []) ?? []

      if (groupIds.length > 0) {
        const { data: habitData, error: habitError } = await supabase
          .from('habits' as any)
          .select(`
            id,
            name,
            timezone,
            created_at,
            group:groups (id, name),
            schedule:habit_schedules (frequency, target_quantity),
            occurrences (status)
          `)
          .in('group_id', groupIds)
          .order('created_at', { ascending: false })

        if (!habitError && habitData) {
          const transformed = (habitData as any[]).map(h => ({
            ...h,
            group: h.groups,
            schedule: h.habit_schedules?.[0]
          }))
          setHabits(transformed)
          setHabitCount(transformed.length)

          const completed = transformed.reduce((acc, h) =>
            acc + (h.occurrences?.filter((o: any) => o.status === 'verified').length || 0), 0)
          setCompletedCount(completed)
        }
      }

      setLoading(false)
    }

    loadData()
  }, [groups])

  if (loading) {
    return (
      <div className="p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const thisWeek = habits.length > 0
    ? `${Math.round((completedCount / Math.max(1, habits.length)) * 100)}%`
    : '0%'

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Header */}
      <div className="px-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome back!</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">Here's your habit overview for today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Habits"
          value={habits.length}
          description="active habits"
          icon={Target}
        />
        <StatCard
          title="Current Streak"
          value="7"
          description="days on fire"
          icon={Flame}
        />
        <StatCard
          title="This Week"
          value={thisWeek}
          description="completion rate"
          icon={Target}
        />
        <StatCard
          title="Active Groups"
          value={groups.length}
          description="groups you're in"
          icon={Users}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm sm:text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3">
          <button
            className="w-full justify-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left flex items-center"
            onClick={() => window.location.href = '/dashboard/groups'}
          >
            <Calendar className="h-5 w-5 text-primary" />
            <span className="font-medium">Check In Now</span>
          </button>
          <button
            className="w-full justify-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left flex items-center"
            onClick={() => window.location.href = '/dashboard/habits'}
          >
            <Target className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">View My Habits</span>
          </button>
          <button
            className="w-full justify-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left flex items-center"
            onClick={() => window.location.href = '/dashboard/groups'}
          >
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Browse Groups</span>
          </button>
        </CardContent>
      </Card>

      {/* Upcoming Habits */}
      {habits.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Upcoming Habits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 sm:space-y-3">
              {habits.slice(0, 5).map(habit => (
                <HabitRow
                  key={habit.id}
                  name={habit.name}
                  frequency={habit.schedule?.frequency || 'daily'}
                  time={formatHabitTime(habit.created_at)}
                  status={habit.occurrences?.some((o: any) => o.status === 'verified') ? 'completed' : 'pending'}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Habits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-6 sm:py-8">
              No habits yet. Create one in your groups!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}