'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Group {
  id: string
  name: string
  description: string
  penalty_amount: number
  currency: string
  max_members: number
  created_at: string
}

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [createLoading, setCreateLoading] = useState(false)

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

      supabase
        .from('group_members')
        .select(`
          groups (id, name, description, penalty_amount, currency, max_members, created_at)
        `)
        .eq('user_id', user.id)
        .is('left_at', null)
        .order('joined_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) console.error(error)
          setGroups(data?.map(g => g.groups) || [])
          setLoading(false)
        })
    })
  }, [router])

  const handleCreateGroup = async () => {
    setCreateLoading(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setCreateLoading(false)
      return
    }

    const { data: group } = await supabase
      .from('groups')
      .insert({
        name: 'New Group',
        description: '',
        penalty_amount: 1000,
        currency: 'INR',
        timezone: 'UTC',
        max_members: 10,
        created_by: user.id,
      })
      .select()
      .single()

    if (group) {
      await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'owner',
        })
      setGroups([group, ...groups])
    }
    setCreateLoading(false)
  }

  if (loading) {
    return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Groups</h1>
        <Button onClick={handleCreateGroup} disabled={createLoading}>
          {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          New Group
        </Button>
      </div>

      {!groups.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-4">Create your first group</p>
            <Button onClick={handleCreateGroup} disabled={createLoading}>
              Create Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => (
            <Card key={group.id} onClick={() => router.push(`/dashboard/groups/${group.id}`)} className="cursor-pointer hover:shadow-md">
              <CardContent className="p-4">
                <h3 className="font-semibold">{group.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{group.description}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {group.max_members} members
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}