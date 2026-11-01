'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Target, Loader2, CheckCircle2, Calendar, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Habit {
  id: string
  name: string
  frequency: string
  target_quantity: number
  checked_in: boolean
  group: { name: string }
  schedule: { frequency: string; target_quantity: number }
  created_at: string
}

export default function HabitsPage() {
  const router = useRouter()
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }

      setLoading(false)
    })
  }, [router])

  if (loading) {
    return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Habits</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Habit
        </Button>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No habits yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create your first habit to start building consistency.
          </p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Habit
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}