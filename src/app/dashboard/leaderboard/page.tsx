'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Trophy, Medal, Target, CheckCircle2, Flame, Users, Sparkles } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME } from '@/config/brand'

interface LeaderboardMember {
  userId: string
  username: string
  totalCheckins: number
  totalHabits: number
  consistencyScore: number
  rank: number
}

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [leaders, setLeaders] = useState<LeaderboardMember[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const loadLeaderboard = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      // Fetch user's groups
      const { data: memberships } = await supabase
        .from('group_members' as any)
        .select('group_id')
        .eq('user_id', user?.id || '')
        .is('left_at', null)

      const groupIds = (memberships as any[] | null)?.map(m => m.group_id) || []

      if (!groupIds.length) {
        setLoading(false)
        return
      }

      // Fetch all members in these groups
      const { data: allMembers } = await supabase
        .from('group_members' as any)
        .select(`
          user_id,
          profiles:profiles (id, username)
        `)
        .in('group_id', groupIds)
        .is('left_at', null)

      const uniqueUserMap = new Map<string, string>()
      if (allMembers) {
        for (const m of allMembers as any[]) {
          if (m.profiles?.id) {
            uniqueUserMap.set(m.profiles.id, m.profiles.username || 'Member')
          }
        }
      }

      // Fetch habits in these groups
      const { data: habits } = await supabase
        .from('habits' as any)
        .select('id, created_by')
        .in('group_id', groupIds)

      // Fetch verified check-ins
      const { data: checkins } = await supabase
        .from('habit_checkins' as any)
        .select('id, profile_id, status')
        .eq('status', 'submitted')

      const memberStats: LeaderboardMember[] = []

      for (const [uid, uname] of uniqueUserMap.entries()) {
        const userHabits = (habits as any[] | null)?.filter(h => h.created_by === uid) || []
        const userCheckins = (checkins as any[] | null)?.filter(c => c.profile_id === uid) || []

        const habitsCount = Math.max(1, userHabits.length)
        const checkinsCount = userCheckins.length
        const score = Math.min(100, Math.round((checkinsCount / habitsCount) * 100))

        memberStats.push({
          userId: uid,
          username: uname,
          totalHabits: userHabits.length,
          totalCheckins: checkinsCount,
          consistencyScore: score,
          rank: 1,
        })
      }

      // Sort by total check-ins, then consistency
      memberStats.sort((a, b) => b.totalCheckins - a.totalCheckins || b.consistencyScore - a.consistencyScore)

      // Assign ranks
      const ranked = memberStats.map((m, idx) => ({ ...m, rank: idx + 1 }))
      setLeaders(ranked)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLeaderboard()
  }, [loadLeaderboard])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Consistency & habit execution across your accountability circles.
        </p>
      </div>

      {/* Philosophy banner: Pure consistency, not money */}
      <div className="flex items-center gap-2 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm text-foreground">
        <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <span>
          <strong>Fair Play Rule:</strong> Rankings are strictly based on consistency and completed check-ins. Financial penalty data is never used to rank members.
        </span>
      </div>

      {!leaders.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No rankings yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
              Rankings will populate as members commit to habits and record verified check-ins in your groups.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Top 3 Podium Cards if at least 2 members */}
          {leaders.length >= 2 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {leaders.slice(0, 3).map((leader, i) => (
                <Card
                  key={leader.userId}
                  className={`text-center relative overflow-hidden ${
                    leader.rank === 1
                      ? 'border-amber-500/50 bg-amber-500/5 sm:order-2 order-1 col-span-2 sm:col-span-1'
                      : leader.rank === 2
                        ? 'border-slate-400/40 sm:order-1 order-2'
                        : 'border-amber-700/40 sm:order-3 order-3'
                  }`}
                >
                  <CardContent className="p-4 pt-6">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-2">
                      {leader.rank === 1 ? (
                        <Trophy className="h-5 w-5 text-amber-500" />
                      ) : (
                        <Medal className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Rank #{leader.rank}
                    </p>
                    <p className="font-bold text-base mt-1 truncate">
                      {leader.username}
                      {leader.userId === currentUserId && ' (You)'}
                    </p>
                    <div className="mt-3 pt-2 border-t flex justify-around text-xs text-muted-foreground">
                      <div>
                        <span className="font-bold text-foreground text-sm block">{leader.totalCheckins}</span>
                        check-ins
                      </div>
                      <div>
                        <span className="font-bold text-foreground text-sm block">{leader.totalHabits}</span>
                        habits
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Full Rankings List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Circle Standings</span>
                <span className="text-xs text-muted-foreground font-normal">{leaders.length} members</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaders.map(member => (
                <div
                  key={member.userId}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    member.userId === currentUserId ? 'bg-primary/5 border-primary/40' : 'bg-card hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-sm w-6 text-center text-muted-foreground">
                      #{member.rank}
                    </span>
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                      {member.username.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {member.username}
                        {member.userId === currentUserId && (
                          <Badge variant="secondary" className="ml-2 text-[10px] py-0">You</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.totalHabits} {member.totalHabits === 1 ? 'active habit' : 'active habits'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{member.totalCheckins} check-ins</p>
                      <p className="text-[11px] text-muted-foreground">{member.consistencyScore}% score</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
