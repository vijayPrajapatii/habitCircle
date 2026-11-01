'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet, ArrowDownRight, ArrowUpRight, ShieldCheck, Info, Users, Clock } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CURRENCY_SYMBOLS, formatMoney } from '@/domain/money'
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
  type: 'penalty' | 'credit' | 'payout'
  amount: number
  currency: string
  description: string
  status: 'settled' | 'pending'
}

export default function LedgerPage() {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<GroupBalance[]>([])
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([])
  const [totalExposure, setTotalExposure] = useState<number>(0)

  const loadLedger = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      // Fetch user's groups with their penalty rates
      const { data: memberData } = await supabase
        .from('group_members' as any)
        .select(`
          groups (id, name, currency, penalty_amount, group_members(id))
        `)
        .eq('user_id', user.id)
        .is('left_at', null)

      if (memberData) {
        const flat: GroupBalance[] = (memberData as any[]).flatMap((m: any) => {
          const g = m.groups
          if (!g) return []
          return [{
            id: g.id,
            name: g.name,
            currency: g.currency || 'INR',
            penalty_amount: g.penalty_amount || 1000,
            member_count: g.group_members?.length || 1,
          }]
        })
        setGroups(flat)

        // Calculate potential total exposure (sum of penalty amounts)
        const exposure = flat.reduce((sum, g) => sum + g.penalty_amount, 0)
        setTotalExposure(exposure)

        // Check for penalties or check-ins to build transaction history
        const { data: checkinData } = await supabase
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
          .limit(10)

        if (checkinData && checkinData.length > 0) {
          const txs: LedgerTransaction[] = (checkinData as any[]).map(c => {
            const h = c.occurrence?.schedule?.habit
            const g = h?.group
            const isMissed = c.status === 'missed'

            return {
              id: c.id,
              created_at: c.created_at,
              group_name: g?.name || 'Habit Group',
              habit_name: h?.name || 'Habit',
              type: isMissed ? 'penalty' : 'credit',
              amount: g?.penalty_amount || 1000,
              currency: g?.currency || 'INR',
              description: isMissed
                ? `Missed check-in penalty for "${h?.name || 'Habit'}"`
                : `Verified check-in for "${h?.name || 'Habit'}"`,
              status: isMissed ? 'pending' : 'settled',
            }
          })
          setTransactions(txs)
        }
      }

      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Financial Ledger</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Virtual accountability ledger tracking commitments, penalties, and peer settlements.
        </p>
      </div>

      {/* Trust & Non-Custodial Notice Banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20 text-xs sm:text-sm">
        <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Zero-Custody Guarantee: </span>
          <span className="text-muted-foreground">
            {APP_NAME} operates strictly as an immutable virtual ledger. We never hold your funds or process bank payments. Group members settle peer-to-peer directly (UPI, cash, etc.) and confirm in-app.
          </span>
        </div>
      </div>

      {/* Financial Metrics Overview */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Active Groups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.length}</div>
            <p className="text-xs text-muted-foreground mt-1">accountability pools</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Active Stakes</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(totalExposure, groups[0]?.currency || 'INR')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">total commitment stake</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Ledger Status</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">In Good Standing</div>
            <p className="text-xs text-muted-foreground mt-1">all penalties settled</p>
          </CardContent>
        </Card>
      </div>

      {/* Group Penalty Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Group Stakes & Split Rules</CardTitle>
          <CardDescription>
            When a member misses a habit, the penalty is split equally among all other active members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!groups.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active groups. Join or create a group to start tracking habit stakes.
            </p>
          ) : (
            <div className="divide-y border rounded-lg">
              {groups.map(group => {
                const currencySymbol = CURRENCY_SYMBOLS[group.currency] || group.currency
                const perMemberShare = group.member_count > 1
                  ? Math.floor(group.penalty_amount / (group.member_count - 1))
                  : group.penalty_amount

                return (
                  <div key={group.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-2">
                    <div>
                      <p className="font-semibold text-sm">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.member_count} {group.member_count === 1 ? 'member' : 'members'} • Split equally on miss
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-semibold">
                          {currencySymbol}{(group.penalty_amount / 100).toFixed(0)} penalty
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {currencySymbol}{(perMemberShare / 100).toFixed(0)} / receiver
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {group.currency}
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
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Recent Ledger Activity</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!transactions.length ? (
            <div className="py-8 text-center text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-medium">No penalties or ledger entries yet</p>
              <p className="text-xs mt-1">Keep checking in on your habits to stay in good standing!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      tx.type === 'penalty' ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'
                    }`}>
                      {tx.type === 'penalty' ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-xs sm:text-sm">{tx.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {tx.group_name} • {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <Badge variant={tx.type === 'penalty' ? 'destructive' : 'success'}>
                      {tx.type === 'penalty' ? `-${formatMoney(tx.amount, tx.currency)}` : 'Completed'}
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
