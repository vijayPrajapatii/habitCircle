import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet } from 'lucide-react'

export default function LedgerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Ledger</h1>
        <p className="text-muted-foreground mt-1">Track penalties, payments, and balances</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ledger coming soon</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            View who owes whom, pending confirmations, and payment history. Virtual ledger only — no payment processing.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}