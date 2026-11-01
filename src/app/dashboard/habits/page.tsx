'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { checkInHabit, createHabit, deleteHabit, getUserHabits } from '@/features/habits/actions'
import { Plus, Target, Loader2, CheckCircle2, Trash2, Users } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { HabitCreationDialog, type CircleOption } from '@/components/habits/habit-creation-dialog'

interface Group {
  id: string
  name: string
}

interface Habit {
  id: string
  name: string
  created_by: string | null
  frequency: string
  target_quantity: number
  checked_in: boolean
  group: { name: string; id?: string }
  schedule: { frequency: string; target_quantity: number }
  creator: { id: string; username: string } | null
  checkins: {
    id: string
    profile_id: string
    quantity: number
    status: string
    profile: { username: string } | null
  }[]
  created_at: string
  occurrences?: {
    id: string
    period_start: string
    period_end: string
    status: string
  }[]
}

function HabitsSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24 sm:h-8 sm:w-32" />
        <Skeleton className="h-9 w-24 sm:h-10 sm:w-28" />
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-3.5 sm:p-4">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-8 w-full mt-4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function HabitsPage() {
  const router = useRouter()
  const [habits, setHabits] = useState<Habit[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all')

  // Create habit modal
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [habitName, setHabitName] = useState('')
  const [habitGroupId, setHabitGroupId] = useState('')
  const [habitFrequency, setHabitFrequency] = useState('daily')
  const [habitTarget, setHabitTarget] = useState('1')

  // Actions state
  const [checkingIn, setCheckingIn] = useState<string | null>(null)
  const [deletingHabit, setDeletingHabit] = useState<string | null>(null)
  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserId(user.id)

      const [groupsResult, habitsResult] = await Promise.all([
        supabase
          .from('group_members' as any)
          .select('groups (id, name)')
          .eq('user_id', user.id)
          .is('left_at', null),
        getUserHabits(),
      ])

      if (groupsResult.data) {
        const userGroups = (groupsResult.data as any[] | null)
          ?.map((membership) => membership.groups)
          .filter(Boolean) || []
        setGroups(userGroups)
        if (userGroups.length > 0 && !habitGroupId) {
          setHabitGroupId(userGroups[0].id)
        }
      }

      if (habitsResult.habits) {
        setHabits(habitsResult.habits as unknown as Habit[])
      }

      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [router, habitGroupId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCheckIn = async (habitId: string) => {
    setCheckingIn(habitId)
    setError(null)

    const result = await checkInHabit(habitId)
    if (result.error) {
      toast({
        title: 'Check-in failed',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      const refreshed = await getUserHabits()
      if (refreshed.habits) {
        setHabits(refreshed.habits as unknown as Habit[])
      }
      toast({
        title: 'Check-in recorded! 🎉',
        description: 'Great job staying consistent today.',
      })
    }
    setCheckingIn(null)
  }

  const handleCreateHabit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const formData = new FormData()
    formData.append('name', habitName.trim())
    formData.append('group_id', habitGroupId)
    formData.append('frequency', habitFrequency)
    formData.append('target_quantity', habitTarget)
    formData.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone)

    const result = await createHabit(formData)
    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }

    const refreshed = await getUserHabits()
    if (refreshed.habits) {
      setHabits(refreshed.habits as unknown as Habit[])
    }

    setDialogOpen(false)
    setHabitName('')
    setHabitTarget('1')
    setHabitFrequency('daily')
    setSaving(false)

    toast({
      title: 'Habit created',
      description: `"${habitName.trim()}" is now being tracked.`,
    })
  }

  const handleDeleteHabit = async () => {
    if (!deleteHabitId) return
    setDeletingHabit(deleteHabitId)
    setError(null)

    const result = await deleteHabit(deleteHabitId)
    if (result.error) {
      toast({
        title: 'Delete failed',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      setHabits(current => current.filter(habit => habit.id !== deleteHabitId))
      setDeleteHabitId(null)
      toast({
        title: 'Habit deleted',
        description: 'Habit has been permanently removed.',
      })
    }
    setDeletingHabit(null)
  }

  if (loading) {
    return <HabitsSkeleton />
  }

  const filteredHabits = selectedGroupId === 'all'
    ? habits
    : habits.filter(h => (h as any).group_id === selectedGroupId)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Habits</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Your committed habits and peer activity across all circles.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {groups.length > 1 && (
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="flex-1 sm:flex-initial h-9 rounded-md border bg-background px-2.5 text-xs"
              aria-label="Filter habits by circle"
            >
              <option value="all">All Circles ({habits.length})</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}

          <Button
            onClick={() => { setError(null); setDialogOpen(true) }}
            disabled={!groups.length}
            size="sm"
            className="h-9 px-3 text-xs sm:text-sm flex-shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            <span>New Habit</span>
          </Button>
        </div>
      </div>

      {error && <p className="text-xs sm:text-sm text-destructive" role="alert">{error}</p>}

      {!habits.length ? (
        <Card className="border-dashed">
          <CardContent className="py-8 sm:py-14 text-center px-4">
            <Target className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-base sm:text-lg font-semibold mb-1.5">No habits yet</h3>
            <p className="text-muted-foreground mb-5 max-w-sm mx-auto text-xs sm:text-sm leading-relaxed">
              Create your first habit to start building consistency with your accountability circle.
            </p>
            {groups.length > 0 ? (
              <Button onClick={() => { setError(null); setDialogOpen(true) }} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-1.5" />
                Commit to a Habit
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  You need to join or create a circle first before committing to habits.
                </p>
                <Button onClick={() => router.push('/dashboard/groups')} className="w-full sm:w-auto">
                  <Users className="h-4 w-4 mr-1.5" />
                  Create First Circle
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredHabits.map((habit) => {
            const isCreator = habit.created_by === currentUserId
            const isCheckedIn = habit.checkins?.some(c => c.profile_id === currentUserId)

            return (
              <Card key={`${habit.id}-${habit.checkins?.length || 0}`} className="flex flex-col justify-between hover:border-primary/40 transition-all">
                <CardContent className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{habit.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          in <span className="font-medium text-foreground">{habit.group?.name}</span>
                        </p>
                      </div>

                      {isCreator && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                          aria-label={`Delete ${habit.name}`}
                          onClick={() => setDeleteHabitId(habit.id)}
                          disabled={deletingHabit === habit.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] sm:text-xs capitalize">
                        {habit.schedule?.frequency || 'daily'}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        Target: {habit.schedule?.target_quantity || 1}x
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto truncate">
                        by {habit.creator?.username || 'Member'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant={isCheckedIn ? 'secondary' : 'default'}
                        onClick={() => handleCheckIn(habit.id)}
                        disabled={!isCreator || checkingIn === habit.id || isCheckedIn}
                        className="text-xs h-9 flex-1 sm:flex-initial"
                      >
                        {checkingIn === habit.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {!isCreator
                          ? 'View only'
                          : isCheckedIn
                            ? 'Checked in'
                            : 'Check in now'}
                      </Button>

                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {habit.checkins?.length || 0} {(habit.checkins?.length || 0) === 1 ? 'check-in' : 'check-ins'}
                      </span>
                    </div>

                    {/* Activity log preview */}
                    {habit.checkins && habit.checkins.length > 0 ? (
                      <div className="space-y-1 bg-muted/40 p-2 rounded-md text-[11px] text-muted-foreground">
                        {habit.checkins.slice(0, 2).map(c => (
                          <div key={c.id} className="flex items-center justify-between gap-1">
                            <span className="font-medium text-foreground truncate max-w-[120px]">
                              {c.profile?.username || 'Member'}
                            </span>
                            <Badge variant="success" className="text-[9px] py-0 px-1.5 flex-shrink-0">
                              {c.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground text-center py-0.5">
                        No check-ins recorded for this period yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Responsive Create Habit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Create Habit</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Commit to a habit and choose which accountability circle it belongs to.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateHabit} className="space-y-3.5 sm:space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="habit-form-name" className="text-xs sm:text-sm">Habit Name *</Label>
              <Input
                id="habit-form-name"
                value={habitName}
                onChange={(e) => setHabitName(e.target.value)}
                placeholder="e.g. Read 20 pages"
                required
                maxLength={100}
                className="h-10 text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="habit-form-group" className="text-xs sm:text-sm">Accountability Circle *</Label>
              <select
                id="habit-form-group"
                value={habitGroupId}
                onChange={(e) => setHabitGroupId(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm"
                required
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="habit-form-frequency" className="text-xs sm:text-sm">Frequency</Label>
                <select
                  id="habit-form-frequency"
                  value={habitFrequency}
                  onChange={(e) => setHabitFrequency(e.target.value)}
                  className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="habit-form-target" className="text-xs sm:text-sm">Target Count</Label>
                <Input
                  id="habit-form-target"
                  type="number"
                  min="1"
                  max="100"
                  value={habitTarget}
                  onChange={(e) => setHabitTarget(e.target.value)}
                  className="h-10 text-sm"
                  required
                />
              </div>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto h-10">
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !habitName.trim()} className="w-full sm:w-auto h-10">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Habit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Habit Confirmation Dialog */}
      <Dialog open={Boolean(deleteHabitId)} onOpenChange={(open) => { if (!open && !deletingHabit) setDeleteHabitId(null) }}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Delete this habit?</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              This permanently removes the habit, its schedule, and recorded check-ins.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteHabitId(null)} disabled={Boolean(deletingHabit)} className="w-full sm:w-auto h-10">
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteHabit} disabled={Boolean(deletingHabit)} className="w-full sm:w-auto h-10">
              {deletingHabit && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
