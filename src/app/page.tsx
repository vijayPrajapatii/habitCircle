import Link from 'next/link'
import { CheckCircle2, Users, Target, Shield, ArrowRight, Sparkles } from 'lucide-react'
import { APP_NAME } from '@/config/brand'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Sparkles className="h-4 w-4" />
              <span>New: Group accountability with real stakes</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              Build habits that <span className="text-primary">stick</span>, together
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join groups with friends, commit to daily habits, and hold each other accountable.
              Miss a check-in? You owe the group. Simple, social, effective.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-semibold rounded-lg border border-border bg-background hover:bg-accent transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">How it works</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Simple workflow, powerful results. Built for consistency, not complexity.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Users}
              title="Create or Join Groups"
              description="Start a private group with friends or join via invite link. Set the rules: penalty amount, schedule, and verification mode."
            />
            <FeatureCard
              icon={Target}
              title="Commit to Habits"
              description="Daily, weekly, or custom schedules. Quantity-based or simple yes/no. Your habit, your rules — locked in for the period."
            />
            <FeatureCard
              icon={CheckCircle2}
              title="Check In & Verify"
              description="One-tap completion with optional photos. Peer review, admin review, or self-reported — you choose the accountability level."
            />
            <FeatureCard
              icon={Shield}
              title="Fair Penalties"
              description="Missed habits create penalties split equally among eligible members. Integer math, deterministic rounding, audit trail on every cent."
            />
            <FeatureCard
              icon={Sparkles}
              title="Leaderboards & Streaks"
              description="Track personal and group stats: completion %, current & longest streaks, weekly consistency. Never ranked by money."
            />
            <FeatureCard
              icon={Shield}
              title="Privacy First"
              description="Evidence photos in private buckets with signed URLs. Your data, your control. No payment processing — virtual ledger only."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to build better habits?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join thousands of people using social accountability to hit their goals.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Create Your Account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border bg-card p-6 hover:border-primary/50 transition-colors">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}