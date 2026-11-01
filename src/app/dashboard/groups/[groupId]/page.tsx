'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { createInvitation } from '@/features/invitations/actions'
import { deleteGroup, updateGroupName } from '@/features/groups/actions'
import { getGroupHabits, createHabit, checkInHabit, deleteHabit, type Habit } from '@/features/habits/actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Users,
  Loader2,
  Send,
  Copy,
  Pencil,
  Check,
  X,
  Trash2,
  Target,
  Plus,
  Shield,
  CheckCircle2,
  Wallet,
} from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { CURRENCY_SYMBOLS } from '@/domain/money'

interface Group {
  id: string
  name: string
  description: string
  penalty_amount: number
  currency: string
  max_members: number
}

interface Member {
  user_id: string
  role: string
  profiles: { username: string } | null
}

interface Invitation {
  code: string
  link_token: string
}

function GroupSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 sm:h-8 sm:w-48" />
        <Skeleton className="h-4 w-60 sm:w-72" />
      </div>
      <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className={i === 3 ? 'col-span-2 sm:col-span-1' : ''}>
            <CardContent className="p-3 sm:p-4">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-5 w-14" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4 sm:p-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-2">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function GroupPage() {
  const params = useParams<{ groupId: string }>()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // Name editing
  const [editingName, setEditingName] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')

  // Deletion
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Invitation
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  // Habits management inside group
  const [createHabitOpen, setCreateHabitOpen] = useState(false)
  const [creatingHabit, setCreatingHabit] = useState(false)
  const [habitFormName, setHabitFormName] = useState('')
  const [habitFormFrequency, setHabitFormFrequency] = useState('daily')
  const [habitFormTarget, setHabitFormTarget] = useState('1')
  const [habitError, setHabitError] = useState<string | null>(null)
  const [checkingInHabitId, setCheckingInHabitId] = useState<string | null>(null)
  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null)
  const [deletingHabit, setDeletingHabit] = useState(false)

  const loadData = useCallback(async () => {
    if (!params?.groupId) return

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const [groupRes, habitsRes] = await Promise.all([
        supabase
          .from('groups')
          .select(`*, members: group_members (user_id, role, profiles(username))`)
          .eq('id', params.groupId)
          .single(),
        getGroupHabits(params.groupId),
      ])

      if (groupRes.error || !groupRes.data) {
        setLoading(false)
        return
      }

      const g: Group = groupRes.data
      setGroup(g)
      setGroupName(g.name)

      const filtered = (groupRes.data as any).members?.filter((m: any) => !m.left_at) || []
      const mapped = filtered.map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        profiles: m.profiles,
      }))
      setMembers(mapped)

      if (habitsRes.habits) {
        setHabits(habitsRes.habits)
      }

      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [params?.groupId, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingName(true)
    setNameError('')

    const formData = new FormData()
    formData.append('group_id', params.groupId)
    formData.append('name', groupName.trim())
    const result = await updateGroupName(formData)

    if (result.error) {
      setNameError(result.error)
    } else {
      setGroup((current) => current ? { ...current, name: groupName.trim() } : current)
      setGroupName(groupName.trim())
      setEditingName(false)
      toast({
        title: 'Circle renamed',
        description: `Name updated to "${groupName.trim()}"`,
      })
    }
    setSavingName(false)
  }

  const handleDeleteGroup = async () => {
    setDeleting(true)
    setDeleteError('')

    const formData = new FormData()
    formData.append('group_id', params.groupId)
    const result = await deleteGroup(formData)
    if (result.error) {
      setDeleteError(result.error)
      setDeleting(false)
      return
    }

    toast({
      title: 'Circle deleted',
      description: `${group?.name} has been removed.`,
    })
    router.push('/dashboard/groups')
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return

    setInviting(true)
    setInviteSuccess('')
    setInviteError('')

    const formData = new FormData()
    formData.append('group_id', params.groupId)
    formData.append('email', inviteEmail.trim())
    formData.append('max_uses', '1')
    formData.append('expires_in_days', '2')

    const result = await createInvitation(formData)
    if (result.error) {
      setInviteError(result.error)
    } else {
      const invitation = result.invitation as Invitation
      const link = `${window.location.origin}/invite/accept?token=${encodeURIComponent(invitation.link_token)}`
      setInviteLink(link)
      setInviteSuccess('Invite link ready!')
      setInviteEmail('')
      toast({
        title: 'Invite link created',
        description: 'Copy and send the token to your peer.',
      })
    }
    setInviting(false)
  }

  const copyInviteLink = async () => {
    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2500)
        toast({
          title: 'Link copied',
          description: 'Shareable token copied to clipboard.',
        })
      } catch {
        toast({
          title: 'Copy failed',
          description: 'Please copy the link text manually.',
          variant: 'destructive',
        })
      }
    }
  }

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingHabit(true)
    setHabitError(null)

    const formData = new FormData()
    formData.append('group_id', params.groupId)
    formData.append('name', habitFormName.trim())
    formData.append('frequency', habitFormFrequency)
    formData.append('target_quantity', habitFormTarget)
    formData.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone)

    const result = await createHabit(formData)
    if (result.error) {
      setHabitError(result.error)
      setCreatingHabit(false)
      return
    }

    const refreshed = await getGroupHabits(params.groupId)
    if (refreshed.habits) {
      setHabits(refreshed.habits)
    }

    setCreateHabitOpen(false)
    setHabitFormName('')
    setHabitFormFrequency('daily')
    setHabitFormTarget('1')
    setCreatingHabit(false)
    toast({
      title: 'Habit added',
      description: `"${habitFormName.trim()}" commitment active.`,
    })
  }

  const handleCheckIn = async (habitId: string) => {
    setCheckingInHabitId(habitId)
    const result = await checkInHabit(habitId)
    if (result.error) {
      toast({
        title: 'Check-in failed',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      const refreshed = await getGroupHabits(params.groupId)
      if (refreshed.habits) {
        setHabits(refreshed.habits)
      }
      toast({
        title: 'Checked in!',
        description: "Today's check-in recorded.",
      })
    }
    setCheckingInHabitId(null)
  }

  const handleDeleteHabit = async () => {
    if (!deleteHabitId) return
    setDeletingHabit(true)
    const result = await deleteHabit(deleteHabitId)
    if (result.error) {
      toast({
        title: 'Delete failed',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      setHabits(current => current.filter(h => h.id !== deleteHabitId))
      setDeleteHabitId(null)
      toast({
        title: 'Habit removed',
        description: 'Habit deleted from circle.',
      })
    }
    setDeletingHabit(false)
  }

  if (loading) {
    return <GroupSkeleton />
  }

  if (!group) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center px-4">
          <h2 className="text-lg font-semibold mb-2">Circle not found</h2>
          <p className="text-muted-foreground text-xs sm:text-sm mb-4">
            This circle may have been removed or you are not an active member.
          </p>
          <Button size="sm" onClick={() => router.push('/dashboard/groups')}>Back to Circles</Button>
        </CardContent>
      </Card>
    )
  }

  const isOwner = members.some((member) => member.user_id === userId && member.role === 'owner')
  const currencySymbol = CURRENCY_SYMBOLS[group.currency] || group.currency

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2 max-w-md">
              <Input
                aria-label="Circle name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={savingName}
                maxLength={100}
                className="text-base sm:text-lg font-bold h-9"
                autoFocus
              />
              <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0" disabled={savingName}>
                {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={() => { setGroupName(group.name); setNameError(''); setEditingName(false) }}
                disabled={savingName}
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{group.name}</h1>
              {isOwner && (
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="Edit circle name"
                    onClick={() => setEditingName(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    aria-label="Delete circle"
                    onClick={() => { setDeleteError(''); setDeleteOpen(true) }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
          {nameError && <p className="text-xs text-destructive mt-1" role="alert">{nameError}</p>}
          <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm line-clamp-2">
            {group.description || 'No description provided.'}
          </p>
        </div>

        <Button onClick={() => setCreateHabitOpen(true)} size="sm" className="h-9 px-3 text-xs sm:text-sm flex-shrink-0 self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Habit
        </Button>
      </div>

      {/* Rules & Metrics Overview */}
      <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] sm:text-xs font-medium">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              Penalty Stake
            </div>
            <div className="text-lg sm:text-2xl font-bold mt-1">
              {currencySymbol}{(group.penalty_amount / 100).toFixed(0)}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">per missed habit</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] sm:text-xs font-medium">
              <Users className="h-3.5 w-3.5 text-primary" />
              Members
            </div>
            <div className="text-lg sm:text-2xl font-bold mt-1">
              {members.length} <span className="text-xs font-normal text-muted-foreground">/ {group.max_members}</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">accountability partners</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] sm:text-xs font-medium">
              <Target className="h-3.5 w-3.5 text-primary" />
              Circle Habits
            </div>
            <div className="text-lg sm:text-2xl font-bold mt-1">
              {habits.length}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">commitments tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Circle Habits Section */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Circle Habits ({habits.length})
          </h2>
          <Button variant="outline" size="sm" onClick={() => setCreateHabitOpen(true)} className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            New
          </Button>
        </div>

        {!habits.length ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center px-4">
              <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold text-sm sm:text-base mb-1">No habits in this circle yet</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mb-4 max-w-sm mx-auto">
                Set up a habit for yourself or invite circle members to establish their commitments.
              </p>
              <Button size="sm" onClick={() => setCreateHabitOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create Circle Habit
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            {habits.map((habit) => {
              const isCreator = habit.created_by === userId
              const isCheckedIn = habit.checkins?.some(c => c.profile_id === userId)

              return (
                <Card key={habit.id} className="transition-all hover:border-primary/40">
                  <CardContent className="p-3.5 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm sm:text-base truncate">{habit.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          by <span className="text-foreground font-medium">{habit.creator?.username || 'Member'}</span>
                        </p>
                      </div>

                      {isCreator && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                          onClick={() => setDeleteHabitId(habit.id)}
                          aria-label={`Delete ${habit.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {habit.schedule?.frequency || 'daily'}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        Target: {habit.schedule?.target_quantity || 1}x
                      </span>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant={isCheckedIn ? 'secondary' : 'default'}
                        onClick={() => handleCheckIn(habit.id)}
                        disabled={!isCreator || isCheckedIn || checkingInHabitId === habit.id}
                        className="text-xs h-8 px-3"
                      >
                        {checkingInHabitId === habit.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {!isCreator
                          ? 'View only'
                          : isCheckedIn
                            ? 'Checked in'
                            : 'Check in'}
                      </Button>

                      <span className="text-xs text-muted-foreground">
                        {habit.checkins?.length || 0} {(habit.checkins?.length || 0) === 1 ? 'check-in' : 'check-ins'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Members & Invite Section */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        {/* Members List */}
        <Card>
          <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-4 pt-0 space-y-2">
            {members.map((m: Member) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                    {(m.profiles?.username || 'U').slice(0, 2)}
                  </div>
                  <p className="font-medium text-xs sm:text-sm leading-tight truncate">
                    {m.profiles?.username || 'Member'}
                    {m.user_id === userId && <span className="text-[11px] text-muted-foreground ml-1">(you)</span>}
                  </p>
                </div>

                <Badge
                  variant={m.role === 'owner' ? 'default' : m.role === 'admin' ? 'secondary' : 'outline'}
                  className="text-[10px] capitalize flex-shrink-0"
                >
                  {m.role === 'owner' && <Shield className="h-3 w-3 mr-1" />}
                  {m.role}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Invite Friends */}
        <Card>
          <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Invite Partners
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-4 pt-0 space-y-3.5">
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">Partner's email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="friend@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviting}
                  className="h-10 text-sm"
                />
              </div>

              {inviteSuccess && (
                <p className="text-xs text-green-500 font-medium">{inviteSuccess}</p>
              )}
              {inviteError && (
                <p className="text-xs text-destructive font-medium">{inviteError}</p>
              )}

              <Button type="submit" size="sm" disabled={inviting || !inviteEmail.trim()} className="w-full h-10 text-xs sm:text-sm">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Generate Invite Link
              </Button>
            </form>

            <div className="border-t pt-3 space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyInviteLink}
                disabled={!inviteLink}
                className="w-full justify-center h-10 text-xs sm:text-sm"
              >
                {copiedLink ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedLink ? 'Copied to Clipboard!' : 'Copy Shareable Link'}
              </Button>
              {inviteLink ? (
                <p className="break-all text-[11px] text-muted-foreground p-2 rounded bg-muted/60 max-h-20 overflow-y-auto">
                  {inviteLink}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground text-center">
                  Generate a private token link above to onboard friends directly.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Habit Dialog */}
      <Dialog open={createHabitOpen} onOpenChange={setCreateHabitOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Add habit to {group.name}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Commit to a habit in this circle. All members can view your consistency.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateHabit} className="space-y-3.5 sm:space-y-4">
            {habitError && (
              <p className="text-xs sm:text-sm text-destructive" role="alert">{habitError}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="habit-modal-name" className="text-xs sm:text-sm">Habit name *</Label>
              <Input
                id="habit-modal-name"
                value={habitFormName}
                onChange={(e) => setHabitFormName(e.target.value)}
                placeholder="e.g. 30min Morning Workout"
                required
                maxLength={100}
                className="h-10 text-sm"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="habit-modal-frequency" className="text-xs sm:text-sm">Frequency</Label>
                <select
                  id="habit-modal-frequency"
                  value={habitFormFrequency}
                  onChange={(e) => setHabitFormFrequency(e.target.value)}
                  className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="habit-modal-target" className="text-xs sm:text-sm">Target count</Label>
                <Input
                  id="habit-modal-target"
                  type="number"
                  min="1"
                  max="100"
                  value={habitFormTarget}
                  onChange={(e) => setHabitFormTarget(e.target.value)}
                  className="h-10 text-sm"
                  required
                />
              </div>
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateHabitOpen(false)} className="w-full sm:w-auto h-10">
                Cancel
              </Button>
              <Button type="submit" disabled={creatingHabit || !habitFormName.trim()} className="w-full sm:w-auto h-10">
                {creatingHabit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Habit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Delete {group.name}?</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              This permanently removes the circle, all group habits, active invitations, and member records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-xs sm:text-sm text-destructive">{deleteError}</p>}
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting} className="w-full sm:w-auto h-10">
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteGroup} disabled={deleting} className="w-full sm:w-auto h-10">
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Circle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Habit Dialog */}
      <Dialog open={Boolean(deleteHabitId)} onOpenChange={(open) => { if (!open && !deletingHabit) setDeleteHabitId(null) }}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Delete this habit?</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Are you sure? All check-ins and recorded history for this habit will be removed permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteHabitId(null)} disabled={deletingHabit} className="w-full sm:w-auto h-10">
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteHabit} disabled={deletingHabit} className="w-full sm:w-auto h-10">
              {deletingHabit && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
