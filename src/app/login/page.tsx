'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { signIn, resendVerification } from '@/features/auth-profiles/actions'
import { APP_NAME } from '@/config/brand'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState('')
  const [isEmailNotConfirmed, setIsEmailNotConfirmed] = useState(false)
  const [infoMessage, setInfoMessage] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const message = url.searchParams.get('message')
      if (message) {
        setInfoMessage(message)
        window.history.replaceState({}, document.title, '/login')
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResendSuccess('')
    setInfoMessage('')
    setLoading(true)

    const formData = new FormData()
    formData.append('email', email)
    formData.append('password', password)

    const result = await signIn(formData)

    if (result?.error) {
      const lowerError = result.error.toLowerCase()
      if (lowerError.includes('email not confirmed')) {
        setError(result.error)
        setIsEmailNotConfirmed(true)
      } else {
        setError(result.error)
      }
    } else {
      router.push('/dashboard')
      router.refresh()
    }

    setLoading(false)
  }

  const handleResendVerification = async () => {
    setResendLoading(true)
    setResendSuccess('')
    setError('')

    const formData = new FormData()
    formData.append('email', email)

    const result = await resendVerification(formData)

    if (result?.success) {
      setResendSuccess(result.success)
    } else if (result?.error) {
      setError(result.error)
    }

    setResendLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 sm:py-12">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Sign in to your {APP_NAME} account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {infoMessage && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-blue-500/10 text-blue-500 text-xs sm:text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{infoMessage}</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-xs sm:text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-10 text-sm"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs sm:text-sm">Password</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 h-10 text-sm"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>

            {isEmailNotConfirmed && (
              <Button
                variant="outline"
                className="w-full gap-2 h-10 text-xs sm:text-sm"
                onClick={handleResendVerification}
                disabled={resendLoading}
              >
                {resendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {resendLoading ? 'Sending...' : 'Resend Verification Email'}
              </Button>
            )}

            {resendSuccess && !resendLoading && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-500 text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{resendSuccess}</span>
              </div>
            )}
          </form>

          <p className="text-center text-xs sm:text-sm text-muted-foreground pt-2 border-t">
            Don't have an account?{' '}
            <Link href="/signup" className="text-primary font-semibold hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
