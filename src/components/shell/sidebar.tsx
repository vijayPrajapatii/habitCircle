'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Target,
  Activity,
  Trophy,
  Wallet,
  Bell,
  Settings,
  X,
  User,
  LogOut,
  Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/config/brand'
import { createClient } from '@/lib/supabase/client'

const mainNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Groups', href: '/dashboard/groups', icon: Users },
  { name: 'Habits', href: '/dashboard/habits', icon: Target },
  { name: 'Activity', href: '/dashboard/activity', icon: Activity },
  { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: Trophy },
  { name: 'Ledger', href: '/dashboard/ledger', icon: Wallet },
  { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [userName, setUserName] = useState('User')
  const [userEmail, setUserEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          setUserEmail(user.email || '')
          const metadataName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.username
          if (metadataName) {
            setUserName(metadataName)
          } else if (user.email) {
            setUserName(user.email.split('@')[0])
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()

    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const user = session.user
        setUserEmail(user.email || '')
        const metadataName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.username
        if (metadataName) {
          setUserName(metadataName)
        } else if (user.email) {
          setUserName(user.email.split('@')[0])
        }
      } else {
        setUserName('User')
        setUserEmail('')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out bg-card border-r border-border flex flex-col lg:static lg:-translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Main navigation"
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-border">
          <Link href="/dashboard" className="font-bold text-xl text-foreground flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-base">
              H
            </div>
            <span>{APP_NAME}</span>
          </Link>
          <button
            className="lg:hidden p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            onClick={() => setIsOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" role="navigation" aria-label="Main">
          <ul className="space-y-1" role="list">
            {mainNavigation.map((item) => {
              const isExact = pathname === item.href
              const isChild = item.href !== '/dashboard' && pathname.startsWith(item.href + '/')
              const isActive = isExact || isChild

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[42px]',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User Profile & Account Footer */}
        <div className="p-3 border-t border-border space-y-1">
          <Link
            href="/dashboard/profile"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium leading-none truncate text-foreground">{userName}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-1">{userEmail || 'My Account'}</p>
            </div>
          </Link>

          <Link
            href="/dashboard/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Floating mobile menu trigger button */}
      <button
        className="lg:hidden fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 active:scale-95 transition-all"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
        aria-expanded={isOpen}
      >
        <Menu className="h-6 w-6" />
      </button>
    </>
  )
}
