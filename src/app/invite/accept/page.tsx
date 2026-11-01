'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Loader2, AlertCircle, CheckCircle2, Link2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { APP_NAME } from '@/config/brand'

export const dynamic = 'force-dynamic'

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>}>
      <AcceptInviteWrapper />
    </Suspense>
  )
}

function AcceptInviteWrapper() {
  const router = useRouter()
  const searchParams = useSearchParams()

  return <AcceptInviteContent router={router} searchParams={searchParams} />
}

function AcceptInviteContent({ router, searchParams }: { router: ReturnType<typeof useRouter>; searchParams: ReturnType<typeof useSearchParams> }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  useEffect(() => {
    const acceptInvite = async () => {
      const code = searchParams.get('code')
      const token = searchParams.get('token')

      if (!code && !token) {
        setStatus('error')
        setMessage('Invalid invitation link')
        return
      }

      try {
        const supabase = createClient()

        const { data, error } = await supabase.rpc('accept_group_invitation', {
          p_code: code,
          p_link_token: token,
        })

        if (error) {
          throw error
        }

        // Get group name for display
        const { data: group } = await supabase
          .from('groups')
          .select('name')
          .eq('id', data.group_id)
          .single()

        if (group) {
          setGroupName(group.name)
        }

        setStatus('success')
        setMessage(`You've joined "${group?.name || 'the group'}"!`)

        setTimeout(() => {
          router.push('/dashboard/groups')
          router.refresh()
        }, 2000)
      } catch (err: any) {
        setStatus('error')
        setMessage(err.message || 'Failed to accept invitation')
      }
    }

    acceptInvite()
  }, [router, searchParams])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Accepting invitation...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push('/login')}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
            <CheckCircle2 className="h-7 w-7 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Welcome to the group!</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.push('/dashboard/groups')}>
            Go to Groups
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}