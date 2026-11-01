'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Target, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Groups', href: '/dashboard/groups', icon: Users },
  { name: 'Habits', href: '/dashboard/habits', icon: Target },
  { name: 'Settings', href: '/dashboard/settings', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)] lg:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="navigation"
      aria-label="Bottom navigation"
    >
      <ul className="grid grid-cols-4" role="list">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="h-6 w-6" aria-hidden="true" />
                {item.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}