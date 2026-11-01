'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

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

export default function GroupPage() {
  const params = useParams<{ groupId: string }>()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  if (!group) {
    return <div>Group not found</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{group.name}</h1>

      <div>
        <h2 className="text-lg font-semibold mb-2">Members ({members.length})</h2>
        <div className="grid gap-2">
          {members.map((m: Member) => (
            <div key={m.user_id} className="p-2 border rounded">
              <span className="font-medium">{m.profiles?.username || 'Unknown'}</span>
              <span className="text-xs text-muted-foreground ml-2">({m.role})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}