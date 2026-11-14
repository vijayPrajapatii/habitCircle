'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { User, Shield, Palette, Moon, Sun, Monitor, LogOut, Loader2, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { useTheme } from 'next-themes'
import { APP_NAME } from '@/config/brand'
import { timezoneOptions, formatTimezoneLabel } from '@/lib/timezones'
import { isValidUsername, normalizeUsername, USERNAME_HELP } from '@/lib/username'

export default function SettingsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [timezone, setTimezone] = useState('UTC')

  useEffect(() => {
    setMounted(true)
    const loadProfile = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        setEmail(user.email || '')

        const { data: profile } = await supabase
          .from('profiles')
          .select('username, timezone')
          .eq('id', user.id)
          .single()

        if (profile) {
          setUsername(profile.username || '')
          setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValidUsername(username)) {
      toast({ title: 'Invalid username', description: USERNAME_HELP, variant: 'destructive' })
      return
    }

    setSaving(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const normalized = normalizeUsername(username)
      const { error } = await supabase
        .from('profiles')
        .update({
          username: normalized,
          timezone: timezone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        toast({
          title: 'Update failed',
          // 23505 = unique violation on profiles.username
          description: error.code === '23505' ? 'That username is already taken. Try another one.' : error.message,
          variant: 'destructive',
        })
      } else {
        setUsername(normalized)
        toast({
          title: 'Settings saved',
          description: 'Your profile settings have been updated.',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update preferences.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-36 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
          Manage your account preferences, timezone, and appearance.
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Profile Preferences
          </CardTitle>
          <CardDescription>
            Your display name and habit evaluation timezone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your handle"
                  required
                  minLength={3}
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} disabled className="bg-muted/50" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm"
              >
                {timezoneOptions(timezone).map((tz) => (
                  <option key={tz} value={tz}>{formatTimezoneLabel(tz)}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Used for new habits. Each habit keeps the timezone it was created with, so its daily deadline never moves when you change this.
              </p>
            </div>

            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Appearance Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how {APP_NAME} looks on your device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mounted && (
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                  theme === 'dark' ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40'
                }`}
              >
                <Moon className="h-5 w-5 mb-1.5" />
                <span className="text-xs">Dark</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                  theme === 'light' ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40'
                }`}
              >
                <Sun className="h-5 w-5 mb-1.5" />
                <span className="text-xs">Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                  theme === 'system' ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40'
                }`}
              >
                <Monitor className="h-5 w-5 mb-1.5" />
                <span className="text-xs">System</span>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security & Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Security & Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start text-xs sm:text-sm" onClick={() => router.push('/forgot-password')}>
            Request Password Reset Email
          </Button>
          <Button variant="outline" className="w-full justify-start text-xs sm:text-sm text-destructive hover:bg-destructive/10" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out of Current Session
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
