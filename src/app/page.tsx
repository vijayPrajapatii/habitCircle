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
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
      {/* Navbar */}
      <header className="border-b border-border/60 sticky top-0 z-50 bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl tracking-tight">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm sm:text-base">
              H
            </div>
            <span>{APP_NAME}</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] sm:text-xs font-medium mb-6 border border-primary/20">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Social habit accountability with real peer stakes</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.2] mb-4 sm:mb-6">
              Build habits that <span className="text-primary underline decoration-primary/40 underline-offset-4">stick</span>, together
            </h1>

            <p className="text-sm sm:text-lg lg:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              Form small private circles with friends. Commit to daily habits. Check in consistently.
              Miss a day? The group pot claims your stake. Simple, social, and genuinely motivating.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto max-w-sm sm:max-w-none mx-auto">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm sm:text-base font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-md active:scale-95 touch-manipulation"
              >
                Create Your First Circle
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm sm:text-base font-semibold rounded-lg border border-border bg-card hover:bg-accent transition-colors active:scale-95 touch-manipulation"
              >
                Sign In to Circle
              </Link>
            </div>

            {/* Quick Guarantees */}
            <div className="mt-10 sm:mt-12 pt-6 sm:pt-8 border-t border-border/40 flex flex-col xs:flex-row flex-wrap justify-center items-center gap-3 sm:gap-6 text-[11px] sm:text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                <span>Zero Custody Virtual Ledger</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                <span>100% Peer Accountability</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                <span>Deterministic Fair Split</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-14 sm:py-20 bg-muted/20 border-y border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-2 sm:mb-3">
              Designed for serious consistency
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-xl mx-auto">
              Linear-level clarity meets Stripe-grade ledger tracking. Everything you need to turn goals into non-negotiable routines.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
      <section className="py-14 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Start building unstoppable momentum
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm mb-6 sm:mb-8 max-w-md mx-auto leading-relaxed">
            Bring your friends, set your stakes, and see what happens when accountability has real skin in the game.
          </p>
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 text-sm sm:text-base font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-md active:scale-95 touch-manipulation"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-6 sm:py-8 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground text-center sm:text-left">
          <p>© {new Date().getFullYear()} {APP_NAME}. Social habit accountability.</p>
          <div className="flex items-center gap-4 sm:gap-6">
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
    <div className="rounded-xl border bg-card p-4 sm:p-6 hover:border-primary/40 transition-colors flex flex-col justify-between">
      <div>
        <div className="inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3 sm:mb-4">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-sm sm:text-base font-semibold mb-1.5">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
