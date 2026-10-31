import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

export default function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground mt-1">Group and personal rankings</p>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Leaderboard coming soon</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Track completion %, streaks, and consistency across your groups. Never ranked by money.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}