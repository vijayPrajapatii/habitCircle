'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Bell, CheckCheck, AlertCircle, Info, Calendar } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'

type NotificationKind = 'reminder' | 'penalty' | 'invite' | 'system'

interface NotificationItem {
  id: string
  created_at: string
  title: string
  message: string
  type: NotificationKind
  read: boolean
}

/** Maps the stored notification_type (payload.type) to the icon/colour family. */
function kindFromPayloadType(type: unknown): NotificationKind {
  switch (type) {
    case 'daily_reminder':
    case 'upcoming_deadline':
    case 'weekly_report':
      return 'reminder'
    case 'missed_commitment':
    case 'new_penalty':
    case 'payment_request':
    case 'payment_confirmation':
      return 'penalty'
    case 'invitation':
    case 'new_member':
      return 'invite'
    default:
      return 'system'
  }
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  const loadNotifications = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return
      }

      const { data, error } = await supabase
        .from('notifications' as any)
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        setLoadError(error.message)
        return
      }

      // Only real notifications are shown. An empty inbox renders the empty state.
      setNotifications(
        ((data as any[] | null) ?? []).map((n: any) => ({
          id: n.id,
          created_at: n.created_at,
          title: n.payload?.title || 'Notification',
          message: n.payload?.message || '',
          type: kindFromPayloadType(n.payload?.type),
          read: Boolean(n.read_at),
        })),
      )
      setLoadError(null)
    } catch {
      setLoadError('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const markAllAsRead = async () => {
    const previous = notifications
    setNotifications(current => current.map(n => ({ ...n, read: true })))

    const supabase = createClient()
    const { error } = await supabase
      .from('notifications' as any)
      .update({ read_at: new Date().toISOString() })
      .in('id', previous.filter(n => !n.read).map(n => n.id))

    if (error) {
      // Persisting failed: roll back so the UI never claims more than the server knows.
      setNotifications(previous)
      toast({ title: 'Could not mark as read', description: error.message, variant: 'destructive' })
      return
    }

    toast({
      title: 'All marked as read',
      description: 'Your notifications inbox has been cleared.',
    })
  }

  const markAsRead = async (id: string) => {
    const target = notifications.find(n => n.id === id)
    if (!target || target.read) return

    setNotifications(current => current.map(n => n.id === id ? { ...n, read: true } : n))

    const supabase = createClient()
    const { error } = await supabase
      .from('notifications' as any)
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      setNotifications(current => current.map(n => n.id === id ? { ...n, read: false } : n))
      toast({ title: 'Could not mark as read', description: error.message, variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Skeleton className="h-7 w-44 sm:h-8" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Notifications</h1>
        <Card className="border-destructive/50">
          <CardContent className="py-6 sm:py-8 text-center px-4">
            <p className="text-destructive mb-4 text-sm" role="alert">{loadError}</p>
            <Button size="sm" onClick={() => { setLoadError(null); setLoading(true); loadNotifications() }}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Check-in reminders, group invites, and habit milestones.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="h-10 sm:h-9">
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
          <CardContent>
            <ul className="space-y-2.5">
              {notifications.map(item => (
                <li key={item.id}>
                  {/* A real button: keyboard-focusable and announced as one. */}
                  <button
                    type="button"
                    onClick={() => markAsRead(item.id)}
                    aria-label={`${item.read ? '' : 'Unread: '}${item.title}${item.read ? '' : '. Activate to mark as read'}`}
                    className={`flex w-full items-start gap-3 p-3.5 rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      !item.read ? 'bg-primary/5 border-primary/30' : 'bg-card hover:bg-muted/40 cursor-default'
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      item.type === 'reminder'
                        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400'
                        : item.type === 'penalty'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-primary/10 text-primary'
                    }`}>
                      {item.type === 'reminder' ? (
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                      ) : item.type === 'penalty' ? (
                        <AlertCircle className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Info className="h-4 w-4" aria-hidden="true" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm leading-tight break-words">{item.title}</p>
                        {!item.read && (
                          <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" aria-hidden="true" />
                        )}
                      </div>
                      {item.message && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed break-words">
                          {item.message}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {new Date(item.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
