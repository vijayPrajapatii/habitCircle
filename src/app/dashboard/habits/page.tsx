'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Target, CheckCircle2, Calendar, Loader2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface Schedule {
  id: string
  frequency: string
  target_quantity: number
  custom_cron: string | null
}

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
  schedule: Schedule
  occurrences: {
    id: string
    period_start: string
    period_end: string
    status: string
  }[]
}

interface Group {
  id: string
  name: string
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    group_id: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    target_quantity: 1,
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Load groups first
  useEffect(() => {
    const loadGroups = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('group_members' as any)
        .select(`
          groups (id, name)
        `)
        .eq('user_id', user.id)
        .is('left_at', null)

      if (error) console.error(error)
      const flat: Group[] = (data as any[] | null)?.flatMap((g: any) => g.groups) || []
      // Remove duplicates
      const uniqueGroups = Array.from(new Map(flat.map(g => [g.id, g])).values())
      setGroups(uniqueGroups)
      if (uniqueGroups.length > 0) {
        setFormData(prev => ({ ...prev, group_id: uniqueGroups[0].id }))
      }
      setLoadingGroups(false)
    }
    loadGroups()
  }, [supabase])

  // Load habits
  useEffect(() => {
    const loadHabits = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user's group memberships
      const { data: memberships, error: memError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .is('left_at', null)

      if (memError) {
        console.error('Error loading memberships:', memError)
        setLoading(false)
        return
      }

      const groupIds = (memberships as any[] | null)?.map(m => m.group_id) || []
      if (groupIds.length === 0) {
        setLoading(false)
        return
      }

      // Load habits from all user's groups
      const { data, error } = await supabase
        .from('habits' as any)
        .select(`
          id,
          group_id,
          name,
          timezone,
          created_at,
          group:groups (
            id,
            name,
            penalty_amount,
            currency
          ),
          schedule:habit_schedules (
            id,
            frequency,
            target_quantity,
            custom_cron
          )
        `)
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })

      if (error) console.error(error)

      // Join with group data properly
      const habitsWithGroup = (data as any[]).map(h => ({
        ...h,
        group: h.groups || h.group,
        schedule: h.habit_schedules?.[0] || h.schedule
      }))

      setHabits(habitsWithGroup)
      setLoading(false)
    }
    loadHabits()
  }, [supabase])

  const handleCreateHabit = async () => {
    if (!formData.group_id || !formData.name) return

    const response = await fetch('/api/habits/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    const result = await response.json()

    if (result.habit) {
      setHabits([result.habit, ...habits])
      setDialogOpen(false)
      setFormData({
        name: '',
        group_id: groups[0]?.id || '',
        frequency: 'daily',
        target_quantity: 1,
      })
    } else {
      alert(result.error || 'Failed to create habit')
    }
  }

  const getFrequencyLabel = (frequency: string, target: number) => {
    switch (frequency) {
      case 'daily':
        return `Every day`
      case 'weekly':
        return `Every week (${target}x days)`
      case 'monthly':
        return `Every month (${target}x times)`
      case 'quantity':
        return `Quantity (${target}x per period)`
      case 'custom':
        return `Custom schedule`
      default:
        return frequency
    }
  }

  const getStatusIcon = (habit: Habit) => {
    const recentOccurrences = habit.occurrences?.slice(0, 5) || []
    const completed = recentOccurrences.filter(o => o.status === 'evaluated').length
    return completed > 0 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Calendar className="h-4 w-4 text-muted-foreground" />
  }

  if (loading) {
    return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Habits</h1>
          <p className="text-muted-foreground mt-1">Habits you're committed to in your groups</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Habit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Habit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {loadingGroups ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading groups...</span>
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Create a group first to add habits</p>
                  <Button onClick={() => window.location.href = '/dashboard/groups'}>
                    Go to Groups
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="group">Group</Label>
                    <Select value={formData.group_id} onValueChange={(v) => setFormData({ ...formData, group_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Habit Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Morning Run"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select value={formData.frequency} onValueChange={(v: any) => setFormData({ ...formData, frequency: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target_quantity">Target (per period)</Label>
                    <Input
                      id="target_quantity"
                      type="number"
                      min={1}
                      max={100}
                      value={formData.target_quantity}
                      onChange={(e) => setFormData({ ...formData, target_quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
              )}

              <Button onClick={handleCreateHabit} disabled={!formData.group_id || !formData.name || loadingGroups}>
                Create Habit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!habits.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No habits yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first habit to start building consistency.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Habit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {habits.map(habit => (
            <Card key={habit.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(habit)}
                    <div>
                      <h3 className="font-semibold">{habit.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{habit.group?.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getFrequencyLabel(habit.schedule?.frequency || 'daily', habit.schedule?.target_quantity || 1)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(habit.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}