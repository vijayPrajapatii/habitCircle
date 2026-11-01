'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Loader2, Send, Copy, AlertCircle, Target, Calendar, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Group {
  id: string
  name: string
  description: string
  penalty_amount: number
  currency: string
  max_members: number
  timezone: string
  created_at: string
}

interface Member {
  user_id: string
  role: string
  profiles: { username: string }
}

interface Habit {
  id: string
  name: string
  timezone: string
  created_at: string
  schedule: {
    frequency: string
    target_quantity: number
  }
  occurrences: {
    period_start: string
    period_end: string
    status: string
  }[]
  _count?: {
    occurrences: number
  }
}

export default function GroupPage() {
  const params = useParams<{ groupId: string }>()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [habitsLoading, setHabitsLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [habitDialogOpen, setHabitDialogOpen] = useState(false)
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitFrequency, setNewHabitFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily')

  useEffect(() => {
    if (!params?.groupId) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }

      // Load group
      supabase
        .from('groups')
        .select(`*, members: group_members (user_id, role, profiles(username))`)
        .eq('id', params.groupId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error(error)
            setLoading(false)
            return
          }

          const g: Group = data
          setGroup(g)

          const filtered = (data as any).members.filter((m: any) => !m.left_at)
          const mapped = filtered.map((m: any) => ({
            user_id: m.user_id,
            role: m.role,
            profiles: m.profiles,
          }))
          setMembers(mapped)
          setLoading(false)
        })
    })
  }, [params?.groupId, router])

  // Load habits for the group
  useEffect(() => {
    if (!group?.id) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const loadHabits = async () => {
      setHabitsLoading(true)

      const { data, error } = await supabase
        .from('habits' as any)
        .select(`
          id,
          name,
          timezone,
          created_at,
          schedule:habit_schedules (
            frequency,
            target_quantity
          )
        `)
        .eq('group_id', group.id)
        .order('created_at', { ascending: false })

      if (error) console.error('Error loading habits:', error)

      const transformed = (data as any[]).map(h => ({
        ...h,
        schedule: h.schedules?.[0] || h.schedule
      }))

      setHabits(transformed)
      setHabitsLoading(false)
    }

    loadHabits()
  }, [group?.id])

  const handleInvite = async () => {
    if (!inviteEmail) return

    setInviting(true)
    setInviteSuccess('')
    setInviteError('')

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setInviteError('Not authenticated')
      setInviting(false)
      return
    }

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48)

    const { error } = await supabase
      .from('group_invitations')
      .insert({
        group_id: params?.groupId,
        email: inviteEmail,
        inviter_id: user.id,
        expires_at: expiresAt.toISOString(),
      })

    if (error) {
      setInviteError(error.message)
    } else {
      setInviteSuccess('Invitation sent! They will receive an email with a link to join.')
      setInviteEmail('')
    }
    setInviting(false)
  }

  const handleCreateHabit = async () => {
    if (!newHabitName.trim() || !group?.id) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if user is admin or owner
    const member = members.find(m => m.user_id === user.id)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      alert('Only admins can create habits')
      return
    }

    // Create habit
    const { data: habit, error: habitError } = await supabase
      .from('habits')
      .insert({
        group_id: group.id,
        name: newHabitName,
        timezone: group.timezone || 'UTC',
      })
      .select()
      .single()

    if (habitError) {
      alert(habitError.message)
      return
    }

    // Create schedule
    const { error: scheduleError } = await supabase
      .from('habit_schedules')
      .insert({
        habit_id: habit.id,
        frequency: newHabitFrequency,
        target_quantity: 1,
      })

    if (scheduleError) {
      alert(scheduleError.message)
      return
    }

    // Refresh habits
    setHabits([{
      id: habit.id,
      name: habit.name,
      timezone: habit.timezone,
      created_at: habit.created_at,
      schedule: {
        frequency: newHabitFrequency,
        target_quantity: 1
      }
    }, ...habits])

    setHabitDialogOpen(false)
    setNewHabitName('')
    setNewHabitFrequency('daily')
  }

  const copyInviteLink = () => {
    if (group) {
      const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL}/invite/${group.id}`
      navigator.clipboard.writeText(inviteLink)
      alert('Invite link copied to clipboard!')
    }
  }

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'Daily'
      case 'weekly': return 'Weekly'
      case 'monthly': return 'Monthly'
      default: return frequency
    }
  }

  const getHabitStatus = (habit: Habit) => {
    if (!habit.occurrences?.length) return 'pending'
    const latest = [...habit.occurrences].sort((a, b) =>
      new Date(b.period_start).getTime() - new Date(a.period_start).getTime()
    )[0]
    return latest?.status === 'verified' ? 'completed' : 'pending'
  }

  if (loading) {
    return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  if (!group) {
    return <div>Group not found</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="text-muted-foreground">{group.description}</p>
      </div>

      {/* Habits Section - Visible to all group members */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Habits ({habits.length})</h2>
          <Dialog open={habitDialogOpen} onOpenChange={setHabitDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Target className="h-4 w-4 mr-2" />
                Add Habit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Habit</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Habit Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Morning Run"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select value={newHabitFrequency} onValueChange={(v: any) => setNewHabitFrequency(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateHabit}>Create Habit</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {habitsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading habits...</span>
          </div>
        ) : habits.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">No habits in this group yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {habits.map(habit => (
              <Card key={habit.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getHabitStatus(habit) === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{habit.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getFrequencyLabel(habit.schedule?.frequency || 'daily')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Members Section */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Members ({members.length})</h2>
        <div className="grid gap-2">
          {members.map((m: Member) => (
            <div key={m.user_id} className="p-2 border rounded flex justify-between items-center">
              <div>
                <span className="font-medium">{m.profiles?.username || 'Unknown'}</span>
                <span className="text-xs text-muted-foreground ml-2">({m.role})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Section */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Invite Friends</h3>

          <form onSubmit={(e) => { e.preventDefault(); handleInvite(); }} className="space-y-3 mb-4">
            <div>
              <Label htmlFor="email">Friend's email</Label>
              <Input
                id="email"
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting}
              />
            </div>

            {inviteSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 text-green-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {inviteSuccess}
              </div>
            )}

            {inviteError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {inviteError}
              </div>
            )}

            <Button type="submit" disabled={inviting || !inviteEmail}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Invitation
            </Button>
          </form>

          <div className="border-t pt-4">
            <Button variant="ghost" onClick={copyInviteLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Invite Link
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Or share this link with friends
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}