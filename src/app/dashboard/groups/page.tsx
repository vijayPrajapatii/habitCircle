'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

async function fetchGroups(supabase: ReturnType<typeof createBrowserClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: groups, error } = await supabase
    .from('group_members')
    .select(`
      group_id,
      role,
      joined_at,
      groups:groups (
        id,
        name,
        description,
        penalty_amount,
        currency,
        max_members,
        timezone,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', user.id)
    .is('left_at', null)
    .order('joined_at', { ascending: false })

  if (error) return []

  return groups?.map(g => ({
    id: g.groups.id,
    name: g.groups.name,
    description: g.groups.description,
    penalty_amount: g.groups.penalty_amount,
    currency: g.groups.currency,
    max_members: g.groups.max_members,
    timezone: g.groups.timezone,
    created_at: g.groups.created_at,
    updated_at: g.groups.updated_at,
  })) || []
}

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    fetchGroups(supabase).then(data => {
      setGroups(data)
      setLoading(false)
    })
  }, [])

  const handleCreateGroup = async () => {
    setCreateLoading(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: user } = await supabase.auth.getUser()
    if (!user?.user) {
      setCreateLoading(false)
      return
    }

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name: 'New Group',
        description: '',
        penalty_amount: 1000,
        currency: 'INR',
        timezone: 'UTC',
        max_members: 10,
        created_by: user.user.id,
      })
      .select()
      .single()

    if (group) {
      // Add as owner
      await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.user.id,
          role: 'owner',
        })

      setGroups([group, ...groups])
    }
    setCreateLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!groups.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Groups</h1>
            <p className="text-muted-foreground mt-1">Groups you own or belong to</p>
          </div>
          <Button onClick={handleCreateGroup} disabled={createLoading}>
            {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            New Group
          </Button>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first group to start building habits with friends.
            </p>
            <Button onClick={handleCreateGroup} disabled={createLoading}>
              {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Group
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Groups</h1>
        <Button onClick={handleCreateGroup} disabled={createLoading}>
          {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          New Group
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{group.name}</h3>
                <Link href={`/dashboard/groups/${group.id}`} className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{group.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {group.max_members} members • ₹{group.penalty_amount} penalty
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}