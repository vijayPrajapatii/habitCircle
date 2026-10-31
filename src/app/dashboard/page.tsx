'use client'

import { Sidebar } from '@/components/shell/sidebar'
import { BottomNav } from '@/components/shell/bottom-nav'
import { Target, Flame, Trophy, Users, Calendar, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function ActivityItem({
  user,
  action,
  habit,
  time,
}: {
  user: string
  action: string
  habit: string
  time: string
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
        <CheckCircle2 className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          <span className="font-semibold">{user}</span> {action} <span className="font-medium">{habit}</span>
        </p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  )
}

function HabitRow({
  name,
  frequency,
  time,
  status,
}: {
  name: string
  frequency: string
  time: string
  status: 'pending' | 'completed'
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <div
          className={`h-3 w-3 rounded-full ${
            status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/30'
          }`}
        />
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">{frequency} · {time}</p>
        </div>
      </div>
      <span
        className={`text-xs font-medium px-2 py-1 rounded-full ${
          status === 'completed'
            ? 'bg-green-500/10 text-green-500'
            : 'bg-muted-foreground/10 text-muted-foreground'
        }`}
      >
        {status === 'completed' ? 'Done' : 'Pending'}
      </span>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:pl-0">
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
          <div className="space-y-6">
            {/* Welcome Header */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
              <p className="text-muted-foreground mt-1">Here's your habit overview for today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Today's Habits"
                value="3"
                description="2 completed, 1 pending"
                icon={Target}
              />
              <StatCard
                title="Current Streak"
                value="7"
                description="days on fire"
                icon={Flame}
              />
              <StatCard
                title="This Week"
                value="85%"
                description="completion rate"
                icon={Trophy}
              />
              <StatCard
                title="Active Groups"
                value="2"
                description="groups you're in"
                icon={Users}
              />
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <button className="w-full justify-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left">
                    <Calendar className="h-5 w-5 text-primary" />
                    <span className="font-medium">Check In Now</span>
                  </button>
                  <button className="w-full justify-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left">
                    <Target className="h-5 w-5 text-muted-foreground" />
                    <span>View My Habits</span>
                  </button>
                  <button className="w-full justify-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span>Browse Groups</span>
                  </button>
                  <button className="w-full justify-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                    <span>Review Activity</span>
                  </button>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ActivityItem
                    user="You"
                    action="completed"
                    habit="Morning Run"
                    time="2 hours ago"
                  />
                  <ActivityItem
                    user="Alex"
                    action="verified your"
                    habit="Read 20 pages"
                    time="4 hours ago"
                  />
                  <ActivityItem
                    user="Sam"
                    action="joined"
                    habit="Weekly Workout"
                    time="1 day ago"
                  />
                  <div className="text-center pt-2">
                    <button className="text-sm text-primary hover:underline">View all activity</button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Upcoming Habits */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Upcoming Habits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <HabitRow name="Morning Run" frequency="Daily" time="6:00 AM" status="pending" />
                  <HabitRow name="Read 20 pages" frequency="Daily" time="9:00 PM" status="completed" />
                  <HabitRow name="Weekly Workout" frequency="Weekly (Mon/Wed/Fri)" time="7:00 PM" status="pending" />
                  <HabitRow name="Meditation" frequency="Daily" time="8:00 AM" status="pending" />
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}