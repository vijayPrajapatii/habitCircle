'use client'

import { Target, Users, Calendar, CheckCircle2, Loader2, ArrowRight, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { APP_NAME } from '@/config/brand'

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
  groupName,
  status,
}: {
  name: string
  frequency: string
  groupName: string
  status: 'pending' | 'completed'
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-3 w-3 rounded-full flex-shrink-0 ${
            status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/30'
          }`}
        />
        <div className="min-w-0">
          <p className="font-medium text-sm sm:text-base truncate max-w-[180px] sm:max-w-[280px]">{name}</p>
          <p className="text-xs text-muted-foreground">{frequency} • {groupName}</p>
        </div>
      </div>
      <Badge variant={status === 'completed' ? 'success' : 'secondary'}>
        {status === 'completed' ? 'Done' : 'Pending'}
      </Badge>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="px-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-5 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-24 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export default function DashboardPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('')

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user display name
      const metadataName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.username
      setUserName(metadataName || user.email?.split('@')[0] || '')

      // Load user's groups
      const { data: groupData, error: groupError } = await supabase
        .from('group_members' as any)
        .select('groups (id, name)')
        .eq('user_id', user.id)
        .is('left_at', null)

      if (groupError) {
        setError(groupError.message)
        setLoading(false)
        return
      }

      const flat = (groupData as any[])?.flatMap((g: any) => g.groups || []) ?? []
      const uniqueGroups = Array.from(new Map(flat.map((g: any) => [g.id, g])).values())
      setGroups(uniqueGroups)

      const groupIds = uniqueGroups.map(g => g.id)

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
            occurrences:habit_occurrences (status)
          `)
          .in('group_id', groupIds)
          .order('created_at', { ascending: false })

        if (!habitError && habitData) {
          const transformed = (habitData as any[]).map(h => ({
            ...h,
            group: h.groups || h.group,
            schedule: h.habit_schedules?.[0] || h.schedule,
          }))
          setHabits(transformed)
        }
      }

      setLoading(false)
    } catch (err) {
      setError('Failed to load dashboard data')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Card className="border-destructive/50">
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => { setError(null); setLoading(true); loadData() }}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const completedCount = habits.reduce(
    (acc, h) => acc + (h.occurrences?.filter(o => o.status === 'verified').length || 0),
    0
  )

  const completionRate = habits.length > 0
    ? `${Math.round((completedCount / Math.max(1, habits.length)) * 100)}%`
    : '—'

  // Determine habit statuses for the "Today" section
  const todayHabits = habits.map(habit => ({
    ...habit,
    isCompleted: habit.occurrences?.some(o => o.status === 'verified') ?? false,
  }))

  const pendingHabits = todayHabits.filter(h => !h.isCompleted)
  const completedHabits = todayHabits.filter(h => h.isCompleted)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Header */}
      <div className="px-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {getGreeting()}{userName ? `, ${userName}` : ''}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">{formatToday()}</p>
      </div>

      {/* Empty State: No Groups */}
      {groups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 sm:py-14 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Welcome to {APP_NAME}!</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start by creating a group with your friends. You'll set habits together and hold each other accountable.
            </p>
            <Button asChild size="lg">
              <Link href="/dashboard/groups">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Group
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : habits.length === 0 ? (
        /* Empty State: Groups but No Habits */
        <Card className="border-dashed">
          <CardContent className="py-10 sm:py-14 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No habits yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              You're in {groups.length} {groups.length === 1 ? 'group' : 'groups'}. Create your first habit to start tracking.
            </p>
            <Button asChild size="lg">
              <Link href="/dashboard/habits">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Habit
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Grid — only real data */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Active Habits"
              value={habits.length}
              description={`across ${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`}
              icon={Target}
            />
            <StatCard
              title="Completion Rate"
              value={completionRate}
              description="this period"
              icon={CheckCircle2}
            />
            <StatCard
              title="Active Groups"
              value={groups.length}
              description={`${habits.length} total habits`}
              icon={Users}
            />
          </div>

          {/* Today's Habits */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Today</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/habits">
                  View all
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Pending first */}
                {pendingHabits.slice(0, 5).map(habit => (
                  <HabitRow
                    key={habit.id}
                    name={habit.name}
                    frequency={habit.schedule?.frequency || 'daily'}
                    groupName={habit.group?.name || 'Unknown group'}
                    status="pending"
                  />
                ))}
                {/* Then completed */}
                {completedHabits.slice(0, 3).map(habit => (
                  <HabitRow
                    key={habit.id}
                    name={habit.name}
                    frequency={habit.schedule?.frequency || 'daily'}
                    groupName={habit.group?.name || 'Unknown group'}
                    status="completed"
                  />
                ))}
                {habits.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{habits.length - 8} more habits
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" className="h-auto p-4 justify-start gap-3" asChild>
              <Link href="/dashboard/habits">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <span className="font-medium block">Check In</span>
                  <span className="text-xs text-muted-foreground">Record today's progress</span>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto p-4 justify-start gap-3" asChild>
              <Link href="/dashboard/groups">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <span className="font-medium block">My Groups</span>
                  <span className="text-xs text-muted-foreground">View & manage groups</span>
                </div>
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
