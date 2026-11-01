'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Trophy, Medal, Sparkles } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

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

      const { data: habits } = await supabase
        .from('habits' as any)
        .select('id, created_by')
        .in('group_id', groupIds)

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

      memberStats.sort((a, b) => b.totalCheckins - a.totalCheckins || b.consistencyScore - a.consistencyScore)

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
      <div className="space-y-4 sm:space-y-6">
        <div>
          <Skeleton className="h-7 w-36 sm:h-8 sm:w-44" />
          <Skeleton className="h-4 w-48 sm:w-64 mt-1" />
        </div>
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Consistency & habit execution across your accountability circles.
        </p>
      </div>

      {/* Fair play banner */}
      <div className="flex items-center gap-2 p-2.5 sm:p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm text-foreground">
        <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <span className="text-[11px] sm:text-xs">
          <strong>Fair Play Rule:</strong> Rankings are strictly based on consistency and completed check-ins. Money is never used to rank members.
        </span>
      </div>

      {!leaders.length ? (
        <Card className="border-dashed">
          <CardContent className="py-10 sm:py-12 text-center px-4">
            <Trophy className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-base sm:text-lg font-semibold mb-1.5">No rankings yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm mx-auto text-xs sm:text-sm">
              Rankings will populate as members commit to habits and record verified check-ins in your circles.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Top 3 Podium (scaled for 375px+ screens) */}
          {leaders.length >= 2 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
              {/* Rank 2 */}
              {leaders[1] && (
                <Card className="text-center border-slate-400/30 bg-card overflow-hidden">
                  <CardContent className="p-2 sm:p-4 pt-4 sm:pt-6">
                    <div className="inline-flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-slate-400/10 text-slate-400 mb-1">
                      <Medal className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase">#2</p>
                    <p className="font-semibold text-xs sm:text-sm mt-0.5 truncate">
                      {leaders[1].username}
                    </p>
                    <div className="mt-2 pt-1.5 border-t text-[10px] sm:text-xs text-muted-foreground">
                      <span className="font-bold text-foreground block text-xs sm:text-sm">{leaders[1].totalCheckins}</span>
                      check-ins
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rank 1 */}
              {leaders[0] && (
                <Card className="text-center border-amber-500/40 bg-amber-500/5 -mt-1 sm:-mt-2 overflow-hidden shadow-sm">
                  <CardContent className="p-2 sm:p-4 pt-4 sm:pt-6">
                    <div className="inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 mb-1">
                      <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-[10px] sm:text-xs font-bold text-amber-500 uppercase">#1</p>
                    <p className="font-bold text-xs sm:text-sm mt-0.5 truncate">
                      {leaders[0].username}
                    </p>
                    <div className="mt-2 pt-1.5 border-t text-[10px] sm:text-xs text-muted-foreground">
                      <span className="font-bold text-foreground block text-xs sm:text-sm">{leaders[0].totalCheckins}</span>
                      check-ins
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rank 3 */}
              {leaders[2] ? (
                <Card className="text-center border-amber-700/30 bg-card overflow-hidden">
                  <CardContent className="p-2 sm:p-4 pt-4 sm:pt-6">
                    <div className="inline-flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-amber-700/10 text-amber-700 mb-1">
                      <Medal className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase">#3</p>
                    <p className="font-semibold text-xs sm:text-sm mt-0.5 truncate">
                      {leaders[2].username}
                    </p>
                    <div className="mt-2 pt-1.5 border-t text-[10px] sm:text-xs text-muted-foreground">
                      <span className="font-bold text-foreground block text-xs sm:text-sm">{leaders[2].totalCheckins}</span>
                      check-ins
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div />
              )}
            </div>
          )}

          {/* Full Standings List */}
          <Card>
            <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base flex items-center justify-between">
                <span>Circle Standings</span>
                <span className="text-xs text-muted-foreground font-normal">{leaders.length} members</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-4 pt-0 space-y-2">
              {leaders.map(member => (
                <div
                  key={member.userId}
                  className={`flex items-center justify-between p-2.5 sm:p-3 rounded-lg border transition-colors gap-2 ${
                    member.userId === currentUserId ? 'bg-primary/5 border-primary/40' : 'bg-card hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <span className="font-bold text-xs sm:text-sm w-5 text-center text-muted-foreground flex-shrink-0">
                      #{member.rank}
                    </span>
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                      {member.username.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs sm:text-sm truncate">
                        {member.username}
                        {member.userId === currentUserId && (
                          <Badge variant="secondary" className="ml-1.5 text-[9px] sm:text-[10px] py-0 px-1">You</Badge>
                        )}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {member.totalHabits} {member.totalHabits === 1 ? 'habit' : 'habits'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs sm:text-sm font-semibold">{member.totalCheckins} check-ins</p>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground">{member.consistencyScore}% score</p>
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
