'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
    return <div className="p-4 sm:p-6"><Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold truncate">Groups</h1>
        <Button onClick={handleCreateGroup} disabled={createLoading} className="flex-shrink-0" aria-label="Create group" title="Create group">
          {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          <span className="hidden sm:inline">New Group</span>
        </Button>
      </div>

      {!groups.length ? (
        <Card className="border-dashed">
          <CardContent className="py-8 sm:py-12 text-center">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-4 px-4">Create your first group</p>
            <Button onClick={handleCreateGroup} disabled={createLoading} className="w-full sm:w-auto">
              Create Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-4 xs:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => (
            <Card key={group.id} className="transition-shadow hover:shadow-md touch-manipulation">
              <Link href={`/dashboard/groups/${group.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <CardContent className="p-3 sm:p-4">
                <h3 className="font-semibold text-sm sm:text-base truncate">{group.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{group.description || 'No description'}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                </div>
              </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}