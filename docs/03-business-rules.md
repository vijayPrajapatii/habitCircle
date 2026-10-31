# 03 – Business Rules

## Scheduling Rules
- **Habit → Schedule → Occurrence**: Each habit has exactly one schedule (daily, weekly, monthly, or custom cron). The schedule stores the IANA timezone of the habit at creation; it never changes for existing occurrences.
- **Period Generation**: A background job creates a `habit_occurrence` **after** the previous period ends plus the configured grace period. The job is idempotent – it uses `INSERT … ON CONFLICT DO NOTHING` keyed on `(schedule_id, period_start)`.
- **Grace Period**: Configurable per habit (default 24 h). Check‑ins submitted within the grace period are considered for the just‑ended period.
- **Review Window**: After the grace period, a 48 h window allows peers/admins to review check‑ins before the evaluation runs.

## Evaluation Rules
- **Daily habits**: Compare *quantity* of check‑ins to `target_quantity`. Missed days generate a penalty.
- **Weekly / Monthly habits**: Sum all `quantity` values in the period; compare to `target_quantity`. No per‑day penalties; a single penalty is created if the total is insufficient.
- **Custom cron**: The evaluation job respects the custom cron expression; the same aggregation logic applies.
- **Idempotency**: The `evaluate_period` function checks `penalties` for an existing entry on the occurrence; if present, it skips creation.

## Grace Period & Exemptions
- **Exemption Table**: `exemptions` stores a `profile_id`, `habit_id`, `reason`, and `expires_at`. When evaluating a period, the function excludes any member with a *valid* exemption (`expires_at > now()`).
- **Automatic revocation**: A daily cleanup job deletes expired exemptions.

## Dispute & Review Rules
- A `checkin_review` can be created only by a **different** group member (owner, admin, or peer). The reviewer cannot be the check‑in owner.
- Disputed check‑ins move to `status = disputed`. An admin can resolve to `verified` or `excused`.
- If a dispute is unresolved after the review window, the system automatically marks the check‑in as `missed` and proceeds to penalty creation.

## Penalty Calculation Rules
1. **Amount Determination**: The habit’s `penalty_amount` (bigint) is stored on the schedule and snap‑shotted into the `penalties.snapshot` JSON at creation.
2. **Eligible Receivers**: All *active* group members **at period end** (excluding the offender) are captured in the snapshot.
3. **Equal Split**: The total amount is divided equally (integer division). Remainder cents are allocated deterministically by sorting receiver UUIDs and giving the extra cent(s) to the first N receivers (documented in ADR `001-split-remainder.md`).
4. **Allocation Row**: One row per receiver in `penalty_allocations` with `share` column (bigint).
5. **Ledger Entry**: A single `ledger_entries` row records the total penalty as a debit from the offender’s balance and a credit to a virtual “group pot”.

## Reversal & Compensation Rules
- A penalty can be **reversed** only via a compensating ledger entry (type `adjust`). The original penalty row stays immutable; a new entry with a negative amount offsets it.
- Reversals are triggered automatically when a check‑in is later **excused** (e.g., approved exemption) and the period has not been settled.

## Payment Confirmation Rules
- **Sender** creates a `payments` row with status `pending`. The row includes an optional `evidence_path` (uploaded to private storage).
- **Recipient** must call `confirm_payment`. The function verifies:
  - Payment is still `pending`.
  - The caller is the `receiver_id`.
  - The ledger entry for the debit/credit does not already exist.
- Upon success, a ledger entry is inserted (credit to receiver, debit from sender) and the payment status becomes `confirmed`.
- If the recipient rejects, the status becomes `rejected` and no ledger entry is made.

## Worked‑Examples
| Scenario | Input | Outcome |
|----------|-------|---------|
| **5/5 gym sessions (daily)** | Target = 5, submissions = 5, no grace‑period breach | No penalty created.
| **4/5 gym sessions** | Target = 5, submissions = 4 | Penalty of **₹100** created. Eligible receivers = 4 members. Share = ₹25 each.
| **₹100 penalty split among 3 members** | Total = ₹100, receivers = 3 | Shares = ₹33, ₹33, ₹34 (extra cent to first UUID).
| **Job runs twice** (idempotent) | Same period, same schedule | Only one `habit_occurrence` and one `penalty` row are created.
| **Exemption granted** | Member has active exemption for habit | Member is excluded from penalty allocation.
| **Dispute resolved in favor of offender** | Check‑in disputed, admin marks `excused` | Penalty is **reversed** via ledger adjustment; offender’s balance restored.

---
*The above rules are expressed as pure TypeScript functions in `src/domain/` and as PostgreSQL stored procedures where atomicity is required.*