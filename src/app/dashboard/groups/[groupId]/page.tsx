import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, CheckCircle, Calendar } from 'lucide-react'
import Link from 'next/link'
import { getGroupDetail } from '@/features/groups/queries'
import { getUserHabits } from '@/features/habits/queries'
import { Checkbox } from '@/components/ui/checkbox'
import { format, parseISO, isToday, isYesterday, subDays } from 'date-fns'

async function GroupDetailContent({ params }: { params: { groupId: string } }) {
  const { group, members } = await getGroupDetail(params.groupId)
  const { habits } = await getUserHabits(params.groupId)

  if (!group) {
    return <div>Group not found</div>
  }

  // Mock checkin status - in real app this would come from DB
  const today = new Date()
  const userCheckins = ['habit-1', 'habit-3'] // Mock - replace with actual checkins

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="text-muted-foreground mt-1">{group.description}</p>
      </div>

      {/* Members List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Members ({members.length})</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Card key={member.user_id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {member.profile?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-medium">{member.profile?.username || 'Unknown'}</p>
                    <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Habits */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Today&apos;s Habits</h2>
          <Link href={`/dashboard/groups/${group.id}/habits/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Habit
            </Button>
          </Link>
        </div>

        {habits && habits.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              {habits.map((habit) => (
                <div key={habit.id} className="flex items-center justify-between p-4 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{habit.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {habit.frequency} • ₹{habit.penalty_amount} penalty
                    </p>
                  </div>
                  <Checkbox
                    checked={userCheckins.includes(habit.id)}
                    onCheckedChange={() => {}}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No habits created yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default async function GroupPage({ params }: { params: { groupId: string } }) {
  return <GroupDetailContent params={params} />
}