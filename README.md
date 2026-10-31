# HabitCircle

Social habit-accountability web app. Friends join groups, commit to habits, check in, and owe each other money when they miss. Money is tracked in a **virtual ledger only**: no payment processing, no custody.

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker Desktop (for local Supabase)
- Supabase CLI
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/vijayPrajapatii/habitCircle.git
cd habitCircle

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Start local Supabase (requires Docker)
supabase start

# Run development server
pnpm dev
```

### Commands

```bash
# Development
pnpm dev              # Start dev server at http://localhost:3000
pnpm build            # Production build
pnpm start            # Start production server

# Code Quality
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint
pnpm test             # Vitest unit tests

# Supabase
supabase start        # Start local Supabase stack
supabase stop         # Stop local Supabase stack
supabase db reset     # Reset database with migrations
supabase test db      # Run pgTAP tests
supabase gen types    # Generate TypeScript types
supabase migration new <name>  # Create new migration

# Docker
docker compose up -d  # Alternative to supabase start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # Shared UI components
│   ├── shell/              # Layout components (Sidebar, BottomNav)
│   └── ui/                 # shadcn/ui compatible components
├── config/                 # Brand configuration
├── features/               # Feature modules (15 modules)
├── hooks/                  # Custom React hooks
├── lib/                    # Shared utilities
│   ├── env.ts              # Environment validation
│   ├── supabase/           # Supabase clients
│   └── utils.ts            # Utility functions
├── middleware.ts           # Auth middleware
└── domain/                 # Pure domain logic (no I/O)
```

## Environment Variables

See `.env.example` for all required variables.

## License

MIT