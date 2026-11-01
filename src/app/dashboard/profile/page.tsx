'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Shield, Palette, Moon, Sun, LogOut, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSuccess, setSavingSuccess] = useState(false)
  const [savingError, setSavingError] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [timezone, setTimezone] = useState('')
  const [email, setEmail] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>('system')

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }

      setEmail(user.email || '')

      // Fetch profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username, timezone, avatar')
        .eq('id', user.id)
        .single()

      if (!profileError && profile) {
        setUsername(profile.username || '')
        setTimezone(profile.timezone || 'UTC')
        setAvatar(null) // Avatar upload would go here
      }

      // Check theme preference (simplified - would integrate with next-themes)
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null
      setCurrentTheme(savedTheme || 'system')

      setLoading(false)
    })
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    setSavingError(null)
    setSavingSuccess(false)

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase
      .from('profiles')
      .update({
        username,
        timezone,
        updated_at: new Date().toISOString()
      })
      .eq('id', (await supabase.auth.getUser()).data.user?.id)

    if (error) {
      setSavingError(error.message)
    } else {
      setSavingSuccess(true)
      setTimeout(() => setSavingSuccess(false), 2000)
    }

    setSaving(false)
  }

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
  }

  const toggleTheme = (theme: 'light' | 'dark' | 'system') => {
    setCurrentTheme(theme)
    localStorage.setItem('theme', theme)
    // In a real app, this would trigger next-themes update
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account information</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New York</option>
              <option value="America/Los_Angeles">America/Los Angeles</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </div>
          {savingSuccess && (
            <p className="text-sm text-green-600">Changes saved successfully!</p>
          )}
          {savingError && (
            <p className="text-sm text-destructive">{savingError}</p>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Appearance Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-muted-foreground">Use dark theme</p>
            </div>
            <Button
              variant={currentTheme === 'dark' ? 'default' : 'outline'}
              onClick={() => toggleTheme('dark')}
            >
              <Moon className="h-4 w-4 mr-2" />
              Dark
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Light Mode</p>
              <p className="text-sm text-muted-foreground">Use light theme</p>
            </div>
            <Button
              variant={currentTheme === 'light' ? 'default' : 'outline'}
              onClick={() => toggleTheme('light')}
            >
              <Sun className="h-4 w-4 mr-2" />
              Light
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">System</p>
              <p className="text-sm text-muted-foreground">Match system preference</p>
            </div>
            <Button
              variant={currentTheme === 'system' ? 'default' : 'outline'}
              onClick={() => toggleTheme('system')}
            >
              <Palette className="h-4 w-4 mr-2" />
              System
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out Everywhere
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Shield className="h-4 w-4 mr-2" />
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Shield className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Deleting your account is permanent and cannot be undone.</p>
          <Button variant="destructive" className="w-full justify-start">
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}