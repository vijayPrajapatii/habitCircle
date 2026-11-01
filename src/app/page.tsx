import Link from 'next/link'
import {
  CheckCircle2,
  Users,
  Target,
  Shield,
  ArrowRight,
  Sparkles,
  Wallet,
  Trophy,
  Check,
} from 'lucide-react'
import { APP_NAME } from '@/config/brand'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar */}
      <header className="border-b border-border/60 sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-base">
              H
            </div>
            <span>{APP_NAME}</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-8 border border-primary/20">
              <Sparkles className="h-4 w-4" />
              <span>Social habit accountability with real peer stakes</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.15] mb-6">
              Build habits that <span className="text-primary underline decoration-primary/40 underline-offset-4">stick</span>, together
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Form small private circles with friends. Commit to daily habits. Check in consistently.
              Miss a day? The group pot claims your stake. Simple, social, and genuinely motivating.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 text-base font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-md hover:shadow-lg"
              >
                Create Your First Circle
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 text-base font-semibold rounded-lg border border-border bg-card hover:bg-accent transition-colors"
              >
                Sign In to Circle
              </Link>
            </div>

            {/* Quick Guarantees */}
            <div className="mt-12 pt-8 border-t border-border/40 flex flex-wrap justify-center items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-500" />
                <span>Zero Custody Virtual Ledger</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-500" />
                <span>100% Peer Accountability</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-500" />
                <span>Deterministic Fair Split</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 lg:py-28 bg-muted/20 border-y border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3">
              Designed for serious consistency
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
              Linear-level clarity meets Stripe-grade ledger tracking. Everything you need to turn goals into non-negotiable routines.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={Users}
              title="Private Accountability Circles"
              description="Create circles with friends or colleagues. Set custom penalty stakes (INR, USD, EUR) and select verification modes."
            />
            <FeatureCard
              icon={Target}
              title="Flexible Habit Commitments"
              description="Daily fitness, weekly study sessions, or monthly goals. Target quantities with locked commitment schedules."
            />
            <FeatureCard
              icon={CheckCircle2}
              title="One-Tap Daily Check-ins"
              description="Frictionless check-in workflow. Transparent peer verification keeps everyone honest and motivated."
            />
            <FeatureCard
              icon={Wallet}
              title="Immutable Financial Ledger"
              description="Missed habits trigger automated, equal-split penalties among active members with integer precision down to the paise."
            />
            <FeatureCard
              icon={Trophy}
              title="Rankings Based on Consistency"
              description="Compete on execution streaks and completion rates. Our leaderboard never ranks by money — only pure discipline."
            />
            <FeatureCard
              icon={Shield}
              title="Zero-Custody Architecture"
              description="HabitCircle tracks obligations without touching banking rails. Members settle directly peer-to-peer with total privacy."
            />
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Start building unstoppable momentum
          </h2>
          <p className="text-muted-foreground text-base mb-8 max-w-xl mx-auto">
            Bring your friends, set your stakes, and see what happens when accountability has real skin in the game.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-md"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-8 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {APP_NAME}. Social habit accountability.</p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Create Account</Link>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
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
    <div className="rounded-xl border bg-card p-6 hover:border-primary/40 transition-colors flex flex-col justify-between">
      <div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
