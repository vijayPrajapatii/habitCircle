'use client'

import { Sidebar } from '@/components/shell/sidebar'
import { BottomNav } from '@/components/shell/bottom-nav'
import { MobileTopBar } from '@/components/shell/mobile-top-bar'
import { ErrorBoundary } from '@/components/error-boundary'
import { useState, useEffect, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const name = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.username
          setUserName(name || user.email?.split('@')[0] || '')
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchUser()
  }, [])

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Sidebar (Desktop static left panel / Mobile slide-over drawer) */}
      <Sidebar isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Header */}
        <MobileTopBar onOpenMenu={() => setDrawerOpen(true)} userName={userName} />

        {/* Main Content Area */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8 max-w-7xl w-full mx-auto">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Thumb Navigation */}
      <BottomNav />
    </div>
  )
}
