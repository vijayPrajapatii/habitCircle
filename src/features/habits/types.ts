export interface Habit {
  id: string
  group_id: string
  name: string
  timezone: string
  created_at: string
  group: {
    id: string
    name: string
    penalty_amount: number
    currency: string
  }
  schedule: {
    id: string
    frequency: string
    target_quantity: number
    custom_cron: string | null
  }
  occurrences: {
    id: string
    period_start: string
    period_end: string
    status: string
  }[]
}

export interface CreateHabitData {
  group_id: string
  name: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'quantity' | 'custom'
  target_quantity?: number
  timezone?: string
}