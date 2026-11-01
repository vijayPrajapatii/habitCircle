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
import { Plus, Users, Loader2, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'

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
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
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
        <h1 className="text-xl sm:text-2xl font-bold truncate">Groups</h1>
        <Button
          onClick={() => { resetForm(); setDialogOpen(true) }}
          className="flex-shrink-0"
          aria-label="Create group"
          title="Create group"
        >
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">New Group</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {!groups.length ? (
        <Card className="border-dashed">
          <CardContent className="py-10 sm:py-14 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
              Create a group and invite friends to start building habits together. Set penalty amounts to keep everyone accountable.
            </p>
            <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => (
            <Card key={group.id} className="transition-shadow hover:shadow-md touch-manipulation group/card">
              <Link
                href={`/dashboard/groups/${group.id}`}
                className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm sm:text-base truncate">{group.name}</h3>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{group.description || 'No description'}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs text-muted-foreground">
                      {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {formatCurrency(group.currency)}{(group.penalty_amount / 100).toFixed(0)} penalty
                    </Badge>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open) }}>
        <DialogContent className="sm:max-w-md mx-2">
          <DialogHeader>
            <DialogTitle>Create a group</DialogTitle>
            <DialogDescription>
              Set up a new accountability group. Members who miss habits will owe the penalty amount.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="group-name">Group name *</Label>
              <Input
                id="group-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Fitness Buddies"
                required
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">Description</Label>
              <Input
                id="group-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Daily workout accountability"
                maxLength={500}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="group-penalty">Penalty amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {formatCurrency(formCurrency)}
                  </span>
                  <Input
                    id="group-penalty"
                    type="number"
                    value={formPenalty}
                    onChange={(e) => setFormPenalty(e.target.value)}
                    className="pl-8"
                    min="1"
                    step="1"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-currency">Currency</Label>
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
            <div className="space-y-2">
              <Label htmlFor="group-members">Max members</Label>
              <Input
                id="group-members"
                type="number"
                value={formMaxMembers}
                onChange={(e) => setFormMaxMembers(e.target.value)}
                min="2"
                max="50"
              />
              <p className="text-xs text-muted-foreground">Between 2 and 50 members</p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={createLoading || !formName.trim()} className="w-full sm:w-auto">
                {createLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Group
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
