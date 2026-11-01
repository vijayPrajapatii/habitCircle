'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createInvitation } from '@/features/invitations/actions'
import { updateGroupName } from '@/features/groups/actions'
import { Users, Loader2, Send, Copy, AlertCircle, Pencil, Check, X } from 'lucide-react'
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
}

interface Member {
  user_id: string
  role: string
  profiles: { username: string }
}

interface Invitation {
  code: string
  link_token: string
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
  const [inviteLink, setInviteLink] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')

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
      setUserId(user.id)

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
          setGroupName(g.name)

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

  const handleSaveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingName(true)
    setNameError('')

    const formData = new FormData()
    formData.append('group_id', params.groupId)
    formData.append('name', groupName)
    const result = await updateGroupName(formData)

    if (result.error) {
      setNameError(result.error)
    } else {
      setGroup((current) => current ? { ...current, name: groupName.trim() } : current)
      setGroupName(groupName.trim())
      setEditingName(false)
    }
    setSavingName(false)
  }

  const handleInvite = async () => {
    if (!inviteEmail) return

    setInviting(true)
    setInviteSuccess('')
    setInviteError('')

    const formData = new FormData()
    formData.append('group_id', params.groupId)
    formData.append('email', inviteEmail)
    formData.append('max_uses', '1')
    formData.append('expires_in_days', '2')

    const result = await createInvitation(formData)
    if (result.error) {
      setInviteError(result.error)
    } else {
      const invitation = result.invitation as Invitation
      const link = `${window.location.origin}/invite/accept?token=${encodeURIComponent(invitation.link_token)}`
      setInviteLink(link)
      setInviteSuccess('Invitation link created. Share it with your friend to join this group.')
      setInviteEmail('')
    }
    setInviting(false)
  }

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
      alert('Invite link copied to clipboard!')
    }
  }

  if (loading) {
    return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  if (!group) {
    return <div>Group not found</div>
  }

  const isOwner = members.some((member) => member.user_id === userId && member.role === 'owner')

  return (
    <div className="space-y-6">
      {editingName ? (
        <form onSubmit={handleSaveName} className="flex items-center gap-2">
          <Input
            aria-label="Group name"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            disabled={savingName}
            maxLength={100}
            autoFocus
          />
          <Button type="submit" size="icon" aria-label="Save group name" disabled={savingName}>
            {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Cancel editing group name" onClick={() => { setGroupName(group.name); setNameError(''); setEditingName(false) }} disabled={savingName}>
            <X className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {isOwner && <Button type="button" variant="ghost" size="icon" aria-label="Edit group name" onClick={() => setEditingName(true)}><Pencil className="h-4 w-4" /></Button>}
        </div>
      )}
      {nameError && <p className="text-sm text-destructive" role="alert">{nameError}</p>}
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

          <form onSubmit={(e) => { e.preventDefault(); handleInvite(); }} className="space-y-3 mb-4">
            <div>
              <Label htmlFor="email">Friend's email</Label>
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

            <Button type="submit" disabled={inviting || !inviteEmail}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Invitation
            </Button>
          </form>

          <div className="border-t pt-4">
            <Button variant="ghost" onClick={copyInviteLink} disabled={!inviteLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Invite Link
            </Button>
            {inviteLink && <p className="mt-2 break-all text-xs text-muted-foreground">{inviteLink}</p>}
            <p className="text-xs text-muted-foreground mt-2">
              Create an invitation first, then share the link with your friend.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}