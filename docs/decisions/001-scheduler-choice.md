# 001 – Scheduler Choice ADR

**Status:** Proposed (awaiting approval)

## Context
HabitCircle requires background jobs for:
- Generating habit occurrences after a period ends.
- Evaluating completed periods and creating penalties.
- Cleaning up expired exemptions and failed job retries.
- Sending notification digests.

Two primary options are available in the current stack:

1. **PostgreSQL `pg_cron`** (installed in the Supabase Docker image).
2. **Vercel Cron Jobs** (edge functions scheduled via Vercel’s platform).

## Decision Drivers
| Criterion | Importance | pg_cron | Vercel Cron |
|-----------|------------|---------|------------|
| **Transactional consistency** | High | Runs inside the same DB transaction; can call stored procedures atomically. | Must invoke an HTTP endpoint which then calls DB functions – extra network hop, potential latency.
| **Idempotency & deduplication** | High | Can use `job_runs` table with UUID token; DB‑level locking ensures single execution. | Must implement token handling in the endpoint; risk of duplicate invocations if Vercel retries.
| **Observability & retry** | Medium | Logs available via Postgres `pg_stat_activity`; failures can be captured in `job_runs` and retried by a watchdog job. | Vercel provides basic logs; automatic retries are limited and not configurable per job.
| **Operational simplicity** | Medium | Requires enabling the extension in Supabase (`CREATE EXTENSION IF NOT EXISTS pg_cron;`) and granting the `cron` role. | No DB changes; just configure Vercel UI or `vercel.json`.
| **Security surface** | High | Runs inside the trusted DB environment; no external endpoint exposure. | Exposes an HTTP endpoint that must be protected by a secret token (`CRON_SECRET`).
| **Scalability** | Low | Limited by the DB instance’s resources; suitable for low‑frequency jobs (hourly/daily). | Vercel can scale horizontally; suitable for higher frequency but still limited by free tier.
| **Timezone handling** | Medium | DB functions compute periods using stored IANA timezone; all logic stays in SQL. | Must pass timezone info to the endpoint; risk of mismatch if client‑side code is used.

## Decision
We **choose `pg_cron`** as the scheduler for the MVP.

### Rationale
- Guarantees **transactional integrity**: job logic runs directly in the database, allowing atomic creation of occurrences, penalties, and ledger entries.
- Reduces **security risk**: no public endpoint that could be discovered or abused.
- Aligns with the **RLS‑first** philosophy – the job runs with the service‑role and respects the same policies as any other DB function.
- Simpler **idempotency**: we can store a `run_id` in `job_runs` and lock on that within the same transaction.
- The expected job frequency (daily/weekly/monthly) is modest and well‑within the capacity of the Supabase Postgres instance.

### Mitigations for pg_cron limitations
- **Retry policy**: A separate watchdog cron (`retry_failed_jobs`) will re‑queue failed jobs with exponential back‑off.
- **Monitoring**: Insert rows into `job_runs` with status and timestamps; expose a simple admin UI to view recent runs.
- **Extension availability**: Ensure the Supabase Docker image includes `pg_cron`; if not, add it in the `Dockerfile` used by the local dev environment.

## Consequences
- All background logic must be expressed as **SQL/PL‑pgSQL functions**.
- Future migration to an external scheduler (e.g., Vercel Cron) would require rewriting jobs as HTTP‑triggered functions.
- Documentation and tests must cover the `cron_job` and `job_runs` tables.

---
*Prepared as part of Phase 1 documentation.*