import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bell } from 'lucide-react'

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Feed</h1>
        <p className="text-muted-foreground mt-1">What's happening in your groups</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Activity will appear here when group members check in, verify, or join groups.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}