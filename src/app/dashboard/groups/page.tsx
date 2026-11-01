'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Users, Loader2, ArrowRight, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { EditGroupStakesDialog } from '@/components/groups/edit-group-stakes-dialog'

interface Group {
  id: string
  name: string
  description: string
  penalty_amount: number
  currency: string
  max_members: number
  created_at: string
  member_count: number
}

function GroupsSkeleton() {
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
              <Skeleton className="h-3 w-48 mb-3" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function formatCurrency(currency: string): string {
  const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }
  return symbols[currency] || currency
}

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<Group | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPenalty, setFormPenalty] = useState('100')
  const [formCurrency, setFormCurrency] = useState('INR')
  const [formMaxMembers, setFormMaxMembers] = useState('10')

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }

      supabase
        .from('group_members' as any)
        .select(`
          groups (id, name, description, penalty_amount, currency, max_members, created_at, group_members(id))
        `)
        .eq('user_id', user.id)
        .is('left_at', null)
        .order('joined_at', { ascending: false })
        .then(({ data, error: fetchError }) => {
          if (fetchError) {
            setError(fetchError.message)
            setLoading(false)
            return
          }
          const flat: Group[] = (data as any[] | null)?.flatMap((g: any) => {
            const group = g.groups
            if (!group) return []
            return [{
              ...group,
              member_count: group.group_members?.length || 0,
            }]
          }) || []
          setGroups(flat)
          setLoading(false)
        })
    })
  }, [router])

  const resetForm = () => {
    setFormName('')
    setFormDescription('')
    setFormPenalty('100')
    setFormCurrency('INR')
    setFormMaxMembers('10')
    setError(null)
  }

  const handleCreateGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('name', formName.trim())
    formData.append('description', formDescription.trim())
    formData.append('penalty_amount', String(Math.round(parseFloat(formPenalty) * 100)))
    formData.append('currency', formCurrency)
    formData.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone)
    formData.append('max_members', formMaxMembers)

    try {
      const response = await fetch('/api/groups/create', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (result.group) {
        setGroups(current => [{ ...result.group, member_count: 1 }, ...current])
        setDialogOpen(false)
        resetForm()
        toast({
          title: 'Group created',
          description: `"${formName.trim()}" is ready. Invite your friends!`,
        })
        router.push(`/dashboard/groups/${result.group.id}`)
      } else {
        setError(result.error || 'Failed to create group')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  if (loading) {
    return <GroupsSkeleton />
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Circles</h1>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
            Your accountability groups and peer penalty rules.
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setDialogOpen(true) }}
          size="sm"
          className="h-9 px-3 text-xs sm:text-sm flex-shrink-0"
          aria-label="Create new circle"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          <span>New Circle</span>
        </Button>
      </div>

      {!groups.length ? (
        <Card className="border-dashed">
          <CardContent className="py-8 sm:py-14 text-center px-4">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-base sm:text-lg font-semibold mb-1.5">No circles yet</h3>
            <p className="text-muted-foreground mb-5 max-w-sm mx-auto text-xs sm:text-sm leading-relaxed">
              Create a group and invite friends to start building habits together. Set penalty amounts to keep everyone accountable.
            </p>
            <Button onClick={() => { resetForm(); setDialogOpen(true) }} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1.5" />
              Create First Circle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => (
            <Card key={group.id} className="transition-all hover:shadow-md hover:border-primary/40 touch-manipulation group/card">
              <Link
                href={`/dashboard/groups/${group.id}`}
                className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 p-3.5 sm:p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm sm:text-base truncate flex-1">{group.name}</h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setEditGroup(group) }}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Edit ${group.name} stakes`}
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-60 group-hover/card:opacity-100 group-hover/card:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[32px]">
                  {group.description || 'No description provided.'}
                </p>
                <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t">
                  <span className="text-xs text-muted-foreground">
                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                    {formatCurrency(group.currency)}{(group.penalty_amount / 100).toFixed(0)} / miss
                  </Badge>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Stakes Dialog */}
      <EditGroupStakesDialog
        open={Boolean(editGroup)}
        onOpenChange={(open) => { if (!open) setEditGroup(null) }}
        group={editGroup!}
        onSuccess={(updatedGroup) => {
          setGroups(current => current.map(g => g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g))
          setEditGroup(null)
        }}
      />

      {/* Responsive Create Group Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open) }}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Create Accountability Circle</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Members who miss scheduled habit check-ins will owe the penalty stake to fellow members.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-3.5 sm:space-y-4">
            {error && (
              <p className="text-xs sm:text-sm text-destructive" role="alert">{error}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="group-name" className="text-xs sm:text-sm">Circle name *</Label>
              <Input
                id="group-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. 6AM Fitness Buddies"
                required
                maxLength={100}
                className="h-10 text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="group-description" className="text-xs sm:text-sm">Description (optional)</Label>
              <Input
                id="group-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Daily accountability circle"
                maxLength={500}
                className="h-10 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="group-penalty" className="text-xs sm:text-sm">Penalty amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                    {formatCurrency(formCurrency)}
                  </span>
                  <Input
                    id="group-penalty"
                    type="number"
                    value={formPenalty}
                    onChange={(e) => setFormPenalty(e.target.value)}
                    className="pl-8 h-10 text-sm"
                    min="1"
                    step="1"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="group-currency" className="text-xs sm:text-sm">Currency</Label>
                <select
                  id="group-currency"
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="group-members" className="text-xs sm:text-sm">Max members</Label>
                <span className="text-[11px] text-muted-foreground">{formMaxMembers} members</span>
              </div>
              <Input
                id="group-members"
                type="number"
                value={formMaxMembers}
                onChange={(e) => setFormMaxMembers(e.target.value)}
                min="2"
                max="50"
                className="h-10 text-sm"
              />
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto h-10">
                Cancel
              </Button>
              <Button type="submit" disabled={createLoading || !formName.trim()} className="w-full sm:w-auto h-10">
                {createLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Circle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
