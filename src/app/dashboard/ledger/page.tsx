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

        const exposure = flat.reduce((sum, g) => sum + g.penalty_amount, 0)
        setTotalExposure(exposure)

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
              group_name: g?.name || 'Circle',
              habit_name: h?.name || 'Habit',
              type: isMissed ? 'penalty' : 'credit',
              amount: g?.penalty_amount || 1000,
              currency: g?.currency || 'INR',
              description: isMissed
                ? `Missed: "${h?.name || 'Habit'}"`
                : `Verified: "${h?.name || 'Habit'}"`,
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
      <div className="space-y-4 sm:space-y-6">
        <Skeleton className="h-7 w-36 sm:h-8 sm:w-48" />
        <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 sm:h-28 rounded-lg" />)}
        </div>
      </div>
    )
  }

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
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">accountability pools</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Stakes</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold tracking-tight truncate">
              {formatMoney(totalExposure, groups[0]?.currency || 'INR')}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">total commitment</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ledger Standing</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold text-green-500 tracking-tight">Good Standing</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">all commitments clean</p>
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
                const currencySymbol = CURRENCY_SYMBOLS[group.currency] || group.currency
                const perMemberShare = group.member_count > 1
                  ? Math.floor(group.penalty_amount / (group.member_count - 1))
                  : group.penalty_amount

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
                          {currencySymbol}{(group.penalty_amount / 100).toFixed(0)} miss
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {currencySymbol}{(perMemberShare / 100).toFixed(0)}/peer
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0.5 px-1.5">
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
        <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center justify-between">
            <span>Recent Ledger Activity</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
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
                      tx.type === 'penalty' ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'
                    }`}>
                      {tx.type === 'penalty' ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs sm:text-sm truncate">{tx.description}</p>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                        {tx.group_name} • {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <Badge variant={tx.type === 'penalty' ? 'destructive' : 'success'} className="text-[10px] sm:text-xs">
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
