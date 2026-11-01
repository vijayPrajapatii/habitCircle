'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Loader2, Send, Copy, AlertCircle } from 'lucide-react'
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
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviteError, setInviteError] = useState('')

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

  const handleInvite = async () => {
    if (!inviteEmail) return

    setInviting(true)
    setInviteSuccess('')
    setInviteError('')

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setInviteError('Not authenticated')
      setInviting(false)
      return
    }

    // Check if already a member
    const { data: existingMembers } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', params?.groupId)
      .eq('user_id', user.id)
      .is('left_at', null)

    if (!existingMembers || existingMembers.length === 0) {
      setInviteError('You must be a member to invite others')
      setInviting(false)
      return
    }

    // Create invitation record
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48)

    const { error } = await supabase
      .from('group_invitations')
      .insert({
        group_id: params.groupId,
        email: inviteEmail,
        inviter_id: user.id,
        expires_at: expiresAt.toISOString(),
      })

    if (error) {
      setInviteError(error.message)
    } else {
      setInviteSuccess('Invitation sent! They will receive an email with a link to join.')
      setInviteEmail('')
    }
    setInviting(false)
  }

  const copyInviteLink = () => {
    if (group) {
      const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL}/invite/${group.id}`
      navigator.clipboard.writeText(inviteLink)
      alert('Invite link copied to clipboard!')
    }
  }

  const handleLeaveGroup = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    await supabase
      .from('group_members')
      .update({ left_at: new Date().toISOString() })
      .eq('group_id', params?.groupId)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)

    router.push('/dashboard/groups')
  }

  if (loading) {
    return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  if (!group) {
    return <div>Group not found</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{group.name}</h1>
      <p className="text-muted-foreground">{group.description}</p>

      {/* Members */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Members ({members.length})</h2>
        <div className="grid gap-2">
          {members.map((m: Member) => (
            <div key={m.user_id} className="p-2 border rounded flex justify-between items-center">
              <div>
                <span className="font-medium">{m.profiles?.username || 'Unknown'}</span>
                <span className="text-xs text-muted-foreground ml-2">({m.role})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Section */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Invite Friends</h3>

          {/* Email invitation */}
          <form onSubmit={(e) => { e.preventDefault(); handleInvite(); }} className="space-y-3 mb-4">
            <div>
              <Label htmlFor="email">Friend&apos;s email</Label>
              <Input
                id="email"
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting}
              />
            </div>

            {inviteSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 text-green-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {inviteSuccess}
              </div>
            )}

            {inviteError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {inviteError}
              </div>
            )}

            <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Invitation
            </Button>
          </form>

          {/* Invite link */}
          <div className="border-t pt-4">
            <Button variant="ghost" onClick={copyInviteLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Invite Link
            </Button>
            <<p className="text-xs text-muted-foreground mt-2">
              Or share this link: {`${process.env.NEXT_PUBLIC_SITE_URL}/invite/[groupId]`}
            </p>
          </div>
        </CardContent>
      </div>
    </div>
  )
}