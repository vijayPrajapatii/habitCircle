import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Link2 } from 'lucide-react'

export default function GroupsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Groups</h1>
          <p className="text-muted-foreground mt-1">Groups you own or belong to</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create your first group or join one via an invite link to start building habits together.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
            <Button variant="outline" size="lg">
              <Link2 className="h-4 w-4 mr-2" />
              Join via Invite
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}