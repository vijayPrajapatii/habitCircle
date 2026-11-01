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
import { checkInHabit, createHabit, getUserHabits } from '@/features/habits/actions'
import { Plus, Target, Loader2, CheckCircle2 } from 'lucide-react'
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

  if (loading) {
    return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Habits</h1>
        <Button onClick={() => { setError(null); setDialogOpen(true) }} disabled={!groups.length}>
          <Plus className="h-4 w-4 mr-2" />
          New Habit
        </Button>
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {!habits.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No habits yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first habit to start building consistency.
            </p>
            <Button onClick={() => { setError(null); setDialogOpen(true) }} disabled={!groups.length}>
              <Plus className="h-4 w-4 mr-2" />
              Create Habit
            </Button>
            {!groups.length && <p className="mt-3 text-sm text-muted-foreground">Create or join a group first.</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {habits.map((habit) => (
            <Card key={habit.id}>
              <CardContent className="p-4">
                <h3 className="font-semibold">{habit.name}</h3>
                <p className="text-sm text-muted-foreground">{habit.group?.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Created by {habit.creator?.username || 'Unknown member'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {habit.schedule?.frequency} · target {habit.schedule?.target_quantity}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Button
                    size="sm"
                    variant={habit.checkins.some(checkin => checkin.profile_id === currentUserId) ? 'secondary' : 'default'}
                    onClick={() => handleCheckIn(habit.id)}
                    disabled={checkingIn === habit.id || habit.checkins.some(checkin => checkin.profile_id === currentUserId)}
                  >
                    {checkingIn === habit.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {habit.checkins.some(checkin => checkin.profile_id === currentUserId) ? 'Checked in' : 'Check in'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {habit.checkins.length} checked in
                  </span>
                </div>
                {habit.checkins.length > 0 && (
                  <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
                    {habit.checkins.map(checkin => (
                      <p key={checkin.id}>
                        {checkin.profile?.username || 'Member'} checked in ({checkin.status})
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
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
              <select id="habit-group" name="group_id" className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" required>
                <option value="">Select a group</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="habit-frequency">Frequency</Label>
                <select id="habit-frequency" name="frequency" defaultValue="daily" className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create habit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}