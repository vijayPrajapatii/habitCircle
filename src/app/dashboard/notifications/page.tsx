'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Bell, CheckCheck, AlertCircle, Info, Calendar } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'

interface NotificationItem {
  id: string
  created_at: string
  title: string
  message: string
  type: 'reminder' | 'penalty' | 'invite' | 'system'
  read: boolean
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  const loadNotifications = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      // Check if notifications table exists and has rows
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) {
        const mapped: NotificationItem[] = data.map((n: any) => ({
          id: n.id,
          created_at: n.created_at,
          title: n.payload?.title || 'Notification',
          message: n.payload?.message || '',
          type: n.channel || 'system',
          read: Boolean(n.read_at),
        }))
        setNotifications(mapped)
      } else {
        // Provide contextual notifications if table has no entries yet
        setNotifications([
          {
            id: 'welcome-notif',
            created_at: new Date().toISOString(),
            title: 'Welcome to HabitCircle!',
            message: 'Create or join a circle to start tracking your daily habits with friends.',
            type: 'system',
            read: false,
          },
          {
            id: 'reminder-tip',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            title: 'Daily Check-in Reminder',
            message: 'Don\'t forget to submit your check-in before the grace period ends to avoid penalties.',
            type: 'reminder',
            read: false,
          },
        ])
      }

      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const markAllAsRead = () => {
    setNotifications(current => current.map(n => ({ ...n, read: true })))
    toast({
      title: 'All marked as read',
      description: 'Your notifications inbox has been cleared.',
    })
  }

  const markAsRead = (id: string) => {
    setNotifications(current => current.map(n => n.id === id ? { ...n, read: true } : n))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-44" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Check-in reminders, group invites, and habit milestones.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-1.5" />
            Mark all read
          </Button>
        )}
      </div>

      {!notifications.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Inbox is clear</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
              You are completely caught up! We will alert you when group activity requires your attention.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Inbox</span>
              {unreadCount > 0 && (
                <Badge variant="default" className="text-xs">
                  {unreadCount} unread
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {notifications.map(item => (
              <div
                key={item.id}
                onClick={() => markAsRead(item.id)}
                className={`flex items-start justify-between p-3.5 rounded-lg border transition-colors cursor-pointer ${
                  !item.read ? 'bg-primary/5 border-primary/30' : 'bg-card hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    item.type === 'reminder'
                      ? 'bg-amber-500/10 text-amber-500'
                      : item.type === 'penalty'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-primary/10 text-primary'
                  }`}>
                    {item.type === 'reminder' ? (
                      <Calendar className="h-4 w-4" />
                    ) : item.type === 'penalty' ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Info className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm leading-none">{item.title}</p>
                      {!item.read && (
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {item.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {new Date(item.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
