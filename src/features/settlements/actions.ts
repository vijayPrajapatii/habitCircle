'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { allocatePenalty, createPenaltySnapshot } from '@/domain/penalties'

export interface PeerSettlementBalance {
  peerId: string
  peerName: string
  groupId: string
  groupName: string
  currency: string
  amount: number // in minor units
  reason?: string
  lastActivityDate?: string
}

export interface SettlementPaymentRecord {
  id: string
  groupId: string
  groupName: string
  senderId: string
  senderName: string
  receiverId: string
  receiverName: string
  amount: number
  currency: string
  status: 'confirmed' | 'pending' | 'rejected'
  method: string
  notes?: string
  createdAt: string
}

export interface SettlementsOverview {
  debts: PeerSettlementBalance[]
  credits: PeerSettlementBalance[]
  totalOwed: number // User owes peers
  totalReceivable: number // Peers owe user
  netBalance: number
  recentSettlements: SettlementPaymentRecord[]
}

const recordSettlementSchema = z.object({
  receiver_id: z.string().uuid('Invalid receiver ID'),
  group_id: z.string().uuid('Invalid group ID'),
  amount: z.number().int().positive('Amount must be positive'),
  payment_method: z.string().min(1, 'Payment method required'),
  notes: z.string().max(250).optional().default(''),
})

/**
 * Record a habit check-in failure / miss.
 * Incurs circle stake and divides it equally among active peers.
 */
export async function recordHabitFailure(
  habitId: string,
  notes?: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // 1. Try atomic RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('record_habit_miss', {
      p_habit_id: habitId,
      p_notes: notes || null,
    })

    if (!rpcError && rpcData?.success) {
      return { success: true, error: null }
    }
  } catch {
    // Fall back to direct query implementation
  }

  // 2. Direct fallback implementation
  try {
    const { data: habit, error: habitError } = await supabase
      .from('habits' as any)
      .select('id, group_id, name, timezone, habit_schedules(id), groups(id, penalty_amount, currency)')
      .eq('id', habitId)
      .single()

    if (habitError || !habit) {
      return { success: false, error: 'Habit not found' }
    }

    const group = (habit as any).groups
    const scheduleId = (habit as any).habit_schedules?.[0]?.id

    if (!group || !scheduleId) {
      return { success: false, error: 'Habit configuration incomplete' }
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', habit.group_id)
      .eq('user_id', user.id)
      .is('left_at', null)
      .single()

    if (!membership) {
      return { success: false, error: 'Not authorized for this circle' }
    }

    // Occurrence
    const periodStart = new Date()
    periodStart.setUTCHours(0, 0, 0, 0)
    const periodEnd = new Date(periodStart)
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 1)

    let { data: occurrence } = await supabase
      .from('habit_occurrences' as any)
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('period_start', periodStart.toISOString())
      .maybeSingle()

    if (!occurrence) {
      const created = await supabase
        .from('habit_occurrences' as any)
        .insert({
          schedule_id: scheduleId,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          status: 'pending',
        })
        .select('id')
        .single()

      occurrence = created.data
    }

    if (!occurrence) {
      return { success: false, error: 'Failed to create occurrence' }
    }

    // Insert or update checkin
    let checkinId: string | null = null
    const { data: existingCheckin } = await supabase
      .from('habit_checkins' as any)
      .select('id')
      .eq('occurrence_id', occurrence.id)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (existingCheckin) {
      await supabase
        .from('habit_checkins' as any)
        .update({ status: 'missed' })
        .eq('id', existingCheckin.id)
      checkinId = existingCheckin.id
    } else {
      const created = await supabase
        .from('habit_checkins' as any)
        .insert({
          occurrence_id: occurrence.id,
          profile_id: user.id,
          quantity: 0,
          status: 'missed',
        })
        .select('id')
        .single()
      checkinId = created.data?.id || null
    }

    if (!checkinId) {
      return { success: false, error: 'Failed to record missed checkin' }
    }

    // Eligible peers
    const { data: peers } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', habit.group_id)
      .neq('user_id', user.id)
      .is('left_at', null)

    const peerIds = (peers || []).map((p: any) => p.user_id)
    const penaltySnapshot = createPenaltySnapshot({
      penaltyAmount: group.penalty_amount,
      target: 1,
      actual: 0,
      eligibleMembers: peerIds,
      currency: group.currency,
    })

    // Insert penalty
    const { data: penalty, error: penaltyError } = await supabase
      .from('penalties' as any)
      .insert({
        occurrence_id: checkinId,
        offender_id: user.id,
        amount: group.penalty_amount,
        status: 'active',
        snapshot: penaltySnapshot,
      })
      .select('id')
      .single()

    if (penalty && peerIds.length > 0) {
      const allocations = allocatePenalty(group.penalty_amount, peerIds)
      const rows = allocations.map(a => ({
        penalty_id: penalty.id,
        receiver_id: a.receiverId,
        share: a.share,
      }))

      await supabase.from('penalty_allocations' as any).insert(rows)
    }

    // Ledger debit entry
    await supabase.from('ledger_entries' as any).insert({
      group_id: habit.group_id,
      type: 'debit',
      amount: group.penalty_amount,
      related_penalty_id: penalty?.id || null,
      metadata: {
        offender_id: user.id,
        habit_name: habit.name,
        reason: notes || 'Missed habit check-in',
      },
    })

    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to record failure' }
  }
}

/**
 * Fetch balances and peer liabilities across all groups (or a specific group).
 */
export async function getCircleSettlements(
  groupId?: string
): Promise<{ overview: SettlementsOverview | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { overview: null, error: 'Not authenticated' }
  }

  try {
    // 1. Get user groups
    let groupsQuery = supabase
      .from('group_members' as any)
      .select('group_id, groups(id, name, currency, penalty_amount)')
      .eq('user_id', user.id)
      .is('left_at', null)

    if (groupId) {
      groupsQuery = groupsQuery.eq('group_id', groupId)
    }

    const { data: memberships } = await groupsQuery
    const groupList: any[] = (memberships || []).map((m: any) => m.groups).filter(Boolean)
    const groupIds = groupList.map(g => g.id)

    if (groupIds.length === 0) {
      return {
        overview: {
          debts: [],
          credits: [],
          totalOwed: 0,
          totalReceivable: 0,
          netBalance: 0,
          recentSettlements: [],
        },
        error: null,
      }
    }

    const groupMap = new Map<string, { id: string; name: string; currency: string }>(
      groupList.map(g => [g.id, { id: g.id, name: g.name, currency: g.currency || 'INR' }])
    )

    // 2. Fetch active penalties where user is offender (debts: user owes peers)
    const { data: myPenalties } = await supabase
      .from('penalties' as any)
      .select(`
        id,
        offender_id,
        amount,
        status,
        created_at,
        snapshot,
        allocations:penalty_allocations (
          receiver_id,
          share
        )
      `)
      .eq('offender_id', user.id)
      .eq('status', 'active')

    // 3. Fetch active penalties where peers owe user (credits: user is receiver)
    const { data: receivedAllocations } = await supabase
      .from('penalty_allocations' as any)
      .select(`
        penalty_id,
        receiver_id,
        share,
        penalty:penalties (
          id,
          offender_id,
          amount,
          status,
          created_at,
          snapshot
        )
      `)
      .eq('receiver_id', user.id)

    // 4. Fetch confirmed payments involving user
    const { data: payments } = await supabase
      .from('payments' as any)
      .select('id, sender_id, receiver_id, group_id, amount, status, evidence_path, created_at')
      .in('group_id', groupIds)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    // Collect all profile IDs needed
    const profileIds = new Set<string>()
    for (const p of myPenalties || []) {
      for (const a of (p as any).allocations || []) {
        profileIds.add(a.receiver_id)
      }
    }
    for (const ra of receivedAllocations || []) {
      const offenderId = (ra as any).penalty?.offender_id
      if (offenderId) profileIds.add(offenderId)
    }
    for (const p of payments || []) {
      profileIds.add(p.sender_id)
      profileIds.add(p.receiver_id)
    }
    profileIds.delete(user.id)

    // Fetch usernames
    const profileIdArray = Array.from(profileIds)
    const { data: profiles } = profileIdArray.length
      ? await supabase.from('profiles').select('id, username').in('id', profileIdArray)
      : { data: [] }
    const usernameMap = new Map((profiles || []).map((p: any) => [p.id, p.username || 'Member']))

    // Calculate Net Balances per (peerId, groupId)
    // Positive balance = User owes Peer. Negative balance = Peer owes User.
    const pairMap = new Map<string, {
      peerId: string
      groupId: string
      amountOwedByMe: number
      amountOwedToMe: number
      lastDate?: string
      habitName?: string
    }>()

    const getPairKey = (peerId: string, grpId: string) => `${peerId}:${grpId}`

    // Add debts from my penalties
    for (const p of myPenalties || []) {
      const gId = (p as any).snapshot?.group_id || groupIds[0]
      const habitName = (p as any).snapshot?.habit_name || 'Missed habit'
      for (const a of (p as any).allocations || []) {
        const key = getPairKey(a.receiver_id, gId)
        const cur = pairMap.get(key) || {
          peerId: a.receiver_id,
          groupId: gId,
          amountOwedByMe: 0,
          amountOwedToMe: 0,
          lastDate: undefined,
          habitName: undefined,
        }
        cur.amountOwedByMe += a.share
        cur.habitName = habitName
        cur.lastDate = p.created_at
        pairMap.set(key, cur)
      }
    }

    // Add credits from peers' penalties
    for (const ra of receivedAllocations || []) {
      const pen = (ra as any).penalty
      if (!pen || pen.status !== 'active') continue
      const gId = pen.snapshot?.group_id || groupIds[0]
      const habitName = pen.snapshot?.habit_name || 'Missed habit'
      const key = getPairKey(pen.offender_id, gId)
      const cur = pairMap.get(key) || {
        peerId: pen.offender_id,
        groupId: gId,
        amountOwedByMe: 0,
        amountOwedToMe: 0,
        lastDate: undefined,
        habitName: undefined,
      }
      cur.amountOwedToMe += ra.share
      cur.habitName = habitName
      cur.lastDate = pen.created_at
      pairMap.set(key, cur)
    }

    // Deduct payments
    for (const p of payments || []) {
      if (p.status !== 'confirmed') continue
      if (p.sender_id === user.id) {
        // I paid peer
        const key = getPairKey(p.receiver_id, p.group_id)
        const cur = pairMap.get(key)
        if (cur) {
          cur.amountOwedByMe = Math.max(0, cur.amountOwedByMe - p.amount)
        }
      } else if (p.receiver_id === user.id) {
        // Peer paid me
        const key = getPairKey(p.sender_id, p.group_id)
        const cur = pairMap.get(key)
        if (cur) {
          cur.amountOwedToMe = Math.max(0, cur.amountOwedToMe - p.amount)
        }
      }
    }

    const debts: PeerSettlementBalance[] = []
    const credits: PeerSettlementBalance[] = []
    let totalOwed = 0
    let totalReceivable = 0

    for (const [, pair] of pairMap) {
      const net = pair.amountOwedByMe - pair.amountOwedToMe
      const grp = groupMap.get(pair.groupId) || { id: pair.groupId, name: 'Circle', currency: 'INR' }
      const peerName = usernameMap.get(pair.peerId) || 'Circle Member'

      if (net > 0) {
        debts.push({
          peerId: pair.peerId,
          peerName,
          groupId: pair.groupId,
          groupName: grp.name,
          currency: grp.currency,
          amount: net,
          reason: pair.habitName,
          lastActivityDate: pair.lastDate,
        })
        totalOwed += net
      } else if (net < 0) {
        credits.push({
          peerId: pair.peerId,
          peerName,
          groupId: pair.groupId,
          groupName: grp.name,
          currency: grp.currency,
          amount: Math.abs(net),
          reason: pair.habitName,
          lastActivityDate: pair.lastDate,
        })
        totalReceivable += Math.abs(net)
      }
    }

    // Format recent settlements
    const recentSettlements: SettlementPaymentRecord[] = (payments || []).map(p => {
      let parsedEvidence: any = {}
      try {
        if (p.evidence_path) parsedEvidence = JSON.parse(p.evidence_path)
      } catch {
        // Ignore JSON parse error
      }

      const grp = groupMap.get(p.group_id)
      return {
        id: p.id,
        groupId: p.group_id,
        groupName: grp?.name || 'Circle',
        currency: grp?.currency || 'INR',
        senderId: p.sender_id,
        senderName: p.sender_id === user.id ? 'You' : usernameMap.get(p.sender_id) || 'Peer',
        receiverId: p.receiver_id,
        receiverName: p.receiver_id === user.id ? 'You' : usernameMap.get(p.receiver_id) || 'Peer',
        amount: p.amount,
        status: p.status,
        method: parsedEvidence.method || 'Direct Settlement',
        notes: parsedEvidence.notes || '',
        createdAt: p.created_at,
      }
    })

    return {
      overview: {
        debts,
        credits,
        totalOwed,
        totalReceivable,
        netBalance: totalReceivable - totalOwed,
        recentSettlements,
      },
      error: null,
    }
  } catch (err: any) {
    return { overview: null, error: err.message || 'Failed to load settlements' }
  }
}

/**
 * Record a peer-to-peer settlement payment.
 */
export async function recordSettlement(
  formData: FormData
): Promise<{ success: boolean; payment?: any; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const rawAmount = formData.get('amount')
  const amountInt = typeof rawAmount === 'number' ? rawAmount : parseInt(rawAmount as string, 10)

  const result = recordSettlementSchema.safeParse({
    receiver_id: formData.get('receiver_id'),
    group_id: formData.get('group_id'),
    amount: amountInt,
    payment_method: formData.get('payment_method') || 'UPI',
    notes: formData.get('notes') || '',
  })

  if (!result.success) {
    return { success: false, error: result.error.errors[0].message }
  }

  const { receiver_id, group_id, amount, payment_method, notes } = result.data

  // 1. Try atomic RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('record_peer_settlement', {
      p_receiver_id: receiver_id,
      p_group_id: group_id,
      p_amount: amount,
      p_method: payment_method,
      p_notes: notes || null,
    })

    if (!rpcError && rpcData?.success) {
      return { success: true, payment: rpcData }
    }
  } catch {
    // Continue to fallback
  }

  // 2. Direct query fallback
  try {
    const evidence = JSON.stringify({
      method: payment_method,
      notes: notes || '',
      settled_at: new Date().toISOString(),
    })

    const { data: payment, error: paymentError } = await supabase
      .from('payments' as any)
      .insert({
        sender_id: user.id,
        receiver_id,
        group_id,
        amount,
        status: 'confirmed',
        evidence_path: evidence,
      })
      .select()
      .single()

    if (paymentError) {
      return { success: false, error: paymentError.message }
    }

    // Ledger adjustment
    await supabase.from('ledger_entries' as any).insert({
      group_id,
      type: 'adjust',
      amount,
      related_payment_id: payment.id,
      metadata: {
        settlement: true,
        sender_id: user.id,
        receiver_id,
        method: payment_method,
        notes,
      },
    })

    // Mark active penalties as paid
    const { data: myPenalties } = await supabase
      .from('penalties' as any)
      .select('id, allocations:penalty_allocations(receiver_id)')
      .eq('offender_id', user.id)
      .eq('status', 'active')

    const penaltyIdsToClose = (myPenalties || [])
      .filter((p: any) => (p.allocations || []).some((a: any) => a.receiver_id === receiver_id))
      .map((p: any) => p.id)

    if (penaltyIdsToClose.length > 0) {
      await supabase
        .from('penalties' as any)
        .update({ status: 'paid' })
        .in('id', penaltyIdsToClose)
    }

    return { success: true, payment }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to record settlement' }
  }
}
