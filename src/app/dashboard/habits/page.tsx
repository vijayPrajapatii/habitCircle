'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { checkInHabit, createHabit, deleteHabit, getUserHabits } from '@/features/habits/actions'
import { Plus, Target, Loader2, CheckCircle2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

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
  group: { name: string }
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
}

export default function HabitsPage() {
  const router = useRouter()
  const [habits, setHabits] = useState<Habit[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkingIn, setCheckingIn] = useState<string | null>(null)
  const [deletingHabit, setDeletingHabit] = useState<string | null>(null)
  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserId(user.id)

      Promise.all([
        supabase
          .from('group_members' as any)
          .select('groups (id, name)')
          .eq('user_id', user.id)
          .is('left_at', null),
        getUserHabits(),
      ]).then(([groupsResult, habitsResult]) => {
        if (groupsResult.error) {
          setError(groupsResult.error.message)
        } else {
          const userGroups = (groupsResult.data as any[] | null)
            ?.map((membership) => membership.groups)
            .filter(Boolean) || []
          setGroups(userGroups)
        }

        if (habitsResult.error) {
          setError(habitsResult.error)
        } else {
          setHabits((habitsResult.habits || []) as unknown as Habit[])
        }
        setLoading(false)
      })
    })
  }, [router])

  const handleCheckIn = async (habitId: string) => {
    setCheckingIn(habitId)
    setError(null)
    const result = await checkInHabit(habitId)
    if (result.error) {
      setError(result.error)
    } else {
      const refreshed = await getUserHabits()
      if (refreshed.error) {
        setError(refreshed.error)
      } else {
        setHabits((refreshed.habits || []) as unknown as Habit[])
      }
    }
    setCheckingIn(null)
  }

  const handleCreateHabit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const result = await createHabit(new FormData(event.currentTarget))
    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }

    const refreshed = await getUserHabits()
    if (refreshed.error) {
      setError(refreshed.error)
    } else {
      setHabits((refreshed.habits || []) as unknown as Habit[])
      setDialogOpen(false)
    }
    setSaving(false)
  }

  const handleDeleteHabit = async () => {
    if (!deleteHabitId) return
    setDeletingHabit(deleteHabitId)
    setError(null)
    const result = await deleteHabit(deleteHabitId)
    if (result.error) {
      setError(result.error)
    } else {
      setHabits(current => current.filter(habit => habit.id !== deleteHabitId))
      setDeleteHabitId(null)
    }
    setDeletingHabit(null)
  }

  if (loading) {
    return <div className="p-4 sm:p-6"><Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold truncate">My Habits</h1>
        <Button onClick={() => { setError(null); setDialogOpen(true) }} disabled={!groups.length} className="flex-shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">New Habit</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {!habits.length ? (
        <Card className="border-dashed">
          <CardContent className="py-8 sm:py-12 text-center">
            <Target className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-lg font-semibold mb-2">No habits yet</h3>
            <p className="text-muted-foreground mb-4 px-4 max-w-md mx-auto text-sm">
              Create your first habit to start building consistency.
            </p>
            <Button onClick={() => { setError(null); setDialogOpen(true) }} disabled={!groups.length} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create Habit
            </Button>
            {!groups.length && (
              <p className="mt-3 text-sm text-muted-foreground px-4">
                Create or join a group first.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-4 xs:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {habits.map((habit) => (
            <Card key={habit.id}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm sm:text-base truncate">{habit.name}</h3>
                  {habit.created_by === currentUserId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${habit.name}`}
                      onClick={() => setDeleteHabitId(habit.id)}
                      disabled={deletingHabit === habit.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{habit.group?.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  by {habit.creator?.username || 'Unknown'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {habit.schedule?.frequency} • x{habit.schedule?.target_quantity}
                </p>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <Button
                    size="sm"
                    variant={habit.checkins.some(checkin => checkin.profile_id === currentUserId) ? 'secondary' : 'default'}
                    onClick={() => handleCheckIn(habit.id)}
                    disabled={habit.created_by !== currentUserId || checkingIn === habit.id || habit.checkins.some(checkin => checkin.profile_id === currentUserId)}
                    className="w-full sm:w-auto justify-start"
                  >
                    {checkingIn === habit.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {habit.created_by !== currentUserId
                      ? 'View only'
                      : habit.checkins.some((checkin) => checkin.profile_id === currentUserId)
                        ? 'Checked in'
                        : 'Check in'}
                  </Button>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    Check-ins today: {habit.checkins.length}
                  </span>
                </div>
                {habit.checkins.length > 0 && (
                  <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                    {habit.checkins.slice(0, 3).map(checkin => (
                      <p key={checkin.id} className="truncate">
                        {checkin.profile?.username || 'Member'} • {checkin.status}
                      </p>
                    ))}
                    {habit.checkins.length > 3 && (
                      <p className="text-xs text-muted-foreground/70">
                        +{habit.checkins.length - 3} more
                      </p>
                    )}
                  </div>
                )}
                {habit.checkins.length === 0 && (
                  <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                    No check-ins yet today.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md mx-2">
          <DialogHeader>
            <DialogTitle>Create habit</DialogTitle>
            <DialogDescription>Choose the group and the schedule for this habit.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateHabit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="habit-name">Name</Label>
              <Input id="habit-name" name="name" placeholder="Morning walk" required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="habit-group">Group</Label>
              <select id="habit-group" name="group_id" className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm" required>
                <option value="">Select a group</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="habit-frequency">Frequency</Label>
                <select id="habit-frequency" name="frequency" defaultValue="daily" className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quantity">Quantity</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="habit-target">Target</Label>
                <Input id="habit-target" name="target_quantity" type="number" min="1" defaultValue="1" required />
              </div>
            </div>
            <input type="hidden" name="timezone" value="UTC" />
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create habit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteHabitId)} onOpenChange={(open) => { if (!open && !deletingHabit) setDeleteHabitId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this habit?</DialogTitle>
            <DialogDescription>
              This permanently removes the habit, its schedule, occurrences, and check-ins.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteHabitId(null)} disabled={Boolean(deletingHabit)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleDeleteHabit} disabled={Boolean(deletingHabit)}>
              {deletingHabit && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}