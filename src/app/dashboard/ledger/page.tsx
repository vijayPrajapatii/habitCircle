'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet, ArrowDownRight, ArrowUpRight, ShieldCheck, Info, Users, Clock } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatMoneySafe } from '@/domain/money'
import { isCompletedCheckin } from '@/domain/checkin-state'
import { APP_NAME } from '@/config/brand'

interface GroupBalance {
  id: string
  name: string
  currency: string
  penalty_amount: number
  member_count: number
}

interface LedgerTransaction {
  id: string
  created_at: string
  group_name: string
  habit_name: string
  type: 'penalty' | 'checkin'
  amount: number
  currency: string
  description: string
}

/** Sum stakes per currency. Currencies are never mixed or converted. */
function totalByCurrency(groups: GroupBalance[]): { currency: string; amount: number }[] {
  const totals = new Map<string, number>()
  for (const group of groups) {
    totals.set(group.currency, (totals.get(group.currency) ?? 0) + group.penalty_amount)
  }
  return Array.from(totals, ([currency, amount]) => ({ currency, amount }))
}

export default function LedgerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [groups, setGroups] = useState<GroupBalance[]>([])
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([])
  const [missedCount, setMissedCount] = useState(0)

  const loadLedger = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: memberData, error: memberError } = await supabase
        .from('group_members' as any)
        .select(`
          groups (id, name, currency, penalty_amount, group_members(id, left_at))
        `)
        .eq('user_id', user.id)
        .is('left_at', null)

      if (memberError) {
        setLoadError(memberError.message)
        return
      }

      const flat: GroupBalance[] = ((memberData as any[] | null) ?? []).flatMap((m: any) => {
        const g = m.groups
        if (!g) return []
        return [{
          id: g.id,
          name: g.name,
          currency: g.currency || 'INR',
          penalty_amount: g.penalty_amount ?? 0,
          // The embed also returns members who have left.
          member_count: (g.group_members ?? []).filter((member: any) => !member.left_at).length,
        }]
      })
      setGroups(flat)

      const [checkinResult, missedResult] = await Promise.all([
        supabase
          .from('habit_checkins' as any)
          .select(`
            id,
            created_at,
            status,
            occurrence:habit_occurrences (
              schedule:habit_schedules (
                habit:habits (
                  name,
                  group:groups (name, currency, penalty_amount)
                )
              )
            )
          `)
          .eq('profile_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('habit_checkins' as any)
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', user.id)
          .eq('status', 'missed'),
      ])

      if (checkinResult.error) {
        setLoadError(checkinResult.error.message)
        return
      }

      const txs: LedgerTransaction[] = ((checkinResult.data as any[] | null) ?? []).map(c => {
        const h = c.occurrence?.schedule?.habit
        const g = h?.group
        const isMissed = c.status === 'missed'
        const label = h?.name || 'Habit'

        return {
          id: c.id,
          created_at: c.created_at,
          group_name: g?.name || 'Circle',
          habit_name: label,
          type: isMissed ? 'penalty' : 'checkin',
          amount: g?.penalty_amount ?? 0,
          currency: g?.currency || 'INR',
          // A submitted check-in is not "verified" (nobody has reviewed it yet).
          description: isMissed
            ? `Missed: "${label}"`
            : isCompletedCheckin(c.status)
              ? `Checked in: "${label}"`
              : `${String(c.status).charAt(0).toUpperCase()}${String(c.status).slice(1)}: "${label}"`,
        }
      })
      setTransactions(txs)
      setMissedCount(missedResult.count ?? 0)
      setLoadError(null)
    } catch {
      setLoadError('Failed to load the ledger')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Skeleton className="h-7 w-36 sm:h-8 sm:w-48" />
        <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 sm:h-28 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Financial Ledger</h1>
        <Card className="border-destructive/50">
          <CardContent className="py-6 sm:py-8 text-center px-4">
            <p className="text-destructive mb-4 text-sm" role="alert">{loadError}</p>
            <Button size="sm" onClick={() => { setLoadError(null); setLoading(true); loadLedger() }}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const exposure = totalByCurrency(groups)
  const inGoodStanding = missedCount === 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Financial Ledger</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Virtual accountability ledger tracking commitments, penalties, and peer settlements.
        </p>
      </div>

      {/* Trust & Non-Custodial Notice Banner */}
      <div className="flex items-start gap-2.5 p-3 sm:p-4 rounded-lg bg-primary/10 border border-primary/20 text-xs sm:text-sm">
        <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-[11px] sm:text-xs leading-relaxed">
          <span className="font-semibold text-foreground">Zero-Custody Guarantee: </span>
          <span className="text-muted-foreground">
            {APP_NAME} operates strictly as an immutable virtual ledger. We never hold funds or process bank payments. Circle members settle peer-to-peer directly (UPI, Cash, etc.).
          </span>
        </div>
      </div>

      {/* Financial Metrics Overview */}
      <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Circles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold tracking-tight">{groups.length}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">accountability pools</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Stakes</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            {exposure.length === 0 ? (
              <div className="text-lg sm:text-2xl font-bold tracking-tight">—</div>
            ) : (
              // One line per currency: amounts in different currencies are never added together.
              exposure.map(({ currency, amount }) => (
                <div key={currency} className="text-lg sm:text-2xl font-bold tracking-tight truncate">
                  {formatMoneySafe(amount, currency)}
                </div>
              ))
            )}
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">per missed habit, all circles</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ledger Standing</CardTitle>
            <ShieldCheck className={`h-4 w-4 ${inGoodStanding ? 'text-green-800 dark:text-green-400' : 'text-amber-800 dark:text-amber-400'}`} />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className={`text-lg sm:text-2xl font-bold tracking-tight ${inGoodStanding ? 'text-green-800 dark:text-green-400' : 'text-amber-800 dark:text-amber-400'}`}>
              {inGoodStanding ? 'Good Standing' : `${missedCount} missed`}
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              {inGoodStanding ? 'no missed commitments' : `missed ${missedCount === 1 ? 'check-in' : 'check-ins'} on record`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Group Penalty Rules */}
      <Card>
        <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base">Circle Stakes & Split Rules</CardTitle>
          <CardDescription className="text-xs">
            When a member misses a habit, the penalty is split equally among fellow circle members.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 pt-0">
          {!groups.length ? (
            <p className="text-xs sm:text-sm text-muted-foreground py-4 text-center">
              No active circles. Join or create a circle to start tracking habit stakes.
            </p>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden">
              {groups.map(group => {
                const peers = Math.max(0, group.member_count - 1)
                // Display-only estimate; the real split assigns any remainder
                // minor units deterministically when a penalty is created.
                const perPeerShare = peers > 0 ? Math.floor(group.penalty_amount / peers) : null

                return (
                  <div key={group.id} className="flex items-center justify-between p-3 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs sm:text-sm truncate">{group.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {group.member_count} {group.member_count === 1 ? 'member' : 'members'} • Equal split
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 text-right">
                      <div>
                        <p className="text-xs font-semibold">
                          {formatMoneySafe(group.penalty_amount, group.currency)} miss
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {perPeerShare === null
                            ? 'no peers yet'
                            : `≈ ${formatMoneySafe(perPeerShare, group.currency)}/peer`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0.5 px-1.5">
                        {group.currency || '—'}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction & Activity Log */}
      <Card>
        <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center justify-between">
            <span>Recent Activity</span>
            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 pt-0">
          {!transactions.length ? (
            <div className="py-6 sm:py-8 text-center text-muted-foreground px-4">
              <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-xs sm:text-sm font-medium">No ledger entries yet</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Keep checking in on your habits to stay in good standing!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border text-xs sm:text-sm gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'penalty' ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-800 dark:text-green-400'
                    }`}>
                      {tx.type === 'penalty'
                        ? <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                        : <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs sm:text-sm truncate">{tx.description}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {tx.group_name} • {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <Badge variant={tx.type === 'penalty' ? 'destructive' : 'success'} className="text-[10px] sm:text-xs">
                      {tx.type === 'penalty' ? `-${formatMoneySafe(tx.amount, tx.currency)}` : 'Checked in'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
