'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { User, Shield, Palette, Moon, Sun, Monitor, LogOut, Loader2, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import { toast } from '@/hooks/use-toast'

export default function ProfilePage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [username, setUsername] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [email, setEmail] = useState('')

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
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

      setLoading(false)
    })
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          timezone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        toast({
          title: 'Update failed',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Profile updated',
          description: 'Your profile changes have been saved.',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save changes.',
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
      <div className="space-y-4 sm:space-y-6 max-w-2xl">
        <Skeleton className="h-7 w-32 sm:h-8 sm:w-44" />
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Manage your account profile, timezone, and appearance.
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Profile Details
          </CardTitle>
          <CardDescription className="text-xs">
            Personal identity information visible across your accountability circles.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 pt-0">
          <form onSubmit={handleSave} className="space-y-3.5 sm:space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs sm:text-sm">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose your handle"
                required
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="h-10 text-sm bg-muted/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timezone" className="text-xs sm:text-sm">Timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="UTC">UTC (Universal Time)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="America/New_York">America/New York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los Angeles (PST/PDT)</option>
                <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                Commitment deadlines and grace periods align to this timezone.
              </p>
            </div>

            <Button type="submit" disabled={saving} className="h-10 text-xs sm:text-sm w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Appearance Section */}
      <Card>
        <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Appearance
          </CardTitle>
          <CardDescription className="text-xs">
            Theme preference for your device.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 pt-0">
          {mounted && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-lg border transition-all ${
                  theme === 'dark' ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40'
                }`}
              >
                <Moon className="h-4 w-4 sm:h-5 sm:w-5 mb-1" />
                <span className="text-[11px] sm:text-xs">Dark</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-lg border transition-all ${
                  theme === 'light' ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40'
                }`}
              >
                <Sun className="h-4 w-4 sm:h-5 sm:w-5 mb-1" />
                <span className="text-[11px] sm:text-xs">Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-lg border transition-all ${
                  theme === 'system' ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40'
                }`}
              >
                <Monitor className="h-4 w-4 sm:h-5 sm:w-5 mb-1" />
                <span className="text-[11px] sm:text-xs">System</span>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Session Actions */}
      <Card>
        <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Account Security
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 pt-0 space-y-2">
          <Button variant="outline" className="w-full justify-start text-xs sm:text-sm h-10" onClick={() => router.push('/forgot-password')}>
            Change Password via Email
          </Button>
          <Button variant="outline" className="w-full justify-start text-xs sm:text-sm h-10 text-destructive hover:bg-destructive/10" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
