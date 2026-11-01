'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createHabit, type Habit } from '@/features/habits/actions'
import { toast } from '@/hooks/use-toast'
import { CURRENCY_SYMBOLS, formatMoney } from '@/domain/money'
import {
  Clock,
  Calendar as CalendarIcon,
  Bell,
  Sun,
  Sunset,
  Moon,
  Zap,
  Loader2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

export interface CircleOption {
  id: string
  name: string
  penalty_amount: number
  currency: string
}

interface HabitCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: CircleOption[]
  defaultGroupId?: string
  onSuccess?: (newHabit: Habit) => void
}

type FrequencyType = 'daily' | 'weekly' | 'monthly'
type TimeWindow = 'anytime' | 'morning' | 'afternoon' | 'evening'

interface DayOption {
  key: string
  label: string
  shortLabel: string
}

const DAYS_OF_WEEK: DayOption[] = [
  { key: 'mon', label: 'Monday', shortLabel: 'M' },
  { key: 'tue', label: 'Tuesday', shortLabel: 'T' },
  { key: 'wed', label: 'Wednesday', shortLabel: 'W' },
  { key: 'thu', label: 'Thursday', shortLabel: 'T' },
  { key: 'fri', label: 'Friday', shortLabel: 'F' },
  { key: 'sat', label: 'Saturday', shortLabel: 'S' },
  { key: 'sun', label: 'Sunday', shortLabel: 'S' },
]

export function HabitCreationDialog({
  open,
  onOpenChange,
  groups,
  defaultGroupId,
  onSuccess,
}: HabitCreationDialogProps) {
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState(defaultGroupId || groups[0]?.id || '')
  const [frequency, setFrequency] = useState<FrequencyType>('daily')
  const [selectedDays, setSelectedDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  const [weeklyTarget, setWeeklyTarget] = useState(3)
  const [monthlyDay, setMonthlyDay] = useState(1)
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('morning')
  const [targetTime, setTargetTime] = useState('09:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedGroup = groups.find(g => g.id === (groupId || defaultGroupId)) || groups[0]

  // Day toggle like mobile alarm
  const toggleDay = (key: string) => {
    setSelectedDays(current => {
      if (current.includes(key)) {
        if (current.length === 1) return current // keep at least 1 day
        return current.filter(d => d !== key)
      } else {
        return [...current, key]
      }
    })
  }

  // Alarm presets
  const applyPreset = (preset: 'all' | 'weekdays' | 'weekends') => {
    if (preset === 'all') {
      setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
    } else if (preset === 'weekdays') {
      setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri'])
    } else if (preset === 'weekends') {
      setSelectedDays(['sat', 'sun'])
    }
  }

  // Friendly human text summary
  const getScheduleSummary = (): string => {
    let freqText = ''
    if (frequency === 'daily') {
      if (selectedDays.length === 7) freqText = 'Every day'
      else if (selectedDays.length === 5 && !selectedDays.includes('sat') && !selectedDays.includes('sun')) {
        freqText = 'Every weekday (Mon - Fri)'
      } else if (selectedDays.length === 2 && selectedDays.includes('sat') && selectedDays.includes('sun')) {
        freqText = 'Every weekend (Sat & Sun)'
      } else {
        freqText = selectedDays
          .map(d => DAYS_OF_WEEK.find(item => item.key === d)?.shortLabel)
          .join(', ')
      }
    } else if (frequency === 'weekly') {
      freqText = `${weeklyTarget} times per week`
    } else {
      freqText = `Monthly (on day ${monthlyDay})`
    }

    const windowText =
      timeWindow === 'morning' ? 'Morning' :
      timeWindow === 'afternoon' ? 'Afternoon' :
      timeWindow === 'evening' ? 'Evening' : 'Anytime'

    return `${freqText} • ${windowText} by ${targetTime}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a habit title')
      return
    }

    const activeGroupId = groupId || defaultGroupId || groups[0]?.id
    if (!activeGroupId) {
      setError('Please select an accountability circle')
      return
    }

    setSubmitting(true)
    setError(null)

    // Build custom cron / JSON metadata
    const schedulePayload = {
      frequency,
      days: selectedDays,
      timeWindow,
      targetTime,
      weeklyTarget,
      monthlyDay,
      summary: getScheduleSummary(),
    }

    const targetQuantity = frequency === 'weekly' ? weeklyTarget : 1

    const formData = new FormData()
    formData.append('group_id', activeGroupId)
    formData.append('name', name.trim())
    formData.append('frequency', frequency)
    formData.append('target_quantity', targetQuantity.toString())
    formData.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone)
    formData.append('custom_cron', JSON.stringify(schedulePayload))

    const res = await createHabit(formData)

    if (res.error || !res.habit) {
      setError(res.error || 'Failed to create habit')
      setSubmitting(false)
      return
    }

    toast({
      title: 'Habit commitment created!',
      description: `"${name.trim()}" is now active in ${selectedGroup?.name || 'your circle'}.`,
    })

    if (onSuccess) {
      onSuccess(res.habit)
    }

    // Reset
    setName('')
    setSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.25rem)] max-w-lg p-4 sm:p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg">Create New Habit</DialogTitle>
              <DialogDescription className="text-xs">
                Set recurring schedule, alarm window, and social accountability stakes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-md" role="alert">
              {error}
            </p>
          )}

          {/* Habit Name */}
          <div className="space-y-1.5">
            <Label htmlFor="habit-title" className="text-xs font-semibold">
              Habit Name *
            </Label>
            <Input
              id="habit-title"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 30min Morning Gym, Read 20 Pages, Code for 1 hour"
              required
              maxLength={100}
              className="h-10 text-sm"
              autoFocus
            />
          </div>

          {/* Circle Selector (if multiple groups available) */}
          {(!defaultGroupId || groups.length > 1) && (
            <div className="space-y-1.5">
              <Label htmlFor="circle-select" className="text-xs font-semibold">
                Accountability Circle *
              </Label>
              <select
                id="circle-select"
                value={groupId || defaultGroupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({CURRENCY_SYMBOLS[g.currency] || g.currency}{(g.penalty_amount / 100).toFixed(0)} stake)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Stake & Rule Alert Banner */}
          {selectedGroup && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-semibold">Circle Stake: </span>
                {formatMoney(selectedGroup.penalty_amount, selectedGroup.currency)} per missed habit.
                Missed commitments are divided equally among fellow circle members.
              </div>
            </div>
          )}

          {/* Frequency Type Tabs (Alarm / Google Calendar Style) */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              Frequency & Recurrence
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFrequency('daily')}
                className={`py-2 px-3 text-xs rounded-md border font-medium transition-all ${
                  frequency === 'daily'
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-muted/50 border-input'
                }`}
              >
                ⏰ Daily / Days
              </button>
              <button
                type="button"
                onClick={() => setFrequency('weekly')}
                className={`py-2 px-3 text-xs rounded-md border font-medium transition-all ${
                  frequency === 'weekly'
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-muted/50 border-input'
                }`}
              >
                📅 Weekly
              </button>
              <button
                type="button"
                onClick={() => setFrequency('monthly')}
                className={`py-2 px-3 text-xs rounded-md border font-medium transition-all ${
                  frequency === 'monthly'
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-muted/50 border-input'
                }`}
              >
                📆 Monthly
              </button>
            </div>
          </div>

          {/* Sub-options for DAILY (Mobile Alarm Day Chips) */}
          {frequency === 'daily' && (
            <div className="space-y-2.5 p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Select repeat days:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyPreset('all')}
                    className="text-[10px] text-primary hover:underline px-1 py-0.5"
                  >
                    All
                  </button>
                  <span className="text-muted-foreground text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={() => applyPreset('weekdays')}
                    className="text-[10px] text-primary hover:underline px-1 py-0.5"
                  >
                    Weekdays
                  </button>
                  <span className="text-muted-foreground text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={() => applyPreset('weekends')}
                    className="text-[10px] text-primary hover:underline px-1 py-0.5"
                  >
                    Weekends
                  </button>
                </div>
              </div>

              {/* Alarm Day Chips */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {DAYS_OF_WEEK.map(d => {
                  const active = selectedDays.includes(d.key)
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      title={d.label}
                      className={`h-9 w-full rounded-full flex flex-col items-center justify-center text-xs font-semibold transition-all ${
                        active
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary/40 shadow-sm'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {d.shortLabel}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sub-options for WEEKLY */}
          {frequency === 'weekly' && (
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Target completions per week:
              </Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6].map(count => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setWeeklyTarget(count)}
                    className={`flex-1 py-2 rounded-md border text-xs font-semibold transition-all ${
                      weeklyTarget === count
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {count}x
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Complete at least {weeklyTarget} time{weeklyTarget > 1 ? 's' : ''} during Monday to Sunday.
              </p>
            </div>
          )}

          {/* Sub-options for MONTHLY */}
          {frequency === 'monthly' && (
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2.5">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Day of the month to complete:
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMonthlyDay(1)}
                  className={`py-1.5 px-2 rounded-md border text-xs font-medium ${
                    monthlyDay === 1 ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'
                  }`}
                >
                  1st of Month
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyDay(15)}
                  className={`py-1.5 px-2 rounded-md border text-xs font-medium ${
                    monthlyDay === 15 ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'
                  }`}
                >
                  15th of Month
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyDay(28)}
                  className={`py-1.5 px-2 rounded-md border text-xs font-medium ${
                    monthlyDay === 28 ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'
                  }`}
                >
                  End of Month
                </button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Custom day:</span>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={monthlyDay}
                  onChange={(e) => setMonthlyDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-20 h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* Time of Day & Alarm Window (Google Calendar / Alarm Style) */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Target Window & Deadline
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => { setTimeWindow('morning'); setTargetTime('09:00') }}
                className={`p-2 rounded-lg border text-left transition-all ${
                  timeWindow === 'morning' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/40'
                }`}
              >
                <Sun className="h-4 w-4 mb-1 text-amber-500" />
                <p className="text-xs font-medium">Morning</p>
                <p className="text-[10px] text-muted-foreground">by 09:00 AM</p>
              </button>

              <button
                type="button"
                onClick={() => { setTimeWindow('afternoon'); setTargetTime('14:00') }}
                className={`p-2 rounded-lg border text-left transition-all ${
                  timeWindow === 'afternoon' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/40'
                }`}
              >
                <Zap className="h-4 w-4 mb-1 text-orange-500" />
                <p className="text-xs font-medium">Afternoon</p>
                <p className="text-[10px] text-muted-foreground">by 02:00 PM</p>
              </button>

              <button
                type="button"
                onClick={() => { setTimeWindow('evening'); setTargetTime('21:00') }}
                className={`p-2 rounded-lg border text-left transition-all ${
                  timeWindow === 'evening' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/40'
                }`}
              >
                <Moon className="h-4 w-4 mb-1 text-indigo-500" />
                <p className="text-xs font-medium">Evening</p>
                <p className="text-[10px] text-muted-foreground">by 09:00 PM</p>
              </button>

              <button
                type="button"
                onClick={() => { setTimeWindow('anytime'); setTargetTime('23:59') }}
                className={`p-2 rounded-lg border text-left transition-all ${
                  timeWindow === 'anytime' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/40'
                }`}
              >
                <Clock className="h-4 w-4 mb-1 text-emerald-500" />
                <p className="text-xs font-medium">Anytime</p>
                <p className="text-[10px] text-muted-foreground">by Midnight</p>
              </button>
            </div>

            {/* Custom deadline time input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Specific deadline time:</span>
              <Input
                type="time"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                className="w-32 h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Live Recurrence Preview Banner */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Bell className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="truncate">
                <p className="font-semibold text-foreground truncate">{getScheduleSummary()}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {selectedGroup?.name} • {formatMoney(selectedGroup?.penalty_amount || 1000, selectedGroup?.currency || 'INR')} stake/miss
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] flex-shrink-0 ml-2">
              {frequency.toUpperCase()}
            </Badge>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-10 text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !name.trim()}
              className="w-full sm:w-auto h-10 text-xs sm:text-sm"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Commit to Habit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
