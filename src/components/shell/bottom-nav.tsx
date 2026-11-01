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
      className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
      role="navigation"
      aria-label="Bottom navigation"
    >
      <ul className="grid grid-cols-5 h-14" role="list">
        {navigation.map((item) => {
          const isExact = pathname === item.href
          const isChild = item.href !== '/dashboard' && pathname.startsWith(item.href + '/')
          const isActive = isExact || isChild

          return (
            <li key={item.name} className="flex">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 transition-colors touch-manipulation select-none',
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-[10px] sm:text-xs leading-none truncate max-w-[62px] text-center">
                  {item.name}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
