'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Globe, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME } from '@/config/brand'

export const dynamic = 'force-dynamic'

// Common timezones for the dropdown
const commonTimezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Hong_Kong',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
]

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [timezone, setTimezone] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detectedTimezone, setDetectedTimezone] = useState('')

  useEffect(() => {
    // Detect user's timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    setDetectedTimezone(tz)
    setTimezone(tz)

    // Check if username is already set (from URL param or session)
    const urlUsername = searchParams.get('username')
    if (urlUsername) {
      setUsername(urlUsername)
    }
  }, [searchParams])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Avatar must be less than 2MB')
        return
      }
      if (!file.type.startsWith('image/')) {
        setError('Avatar must be an image')
        return
      }
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
      setError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()

      // Update profile
      const updates: Record<string, any> = { timezone }
      if (username) {
        updates.username = username
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', (await supabase.auth.getUser()).data.user?.id)

      if (profileError) throw profileError

      // Upload avatar if provided
      if (avatarFile) {
        const userId = (await supabase.auth.getUser()).data.user?.id
        if (userId) {
          const fileExt = avatarFile.name.split('.').pop()
          const fileName = `${userId}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatarFile, { upsert: true })

          if (uploadError) throw uploadError

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName)

          await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', userId)
        }
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Globe className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to {APP_NAME}!</CardTitle>
          <CardDescription>Let's set up your profile</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-500 text-sm">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                Profile saved! Redirecting...
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading || success}
                minLength={3}
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">3-30 characters, letters, numbers, and underscores only</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading || success}
              >
                {commonTimezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz} {tz === detectedTimezone ? '(detected)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Used for habit deadlines and reminders</p>
            </div>

            <div className="space-y-2">
              <Label>Avatar (optional)</Label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="sr-only"
                    id="avatar"
                    disabled={loading || success}
                  />
                  <label
                    htmlFor="avatar"
                    className="h-20 w-20 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <Globe className="h-8 w-8 text-muted-foreground" />
                    )}
                  </label>
                </div>
                <div>
                  <p className="text-sm font-medium">Click to upload</p>
                  <p className="text-xs text-muted-foreground">Max 2MB, JPG/PNG/WebP</p>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || success}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {success ? 'Saving...' : 'Complete Setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>}>
      <OnboardingContent />
    </Suspense>
  )
}