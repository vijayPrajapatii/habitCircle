'use client'

import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Group {
  id: string
  name: string
  description: string
  max_members: number
}

export default function InvitePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const params = useParams<{ groupId: string }>()

  useEffect(() => {
    const acceptInvite = async () => {
      if (!params?.groupId) return

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Check auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Check if invitation exists
      const { data: invitation, error: invError } = await supabase
        .from('group_invitations')
        .select('group_id, expires_at, email, status')
        .eq('group_id', params.groupId)
        .eq('email', user.email)
        .eq('status', 'pending')
        .single()

      if (invError || !invitation) {
        setError('No valid invitation found')
        setLoading(false)
        return
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        setError('Invitation has expired')
        setLoading(false)
        return
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', params.groupId)
        .eq('user_id', user.id)
        .is('left_at', null)

      if (existingMember) {
        setSuccess(true)
        setTimeout(() => router.push(`/dashboard/groups/${params.groupId}`), 1500)
        return
      }

      // Add user to group
      const { error: addError } = await supabase
        .from('group_members')
        .insert({
          group_id: params.groupId,
          user_id: user.id,
          role: 'member',
        })

      if (addError) {
        setError(addError.message)
        setLoading(false)
        return
      }

      // Update invitation status
      await supabase
        .from('group_invitations')
        .update({ status: 'accepted' })
        .eq('group_id', params.groupId)
        .eq('email', user.email)

      setSuccess(true)
      setTimeout(() => router.push(`/dashboard/groups/${params.groupId}`), 1500)
    }

    acceptInvite()
  }, [params?.groupId, router])

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Welcome to the Group!</h1>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Invitation Error</h1>
            <p className="text-muted-foreground mb-5">{error}</p>
            <Button onClick={() => router.push('/dashboard/groups')} className="w-full">
              Back to Groups
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-12 w-12 mx-auto animate-spin mb-4" />
        <h1 className="text-2xl font-bold mb-2">Accepting Invitation...</h1>
        <p className="text-muted-foreground">Please wait</p>
      </div>
    </div>
  )
}