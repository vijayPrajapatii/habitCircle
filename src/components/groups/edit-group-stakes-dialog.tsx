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
import { updateGroupSettings } from '@/features/groups/actions'
import { toast } from '@/hooks/use-toast'
import { CURRENCY_SYMBOLS, formatMoney } from '@/domain/money'
import { Settings2, Loader2, Coins, ShieldCheck, Users } from 'lucide-react'

interface EditGroupStakesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: {
    id: string
    name: string
    description?: string
    penalty_amount: number // in minor units
    currency: string
    max_members?: number
  }
  onSuccess: (updatedGroup: any) => void
}

const SUPPORTED_CURRENCIES = [
  { code: 'INR', label: 'INR (₹) - Indian Rupee' },
  { code: 'USD', label: 'USD ($) - US Dollar' },
  { code: 'EUR', label: 'EUR (€) - Euro' },
  { code: 'GBP', label: 'GBP (£) - British Pound' },
]

export function EditGroupStakesDialog({
  open,
  onOpenChange,
  group,
  onSuccess,
}: EditGroupStakesDialogProps) {
  // Guard against null/undefined group - use optional chaining for all properties
  if (!group) {
    return null
  }

  const [name, setName] = useState(group.name || '')
  const [description, setDescription] = useState(group.description || '')
  // Human readable major currency units (e.g. 500 for 50000 paise)
  const [penaltyMajor, setPenaltyMajor] = useState(
    (group.penalty_amount && group.penalty_amount > 0)
      ? (group.penalty_amount / 100).toFixed(0)
      : '100'
  )
  const [currency, setCurrency] = useState(group.currency || 'INR')
  const [maxMembers, setMaxMembers] = useState((group.max_members || 10).toString())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const symbol = CURRENCY_SYMBOLS[currency] || currency

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Circle name is required')
      return
    }

    const numPenalty = parseFloat(penaltyMajor)
    if (isNaN(numPenalty) || numPenalty <= 0) {
      setError('Penalty stake must be a positive number')
      return
    }

    const minorUnits = Math.round(numPenalty * 100)
    const membersInt = parseInt(maxMembers, 10)
    if (isNaN(membersInt) || membersInt < 2 || membersInt > 50) {
      setError('Maximum members must be between 2 and 50')
      return
    }

    setSubmitting(true)

    const formData = new FormData()
    formData.append('group_id', group.id)
    formData.append('name', name.trim())
    formData.append('description', description.trim())
    formData.append('penalty_amount', minorUnits.toString())
    formData.append('currency', currency)
    formData.append('max_members', membersInt.toString())

    const res = await updateGroupSettings(formData)

    if (res.error) {
      setError(res.error)
      setSubmitting(false)
      return
    }

    toast({
      title: 'Circle settings updated!',
      description: `Stakes set to ${symbol}${numPenalty} per miss.`,
    })

    setSubmitting(false)
    onOpenChange(false)
    if (onSuccess && res.group) {
      onSuccess(res.group)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.25rem)] max-w-md p-4 sm:p-6">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg">Edit Stakes & Circle Rules</DialogTitle>
              <DialogDescription className="text-xs">
                Modify penalty stakes, currency, and circle parameters.
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

          {/* Circle Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-group-name" className="text-xs font-semibold">
              Circle Name *
            </Label>
            <Input
              id="edit-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 5 AM Club"
              required
              maxLength={100}
              className="h-10 text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-group-desc" className="text-xs font-semibold">
              Description (Optional)
            </Label>
            <Input
              id="edit-group-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Circle goal or rules"
              maxLength={250}
              className="h-9 text-xs"
            />
          </div>

          {/* Penalty Stake & Currency Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-penalty-stake" className="text-xs font-semibold flex items-center gap-1">
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                Stake per Miss *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground text-sm">
                  {symbol}
                </span>
                <Input
                  id="edit-penalty-stake"
                  type="number"
                  min="1"
                  step="any"
                  value={penaltyMajor}
                  onChange={(e) => setPenaltyMajor(e.target.value)}
                  className="pl-8 text-sm font-semibold h-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-currency" className="text-xs font-semibold">
                Currency *
              </Label>
              <select
                id="edit-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm"
              >
                {SUPPORTED_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Capacity */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-max-members" className="text-xs font-semibold flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              Maximum Member Capacity
            </Label>
            <Input
              id="edit-max-members"
              type="number"
              min="2"
              max="50"
              value={maxMembers}
              onChange={(e) => setMaxMembers(e.target.value)}
              className="h-10 text-sm"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Between 2 and 50 members can join this circle.
            </p>
          </div>

          {/* Equal Split Preview Notice */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Stake Equal-Split Transparency
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              When a member misses a commitment, their forfeit of {symbol}{penaltyMajor || '0'} will be distributed deterministically among the other active members in the circle.
            </p>
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
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
