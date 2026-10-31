# 04 – Security Threat Model

## Overview
The HabitCircle service stores personally identifiable information (email, name, timezone) and financial‑type data (virtual ledger balances, penalty amounts).  Threat modelling focuses on confidentiality, integrity, and availability of these assets while respecting the strict RLS and server‑only design mandated in the `CLAUDE.md` architecture.

## Threat Catalog & Mitigations
| # | Threat | Asset at Risk | Likelihood | Impact | Mitigation |
|---|--------|---------------|------------|--------|------------|
| 1 | **Insecure Direct Object Reference (IDOR)** on profile, group, or check‑in IDs | PII, financial rows | Medium | High | All tables have RLS policies that check `auth.uid()` and group membership. Server‑only endpoints never expose raw IDs without authorization checks. |
| 2 | **Role Escalation** – a member upgrades to admin/owner via crafted requests | Authorization state | Low | Critical | RLS policies enforce role checks on every `UPDATE`. Server actions validate the caller’s role using `supabase.auth.getUser()` and reject any privilege‑changing operation unless the caller is already owner. |
| 3 | **Forged Payment Amounts** – client sends larger `amount` than allowed | Ledger balance | Low | Critical | Payments are created via a **SECURITY DEFINER** PostgreSQL function that validates `amount` against the stored penalty amount and group currency. The client never writes directly to `ledger_entries`. |
| 4 | **Duplicate Penalties / Cron Replay** – scheduler runs twice, creating double penalties | Financial integrity | Medium (idempotent design) | High | `evaluate_period` checks for existing penalty on the occurrence (unique constraint). Job runs are recorded in `job_runs` with a UUID token; duplicate runs are ignored. |
| 5 | **Race Condition on Check‑in Submission** – two concurrent submissions for same period | Penalty calculation | Low | Medium | Unique constraint on `(occurrence_id, profile_id)` prevents duplicate rows. The submission function uses `INSERT … ON CONFLICT DO NOTHING` and returns the existing row if present. |
| 6 | **Cron Endpoint Abuse** – attacker invokes scheduler endpoint directly | Scheduler integrity | Low | High | Cron endpoints require a secret token stored in server‑only env (`CRON_SECRET`). The token is never exposed to the client and is validated before any job runs. |
| 7 | **Storage URL Leakage** – signed URLs to evidence bucket are shared publicly | Evidence confidentiality | Medium | High | Signed URLs are short‑lived (≤ 5 min) and include a verification of the requester’s group membership. URLs are generated server‑side only. |
| 8 | **Invitation Abuse** – mass creation of invites to spam users | Spam, quota exhaustion | Medium | Medium | Rate‑limit `group_invitations` creation per owner (10/min). RLS ensures only owners/admins can insert invites. |
| 9 | **Self‑Verification** – user verifies their own check‑in to avoid penalty | Financial loss | Low | Critical | RLS and domain rule enforce that `reviewer_id != checkin.owner_id`. The `verify_checkin` function checks `auth.uid()` against the check‑in owner and rejects self‑verification. |
|10| **Timezone Dodging** – user changes timezone to extend deadlines | Penalty avoidance | Low | Medium | Habit’s timezone is snap‑shotted on creation; changing a user’s profile timezone does **not** affect existing habit occurrences. |
|11| **Evidence Reuse / Replay** – attacker re‑uses a previously uploaded evidence file for another check‑in | Fraud | Low | High | Evidence rows store a hash of the file content; a new upload must produce a unique hash. The `checkin_evidence` table has a unique constraint on `(checkin_id, storage_path)`. |
|12| **Payment Hijacking** – attacker intercepts payment confirmation request | Ledger tampering | Low | Critical | Confirmation endpoint validates `auth.uid() == receiver_id`. All payment state transitions happen in a single transaction; no client‑side amount can be altered. |
|13| **Service‑Role Key Exposure** – leakage of the Supabase service‑role key to client | Full DB access | Very Low (protected by `server-only`) | Critical | The key is stored only in server‑only environment variables and never bundled in the client bundle. |
|14| **Denial‑of‑Service (DoS) via Rate‑Limited Endpoints** – flooding check‑in or payment APIs | Availability | Medium | Medium | Rate‑limit tables (`rate_limits`) enforce per‑profile call caps (e.g., 30 check‑ins/min). Excess calls receive HTTP 429. |
|15| **Audit‑Log Tampering** – attacker attempts to delete or modify audit entries | Forensic integrity | Very Low (append‑only) | Critical | Triggers on `audit_log` block `UPDATE`/`DELETE`. Only super‑user can bypass, and such actions are logged in a separate immutable table. |

## Defense‑in‑Depth Layers
1. **Network** – Vercel edge functions run behind Cloudflare; only HTTPS allowed.
2. **Application** – Server‑only code, strict Zod validation, CSRF‑protected server actions.
3. **Database** – Row‑Level Security, SECURITY DEFINER functions, append‑only tables, triggers enforcing immutability.
4. **Storage** – Private Supabase buckets with signed URLs, file type/size validation, EXIF stripping.
5. **Monitoring** – `job_runs` and `audit_log` provide audit trails; alerts on unusual spikes (e.g., >1000 check‑ins in 1 min).

---
*This threat model aligns with the security rules in `CLAUDE.md` and provides concrete mitigations for each identified risk.*