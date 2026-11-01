'use client'

import { useState, useEffect } from 'react'
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
import { recordSettlement } from '@/features/settlements/actions'
import { toast } from '@/hooks/use-toast'
import { CURRENCY_SYMBOLS, formatMoney } from '@/domain/money'
import {
  CheckCircle2,
  Loader2,
  Smartphone,
  Banknote,
  Building,
  CreditCard,
  HandCoins,
} from 'lucide-react'

interface PeerOption {
  id: string
  name: string
}

interface GroupOption {
  id: string
  name: string
  currency: string
}

interface SettleUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPeerId?: string
  defaultPeerName?: string
  defaultGroupId?: string
  defaultGroupName?: string
  defaultAmount?: number // in minor units
  currency?: string
  groups?: GroupOption[]
  peers?: PeerOption[]
  onSuccess?: () => void
}

const PAYMENT_METHODS = [
  { key: 'UPI', label: 'UPI / GPay / PhonePe', icon: Smartphone },
  { key: 'Cash', label: 'Cash / In-person', icon: Banknote },
  { key: 'Bank Transfer', label: 'Bank Transfer / IMPS', icon: Building },
  { key: 'Venmo/PayPal', label: 'Venmo / PayPal / Zelle', icon: CreditCard },
  { key: 'Other', label: 'Other', icon: HandCoins },
]

export function SettleUpDialog({
  open,
  onOpenChange,
  defaultPeerId,
  defaultPeerName,
  defaultGroupId,
  defaultGroupName,
  defaultAmount,
  currency = 'INR',
  groups = [],
  peers = [],
  onSuccess,
}: SettleUpDialogProps) {
  const [peerId, setPeerId] = useState(defaultPeerId || peers[0]?.id || '')
  const [peerName, setPeerName] = useState(defaultPeerName || peers[0]?.name || 'Member')
  const [groupId, setGroupId] = useState(defaultGroupId || groups[0]?.id || '')
  // Input in major currency units (e.g. 250 for 25000 paise)
  const initialMajor = defaultAmount ? (defaultAmount / 100).toFixed(0) : '100'
  const [amountStr, setAmountStr] = useState(initialMajor)
  const [method, setMethod] = useState('UPI')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (defaultPeerId) setPeerId(defaultPeerId)
    if (defaultPeerName) setPeerName(defaultPeerName)
    if (defaultGroupId) setGroupId(defaultGroupId)
    if (defaultAmount) setAmountStr((defaultAmount / 100).toFixed(0))
  }, [defaultPeerId, defaultPeerName, defaultGroupId, defaultAmount])

  const symbol = CURRENCY_SYMBOLS[currency] || currency

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const numAmount = parseFloat(amountStr)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive settlement amount')
      return
    }

    const minorUnits = Math.round(numAmount * 100)

    const activeGroupId = groupId || defaultGroupId || groups[0]?.id
    const activePeerId = peerId || defaultPeerId || peers[0]?.id

    if (!activeGroupId || !activePeerId) {
      setError('Circle and receiver must be selected')
      return
    }

    setSubmitting(true)

    const formData = new FormData()
    formData.append('receiver_id', activePeerId)
    formData.append('group_id', activeGroupId)
    formData.append('amount', minorUnits.toString())
    formData.append('payment_method', method)
    formData.append('notes', notes.trim())

    const res = await recordSettlement(formData)

    if (res.error) {
      setError(res.error)
      setSubmitting(false)
      return
    }

    toast({
      title: 'Settlement recorded!',
      description: `Settled ${symbol}${numAmount} with ${peerName} via ${method}.`,
    })

    setSubmitting(false)
    onOpenChange(false)
    if (onSuccess) onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.25rem)] max-w-md p-4 sm:p-6">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg">Settle Up Peer Debt</DialogTitle>
              <DialogDescription className="text-xs">
                Zero-custody direct payment confirmation between circle members.
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

          {/* Peer & Circle Info */}
          <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Paying to:</span>
              <span className="font-semibold text-foreground">{peerName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Circle:</span>
              <span className="font-medium text-foreground">{defaultGroupName || groups[0]?.name || 'Circle'}</span>
            </div>
            {defaultAmount && (
              <div className="flex justify-between items-center text-xs pt-1 border-t">
                <span className="text-muted-foreground">Current Debt:</span>
                <span className="font-bold text-destructive">{formatMoney(defaultAmount, currency)}</span>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <Label htmlFor="settle-amount" className="text-xs font-semibold">
              Settlement Amount ({currency}) *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground text-sm">
                {symbol}
              </span>
              <Input
                id="settle-amount"
                type="number"
                min="1"
                step="any"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0"
                className="pl-8 text-base font-semibold h-10"
                required
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              You can settle the full amount or enter a partial amount.
            </p>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              How did you pay? *
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(m => {
                const Icon = m.icon
                const active = method === m.key
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMethod(m.key)}
                    className={`flex items-center gap-2 p-2.5 rounded-md border text-left text-xs transition-all ${
                      active
                        ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300 font-semibold'
                        : 'border-input hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Optional Notes / Transaction ID */}
          <div className="space-y-1.5">
            <Label htmlFor="settle-notes" className="text-xs font-semibold">
              Payment Reference / Note (Optional)
            </Label>
            <Input
              id="settle-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. GPay UPI Ref #40284920 or Given in cash"
              maxLength={200}
              className="h-9 text-xs"
            />
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
              disabled={submitting || !amountStr}
              className="w-full sm:w-auto h-10 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Settlement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
