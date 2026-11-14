'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Bell, CheckCircle2, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { isCompletedCheckin } from '@/domain/checkin-state'

interface ActivityEvent {
  id: string
  type: 'checkin' | 'join'
  title: string
  subtitle: string
  timestamp: string
  badgeText: string
  badgeVariant: 'success' | 'default' | 'secondary' | 'destructive' | 'warning'
}

/** Words for each check-in status, so a miss never reads as "checked in". */
function describeCheckin(status: string): { verb: string; badge: string; variant: ActivityEvent['badgeVariant'] } {
  if (status === 'verified') return { verb: 'had a check-in verified', badge: 'Verified', variant: 'success' }
  if (isCompletedCheckin(status)) return { verb: 'checked in', badge: 'Check-in', variant: 'success' }
  if (status === 'missed') return { verb: 'missed a check-in', badge: 'Missed', variant: 'destructive' }
  if (status === 'disputed') return { verb: 'has a disputed check-in', badge: 'Disputed', variant: 'warning' }
  if (status === 'excused') return { verb: 'was excused', badge: 'Excused', variant: 'secondary' }
  return { verb: 'has a pending check-in', badge: 'Pending', variant: 'secondary' }
}

export default function ActivityPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityEvent[]>([])

  const loadActivity = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return
      }

      const { data: userGroups, error: groupsError } = await supabase
        .from('group_members' as any)
        .select('group_id')
        .eq('user_id', user.id)
        .is('left_at', null)

      if (groupsError) {
        setLoadError(groupsError.message)
        return
      }

      const groupIds = (userGroups as any[] | null)?.map(g => g.group_id) || []

      if (!groupIds.length) {
        setActivities([])
        return
      }

      const { data: habitsData, error: habitsError } = await supabase
        .from('habits' as any)
        .select(`
          id,
          name,
          group:groups (name),
          schedule:habit_schedules (id)
        `)
        .in('group_id', groupIds)

      if (habitsError) {
        setLoadError(habitsError.message)
        return
      }

      // schedule id -> habit name, so each event can say WHICH habit it is about.
      const habitNameByScheduleId = new Map<string, string>()
      for (const habit of (habitsData as any[] | null) ?? []) {
        // To-many embeds arrive as arrays, but tolerate a single object too.
        const schedules = Array.isArray(habit.schedule) ? habit.schedule : habit.schedule ? [habit.schedule] : []
        for (const schedule of schedules) {
          habitNameByScheduleId.set(schedule.id, habit.name)
        }
      }
      const scheduleIds = Array.from(habitNameByScheduleId.keys())

      let checkinsList: any[] = []
      const habitNameByOccurrenceId = new Map<string, string>()
      if (scheduleIds.length > 0) {
        const { data: occurrences, error: occurrencesError } = await supabase
          .from('habit_occurrences' as any)
          .select('id, schedule_id')
          .in('schedule_id', scheduleIds)

        if (occurrencesError) {
          setLoadError(occurrencesError.message)
          return
        }

        for (const occ of (occurrences as any[] | null) ?? []) {
          const name = habitNameByScheduleId.get(occ.schedule_id)
          if (name) habitNameByOccurrenceId.set(occ.id, name)
        }
        const occIds = Array.from(habitNameByOccurrenceId.keys())

        if (occIds.length > 0) {
          const { data: checkins, error: checkinsError } = await supabase
            .from('habit_checkins' as any)
            .select(`
              id,
              created_at,
              status,
              profile:profiles (username),
              occurrence_id
            `)
            .in('occurrence_id', occIds)
            .order('created_at', { ascending: false })
            .limit(20)

          if (checkinsError) {
            setLoadError(checkinsError.message)
            return
          }

          checkinsList = checkins ?? []
        }
      }

      const events: ActivityEvent[] = checkinsList.map(c => {
        const description = describeCheckin(c.status)
        const habitName = habitNameByOccurrenceId.get(c.occurrence_id)
        return {
          id: c.id,
          type: 'checkin',
          title: `${c.profile?.username || 'Member'} ${description.verb}`,
          subtitle: habitName ? `"${habitName}"` : `Status: ${c.status}`,
          timestamp: new Date(c.created_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          badgeText: description.badge,
          badgeVariant: description.variant,
        }
      })

      setActivities(events)
      setLoadError(null)
    } catch {
      setLoadError('Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadActivity()
  }, [loadActivity])

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <Skeleton className="h-7 w-36 sm:h-8 sm:w-44" />
          <Skeleton className="h-4 w-48 sm:w-64 mt-1" />
        </div>
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-14 sm:h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Activity Feed</h1>
        <Card className="border-destructive/50">
          <CardContent className="py-6 sm:py-8 text-center px-4">
            <p className="text-destructive mb-4 text-sm" role="alert">{loadError}</p>
            <Button size="sm" onClick={() => { setLoadError(null); setLoading(true); loadActivity() }}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Activity Feed</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Live stream of check-ins and peer accountability updates across your circles.
        </p>
      </div>

      {!activities.length ? (
        <Card className="border-dashed">
          <CardContent className="py-10 sm:py-12 text-center px-4">
            <Bell className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-base sm:text-lg font-semibold mb-1.5">No recent activity</h3>
            <p className="text-muted-foreground mb-5 max-w-sm mx-auto text-xs sm:text-sm leading-relaxed">
              When members in your accountability circles check in or achieve streaks, their milestones will appear here in real time.
            </p>
            <div className="flex justify-center">
              <Link
                href="/dashboard/habits"
                className="inline-flex min-h-[44px] items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Submit a Check-in
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Recent Feed</CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-4 pt-0 space-y-2">
            {activities.map(event => (
              <div
                key={event.id}
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs sm:text-sm truncate">{event.title}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span>{event.timestamp} • {event.subtitle}</span>
                    </p>
                  </div>
                </div>

                <Badge variant={event.badgeVariant} className="flex-shrink-0 text-[10px] sm:text-xs py-0.5 px-1.5">
                  {event.badgeText}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
