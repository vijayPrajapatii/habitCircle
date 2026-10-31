import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Target } from 'lucide-react'

export default function HabitsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Habits</h1>
          <p className="text-muted-foreground mt-1">Habits you've committed to</p>
        </div>
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
            Create your first habit to start building consistency. Choose from daily, weekly, or custom schedules.
          </p>
          <Button size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Create Habit
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}