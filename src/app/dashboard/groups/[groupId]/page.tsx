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
  Calendar,
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
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-6 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
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
        title: 'Group renamed',
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
      title: 'Group deleted',
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
      setInviteSuccess('Invitation link generated! Share it with your friend.')
      setInviteEmail('')
      toast({
        title: 'Invitation ready',
        description: 'Invite link generated. You can now copy and share it.',
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
          description: 'Invite link copied to your clipboard.',
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

    // Refresh habits
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
      title: 'Habit created',
      description: `"${habitFormName.trim()}" is now active in this group.`,
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
        description: "Today's check-in recorded successfully.",
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
        description: 'Habit deleted from this group.',
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
        <CardContent className="py-12 text-center">
          <h2 className="text-xl font-semibold mb-2">Group not found</h2>
          <p className="text-muted-foreground mb-4">The group you are looking for may have been removed or you do not have permission to view it.</p>
          <Button onClick={() => router.push('/dashboard/groups')}>Back to Groups</Button>
        </CardContent>
      </Card>
    )
  }

  const isOwner = members.some((member) => member.user_id === userId && member.role === 'owner')
  const currencySymbol = CURRENCY_SYMBOLS[group.currency] || group.currency

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          {editingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2">
              <Input
                aria-label="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={savingName}
                maxLength={100}
                className="text-xl font-bold h-10 max-w-sm"
                autoFocus
              />
              <Button type="submit" size="icon" aria-label="Save group name" disabled={savingName}>
                {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cancel"
                onClick={() => { setGroupName(group.name); setNameError(''); setEditingName(false) }}
                disabled={savingName}
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{group.name}</h1>
              {isOwner && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Edit group name"
                    onClick={() => setEditingName(true)}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Delete group"
                    onClick={() => { setDeleteError(''); setDeleteOpen(true) }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          )}
          {nameError && <p className="text-sm text-destructive mt-1" role="alert">{nameError}</p>}
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {group.description || 'No description provided.'}
          </p>
        </div>

        <Button onClick={() => setCreateHabitOpen(true)} className="flex-shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          New Habit
        </Button>
      </div>

      {/* Rules & Stats Overview */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Wallet className="h-4 w-4 text-primary" />
              Penalty Rule
            </div>
            <div className="text-xl sm:text-2xl font-bold mt-1">
              {currencySymbol}{(group.penalty_amount / 100).toFixed(0)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">per missed habit</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Users className="h-4 w-4 text-primary" />
              Members
            </div>
            <div className="text-xl sm:text-2xl font-bold mt-1">
              {members.length} <span className="text-xs font-normal text-muted-foreground">/ {group.max_members}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">active accountability partners</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Target className="h-4 w-4 text-primary" />
              Group Habits
            </div>
            <div className="text-xl sm:text-2xl font-bold mt-1">
              {habits.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">habits tracked together</p>
          </CardContent>
        </Card>
      </div>

      {/* Group Habits Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Group Habits ({habits.length})
          </h2>
          <Button variant="outline" size="sm" onClick={() => setCreateHabitOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Habit
          </Button>
        </div>

        {!habits.length ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold text-base mb-1">No habits in this group yet</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mb-4 max-w-sm mx-auto">
                Set up a habit for yourself or invite members to establish their commitments.
              </p>
              <Button size="sm" onClick={() => setCreateHabitOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Group Habit
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            {habits.map((habit) => {
              const isCreator = habit.created_by === userId
              const isCheckedIn = habit.checkins?.some(c => c.profile_id === userId)

              return (
                <Card key={habit.id} className="transition-all hover:border-primary/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-base truncate">{habit.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          by <span className="text-foreground font-medium">{habit.creator?.username || 'Member'}</span>
                        </p>
                      </div>

                      {isCreator && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteHabitId(habit.id)}
                          aria-label={`Delete ${habit.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {habit.schedule?.frequency || 'daily'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Target: {habit.schedule?.target_quantity || 1}x
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant={isCheckedIn ? 'secondary' : 'default'}
                        onClick={() => handleCheckIn(habit.id)}
                        disabled={!isCreator || isCheckedIn || checkingInHabitId === habit.id}
                        className="text-xs h-8"
                      >
                        {checkingInHabitId === habit.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {!isCreator
                          ? 'View only'
                          : isCheckedIn
                            ? 'Checked in today'
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
      <div className="grid gap-6 md:grid-cols-2">
        {/* Members List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m: Member) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                    {(m.profiles?.username || 'U').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-sm leading-tight">
                      {m.profiles?.username || 'Member'}
                      {m.user_id === userId && <span className="text-xs text-muted-foreground ml-1.5">(you)</span>}
                    </p>
                  </div>
                </div>

                <Badge
                  variant={m.role === 'owner' ? 'default' : m.role === 'admin' ? 'secondary' : 'outline'}
                  className="text-[10px] capitalize"
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Invite Partners
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <Label htmlFor="email" className="text-xs">Friend's email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="partner@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviting}
                  className="mt-1"
                />
              </div>

              {inviteSuccess && (
                <p className="text-xs text-green-500 font-medium">{inviteSuccess}</p>
              )}
              {inviteError && (
                <p className="text-xs text-destructive font-medium">{inviteError}</p>
              )}

              <Button type="submit" size="sm" disabled={inviting || !inviteEmail.trim()} className="w-full">
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
                className="w-full justify-center"
              >
                {copiedLink ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedLink ? 'Copied to Clipboard!' : 'Copy Shareable Invite Link'}
              </Button>
              {inviteLink ? (
                <p className="break-all text-[11px] text-muted-foreground p-2 rounded bg-muted">
                  {inviteLink}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  Enter an email above to generate a private invite token for your group.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Habit Dialog */}
      <Dialog open={createHabitOpen} onOpenChange={setCreateHabitOpen}>
        <DialogContent className="sm:max-w-md mx-2">
          <DialogHeader>
            <DialogTitle>Add habit to {group.name}</DialogTitle>
            <DialogDescription>
              Commit to a habit in this group. All members will be able to see your progress and keep you accountable.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateHabit} className="space-y-4">
            {habitError && (
              <p className="text-sm text-destructive" role="alert">{habitError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="habit-modal-name">Habit name *</Label>
              <Input
                id="habit-modal-name"
                value={habitFormName}
                onChange={(e) => setHabitFormName(e.target.value)}
                placeholder="e.g. 30min Morning Workout"
                required
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="habit-modal-frequency">Frequency</Label>
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
              <div className="space-y-2">
                <Label htmlFor="habit-modal-target">Target count</Label>
                <Input
                  id="habit-modal-target"
                  type="number"
                  min="1"
                  max="100"
                  value={habitFormTarget}
                  onChange={(e) => setHabitFormTarget(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateHabitOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingHabit || !habitFormName.trim()}>
                {creatingHabit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Habit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {group.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the group, all group habits, active invitations, and member associations. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteGroup} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Habit Dialog */}
      <Dialog open={Boolean(deleteHabitId)} onOpenChange={(open) => { if (!open && !deletingHabit) setDeleteHabitId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this habit?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this habit? All check-ins and recorded history for this habit will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteHabitId(null)} disabled={deletingHabit}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteHabit} disabled={deletingHabit}>
              {deletingHabit && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
