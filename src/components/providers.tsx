'use client'

import { ThemeProvider } from 'next-themes'
import { type ReactNode } from 'react'
import { Toaster } from '@/components/ui/toaster'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
