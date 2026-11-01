'use client'

import Link from 'next/link'
import { Bell, Menu } from 'lucide-react'
import { APP_NAME } from '@/config/brand'

interface MobileTopBarProps {
  onOpenMenu: () => void
  userName?: string
}

export function MobileTopBar({ onOpenMenu, userName }: MobileTopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
      <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-foreground tracking-tight">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
          H
        </div>
        <span>{APP_NAME}</span>
      </Link>

      <div className="flex items-center gap-1.5">
        <Link
          href="/dashboard/notifications"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </Link>

        <button
          onClick={onOpenMenu}
          className="flex h-9 items-center gap-2 rounded-lg px-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Open navigation menu"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px] uppercase">
            {(userName || 'U').slice(0, 2)}
          </div>
          <Menu className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
