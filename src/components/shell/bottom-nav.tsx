'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Target, Activity, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Groups', href: '/dashboard/groups', icon: Users },
  { name: 'Habits', href: '/dashboard/habits', icon: Target },
  { name: 'Activity', href: '/dashboard/activity', icon: Activity },
  { name: 'Profile', href: '/dashboard/profile', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)] lg:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      role="navigation"
      aria-label="Bottom navigation"
    >
      <ul className="grid grid-cols-5" role="list">
        {navigation.map((item) => {
          const isExact = pathname === item.href
          const isChild = item.href !== '/dashboard' && pathname.startsWith(item.href + '/')
          const isActive = isExact || isChild

          return (
            <li key={item.name}>
              <Link
                href={item.href}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate max-w-[56px] text-center">{item.name}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
