'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Bell, CheckCircle2, UserPlus, Flame, Target, Calendar } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface ActivityEvent {
  id: string
  type: 'checkin' | 'join'
  title: string
  subtitle: string
  timestamp: string
  badgeText: string
  badgeVariant: 'success' | 'default' | 'secondary'
}

export default function ActivityPage() {
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<ActivityEvent[]>([])

  const loadActivity = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      // Find user's groups
      const { data: userGroups } = await supabase
        .from('group_members' as any)
        .select('group_id')
        .eq('user_id', user.id)
        .is('left_at', null)

      const groupIds = (userGroups as any[] | null)?.map(g => g.group_id) || []

      if (!groupIds.length) {
        setLoading(false)
        return
      }

      // Fetch habits and their recent check-ins across these groups
      const { data: habitsData } = await supabase
        .from('habits' as any)
        .select(`
          id,
          name,
          group:groups (name),
          schedule:habit_schedules (id)
        `)
        .in('group_id', groupIds)

      const scheduleIds = (habitsData as any[] | null)?.map(h => h.schedule?.[0]?.id).filter(Boolean) || []

      let checkinsList: any[] = []
      if (scheduleIds.length > 0) {
        const { data: occurrences } = await supabase
          .from('habit_occurrences' as any)
          .select('id, schedule_id')
          .in('schedule_id', scheduleIds)

        const occIds = (occurrences as any[] | null)?.map(o => o.id) || []

        if (occIds.length > 0) {
          const { data: checkins } = await supabase
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

          if (checkins) {
            checkinsList = checkins
          }
        }
      }

      // Map to activity events
      const events: ActivityEvent[] = checkinsList.map(c => ({
        id: c.id,
        type: 'checkin',
        title: `${c.profile?.username || 'Group member'} completed a check-in`,
        subtitle: `Status: ${c.status}`,
        timestamp: new Date(c.created_at).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        badgeText: 'Check-in',
        badgeVariant: 'success',
      }))

      setActivities(events)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadActivity()
  }, [loadActivity])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Activity Feed</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Live stream of accountability check-ins, commitments, and peer updates across your groups.
        </p>
      </div>

      {!activities.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No recent activity</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
              When members in your accountability circles check in or achieve streaks, their milestones will appear here in real time.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/dashboard/habits"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                Submit a Check-in
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Feed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activities.map(event => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {event.timestamp} • {event.subtitle}
                    </p>
                  </div>
                </div>

                <Badge variant={event.badgeVariant} className="flex-shrink-0 text-xs">
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
