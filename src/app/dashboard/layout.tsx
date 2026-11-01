'use client'

import { Sidebar } from '@/components/shell/sidebar'
import { BottomNav } from '@/components/shell/bottom-nav'
import { ErrorBoundary } from '@/components/error-boundary'
import { type ReactNode } from 'react'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8 max-w-7xl w-full mx-auto">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
