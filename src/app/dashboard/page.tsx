'use client'

import { Target, Users, CheckCircle2, ArrowRight, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { APP_NAME } from '@/config/brand'
import { getUserHabits, type Habit } from '@/features/habits/actions'
import { isCompletedCheckin } from '@/domain/checkin-state'

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  className = '',
}: {
  title: string
  value: string | number
  description: string
  icon: React.ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <Card className={`w-full overflow-hidden ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground truncate">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="text-lg sm:text-2xl font-bold tracking-tight truncate">{value}</div>
        <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5">{description}</p>
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
    <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border transition-colors hover:bg-muted/50 gap-2">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <div
          aria-hidden="true"
          className={`h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full flex-shrink-0 ${
            status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/30'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-xs sm:text-sm truncate">{name}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground truncate capitalize">{frequency} • {groupName}</p>
        </div>
      </div>
      <Badge variant={status === 'completed' ? 'success' : 'secondary'} className="text-[10px] sm:text-xs py-0.5 flex-shrink-0">
        {status === 'completed' ? 'Done' : 'Pending'}
      </Badge>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="px-1">
        <Skeleton className="h-7 w-40 sm:h-8 sm:w-48" />
        <Skeleton className="h-4 w-48 sm:w-64 mt-1 sm:mt-2" />
      </div>
      <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className={i === 3 ? 'col-span-2 sm:col-span-1' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-20 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="p-4 pb-2"><Skeleton className="h-5 w-28" /></CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [habits, setHabits] = useState<Habit[]>([])
  const [groupCount, setGroupCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('')

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)
      const metadataName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.username
      setUserName(metadataName || user.email?.split('@')[0] || '')

      // Habits (with the CURRENT period's check-ins) come from the same server
      // action the Habits page uses, so both screens always agree.
      const [membershipsResult, habitsResult] = await Promise.all([
        supabase
          .from('group_members' as any)
          .select('group_id')
          .eq('user_id', user.id)
          .is('left_at', null),
        getUserHabits(),
      ])

      if (membershipsResult.error) {
        setError(membershipsResult.error.message)
        return
      }
      if (habitsResult.error) {
        setError(habitsResult.error)
        return
      }

      const uniqueGroupIds = new Set((membershipsResult.data as any[] | null)?.map(m => m.group_id) ?? [])
      setGroupCount(uniqueGroupIds.size)
      setHabits(habitsResult.habits ?? [])
      setError(null)
    } catch {
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
        <Card className="border-destructive/50">
          <CardContent className="py-6 sm:py-8 text-center px-4">
            <p className="text-destructive mb-4 text-sm" role="alert">{error}</p>
            <Button size="sm" onClick={() => { setError(null); setLoading(true); loadData() }}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // "Today's Focus" is the member's own commitments. Other members' habits are
  // visible on the Habits page but are not this member's to check in.
  const myHabits = habits.filter(habit => habit.created_by === userId)
  const myCircleCount = new Set(myHabits.map(habit => habit.group_id)).size

  const withState = myHabits.map(habit => ({
    habit,
    isCompleted: habit.checkins?.some(
      checkin => checkin.profile_id === userId && isCompletedCheckin(checkin.status),
    ) ?? false,
  }))
  const pendingHabits = withState.filter(item => !item.isCompleted)
  const completedHabits = withState.filter(item => item.isCompleted)

  const completionRate = myHabits.length > 0
    ? `${Math.round((completedHabits.length / myHabits.length) * 100)}%`
    : '—'

  const shownCount = Math.min(pendingHabits.length, 5) + Math.min(completedHabits.length, 3)
  const hiddenCount = myHabits.length - shownCount

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Header */}
      <div className="px-0.5">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight truncate">
          {getGreeting()}{userName ? `, ${userName}` : ''}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{formatToday()}</p>
      </div>

      {/* Empty State: No Groups */}
      {groupCount === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 sm:py-14 text-center px-4">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-base sm:text-lg font-semibold mb-1.5">Welcome to {APP_NAME}!</h2>
            <p className="text-muted-foreground mb-5 max-w-sm mx-auto text-xs sm:text-sm leading-relaxed">
              Start by creating an accountability circle with your friends. Commit to habits and hold each other to them.
            </p>
            <Button asChild size="default" className="w-full sm:w-auto">
              <Link href="/dashboard/groups">
                <Plus className="h-4 w-4 mr-2" />
                Create First Group
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : myHabits.length === 0 ? (
        /* Empty State: In circles but no habit of your own yet */
        <Card className="border-dashed">
          <CardContent className="py-8 sm:py-14 text-center px-4">
            <Target className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-base sm:text-lg font-semibold mb-1.5">No habits yet</h2>
            <p className="text-muted-foreground mb-5 max-w-sm mx-auto text-xs sm:text-sm leading-relaxed">
              You are in {groupCount} {groupCount === 1 ? 'circle' : 'circles'}. Add your first habit commitment to begin tracking.
            </p>
            <Button asChild size="default" className="w-full sm:w-auto">
              <Link href="/dashboard/habits">
                <Plus className="h-4 w-4 mr-2" />
                Commit to a Habit
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Responsive Stats Grid */}
          <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3">
            <StatCard
              title="Active Habits"
              value={myHabits.length}
              description={`across ${myCircleCount} ${myCircleCount === 1 ? 'circle' : 'circles'}`}
              icon={Target}
            />
            <StatCard
              title="Completion Rate"
              value={completionRate}
              description="this period"
              icon={CheckCircle2}
            />
            <StatCard
              title="Active Circles"
              value={groupCount}
              description={`${habits.length} ${habits.length === 1 ? 'habit' : 'habits'} total`}
              icon={Users}
              className="col-span-2 sm:col-span-1"
            />
          </div>

          {/* Today's Habits Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 sm:p-4 pb-2">
              <CardTitle className="text-sm sm:text-base font-semibold">Today&apos;s Focus</CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-9 px-2 text-xs">
                <Link href="/dashboard/habits">
                  View all
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-4 pt-0">
              <div className="space-y-2">
                {/* Pending first */}
                {pendingHabits.slice(0, 5).map(({ habit }) => (
                  <HabitRow
                    key={habit.id}
                    name={habit.name}
                    frequency={habit.schedule?.frequency || 'daily'}
                    groupName={habit.group?.name || 'Group'}
                    status="pending"
                  />
                ))}
                {/* Then completed */}
                {completedHabits.slice(0, 3).map(({ habit }) => (
                  <HabitRow
                    key={habit.id}
                    name={habit.name}
                    frequency={habit.schedule?.frequency || 'daily'}
                    groupName={habit.group?.name || 'Group'}
                    status="completed"
                  />
                ))}
                {hiddenCount > 0 && (
                  <p className="text-[11px] text-muted-foreground text-center pt-2">
                    +{hiddenCount} more {hiddenCount === 1 ? 'habit' : 'habits'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Action Navigation on Mobile */}
          <div className="grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-2">
            <Button variant="outline" className="h-auto p-3 sm:p-4 justify-start gap-3 w-full" asChild>
              <Link href="/dashboard/habits">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left min-w-0">
                  <span className="font-semibold text-xs sm:text-sm block truncate">Check In Now</span>
                  <span className="text-[11px] text-muted-foreground block truncate">Record progress for today</span>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto p-3 sm:p-4 justify-start gap-3 w-full" asChild>
              <Link href="/dashboard/groups">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left min-w-0">
                  <span className="font-semibold text-xs sm:text-sm block truncate">My Circles</span>
                  <span className="text-[11px] text-muted-foreground block truncate">Manage partners &amp; stakes</span>
                </div>
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
