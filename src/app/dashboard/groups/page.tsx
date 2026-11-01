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
  member_count: number
}

interface GroupMember {
  groups: Group
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
        .from('group_members' as any)
        .select(`
          groups (id, name, description, penalty_amount, currency, max_members, created_at, group_members(id))
        `)
        .eq('user_id', user.id)
        .is('left_at', null)
        .order('joined_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) console.error(error)
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

  const handleCreateGroup = async () => {
    setCreateLoading(true)

    const formData = new FormData()
    formData.append('name', 'New Group')
    formData.append('description', '')
    formData.append('penalty_amount', '1000')
    formData.append('currency', 'INR')
    formData.append('timezone', 'UTC')
    formData.append('max_members', '10')

    try {
      const response = await fetch('/api/groups/create', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (result.group) {
        setGroups([result.group, ...groups])
        router.push(`/dashboard/groups/${result.group.id}`)
      } else {
        alert(result.error || 'Failed to create group')
      }
    } catch (error) {
      console.error('Error creating group:', error)
      alert('Error creating group')
    } finally {
      setCreateLoading(false)
    }
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
                  {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}