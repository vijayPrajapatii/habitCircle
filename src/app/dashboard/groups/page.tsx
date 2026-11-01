import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Loader2, AlertCircle, Copy, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { getUserGroups } from '@/features/groups/queries'
import { createGroup } from '@/features/groups/actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

async function GroupsContent() {
  const { groups, error } = await getUserGroups()

  if (error) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  const [localGroups, setLocalGroups] = useState(groups || [])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreateGroup = async () => {
    setLoading(true)
    const formData = new FormData()
    formData.append('name', 'New Group')
    formData.append('description', '')
    formData.append('penalty_amount', '1000')
    formData.append('currency', 'INR')
    formData.append('timezone', 'UTC')
    formData.append('max_members', '10')

    const result = await createGroup(formData)
    if (result?.group) {
      setLocalGroups([...localGroups, result.group])
    }
    setLoading(false)
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Groups</h1>
            <p className="text-muted-foreground mt-1">Groups you own or belong to</p>
          </div>
          <Button onClick={handleCreateGroup} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            New Group
          </Button>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first group to start building habits with friends.
            </p>
            <Button onClick={handleCreateGroup} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Group
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Groups</h1>
        <Button onClick={handleCreateGroup} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          New Group
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{group.name}</h3>
                <Link href={`/dashboard/groups/${group.id}`} className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{group.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {group.max_members} members • ₹{group.penalty_amount} penalty
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function GroupsPage() {
  return <GroupsContent />
}