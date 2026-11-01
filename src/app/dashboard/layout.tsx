'use client'

import { Sidebar } from '@/components/shell/sidebar'
import { BottomNav } from '@/components/shell/bottom-nav'
import { type ReactNode } from 'react'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-4 sm:p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}