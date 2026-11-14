# 002 – Database security lockdown (migration 017)

**Status:** Accepted. Applied to production on 2026-11-14 and verified (`supabase/verify/security_simulation.sql`: 44 pass, 0 fail).

## Context
A review of the live production catalog (`pg_policies`, `pg_proc`, grants, Supabase advisor, anon REST
row counts) found that the client could do things only the server should. At the time of the review
production held 8 users, 4 groups, 10 invitations and **no** penalties, ledger entries or payments,
so tightening money paths changes no existing financial data.

Confirmed on the live database:

| Problem | Effect |
|---|---|
| `group_members_insert_self` / `_insert_allowed` check only `user_id = auth.uid()` | any signed-in user can insert themselves as `owner` of any group |
| `group_members_update_own/_self` had no WITH CHECK; owner/admin policies compared `group_id` to itself | role self-promotion; the owner of any group could manage members of every group (currently masked because the `updated_at` trigger on this table breaks every UPDATE) |
| `invitations_select_public USING (true)`, `profiles_select_public USING (true)` | with only the public anon key: all 10 invitation codes/tokens and all 8 profiles readable (verified by row count) |
| client INSERT/UPDATE policies on `penalties`, `penalty_allocations`, `ledger_entries`; `payments_insert` allowing any status; `payments_update_status` not limiting columns | a user could forgive their own debt, write ledger rows, insert a `confirmed` payment, or change the amount while confirming |
| `habit_checkins_insert_own` allowed any status | a user could submit a `verified` check-in |
| anon and authenticated could EXECUTE every SECURITY DEFINER function; `create_group_invitation` trusted a client-supplied user id | invitations minted for any group by anyone who knows an owner id (which the public invitation read leaked) |
| `record_peer_settlement` inserted `confirmed` immediately, allowed paying yourself, and marked every active penalty of the sender `paid` for any amount in any group | violates the domain rule "only the recipient's confirmation completes a payment" |
| `record_habit_miss` computed the day boundary in UTC, could overwrite a submitted check-in with `missed`, snapshot lacked `group_id` | wrong day for non-UTC habits; wrong group attribution in settlements |
| `generate_invite_code` used `random()` | invite codes are bearer secrets; need a cryptographic source |
| `updated_at` triggers on tables without that column; `enforce_penalty_allocation_sum` never attached | every UPDATE on `group_members`/`habit_schedules` failed; allocation sums not enforced |

## Decision
Ship one forward-only, idempotent migration, `supabase/migrations/017_security_lockdown.sql`:

1. **Membership only through RPCs.** Drop all client INSERT/UPDATE/DELETE policies on `group_members`
   and the direct INSERT on `groups`; `create_group_with_owner` and `accept_group_invitation` are the
   only ways in. (No screen updates or deletes members today. A `leave_group` RPC is a feature and is
   deliberately not added.)
2. **No world-readable secrets.** Drop `invitations_select_public`; profiles are readable by yourself
   and by anyone you share (or shared) a group with, through `shares_group_with()`.
3. **Money tables are written only by SECURITY DEFINER functions.** Drop the client write policies on
   `penalties`, `penalty_allocations`, `ledger_entries`, and `payments` insert/update. Add
   `payments_sender_not_receiver`, a deferred allocation-sum constraint trigger, and a TRUNCATE guard on
   the ledger.
4. **Payments follow the domain rule.** `record_peer_settlement` creates a **pending** payment;
   `confirm_payment` / `reject_payment` are recipient-only. Confirmation writes the ledger entry in the
   same transaction. Penalty rows are not flipped to `paid`: the outstanding balance is derived as
   allocations minus confirmed payments (what `getCircleSettlements` already computes), which stays
   correct when later penalties arrive.
5. **Currency is locked once money exists** in a circle (trigger on `groups`). Stakes remain editable
   because penalty amounts are snapshotted per penalty.
6. **Privileges.** `anon` loses all table privileges and EXECUTE on every function; `authenticated`
   loses TRUNCATE/REFERENCES/TRIGGER and EXECUTE on trigger/internal helpers. Helpers used inside
   policies (`is_group_member`, `has_group_role`, `shares_group_with`) stay executable by
   `authenticated`.
7. **Compatibility.** Function signatures used by the deployed app are unchanged
   (`create_group_invitation` keeps, and ignores, `p_created_by`), so the database can be updated before
   the new app code is deployed with no downtime.

## Consequences
- Because 005–016 were applied by hand in production (the migration history table lists only 001–004),
  the repository's migration chain is **not proven** to reproduce production. 017 is written to be safe
  on both, but `supabase db reset` must be run once Docker is available, and the history table should be
  reconciled with `supabase migration repair` after the user approves.
- Every new RPC must explicitly `REVOKE` the built-in PUBLIC execute and `GRANT` to `authenticated`:
  the schema default only removes the `anon` grant.
- Known gaps this does not close: an audit log for financial/role changes (no table exists), rate
  limiting, the helper-function membership oracle (`is_group_member(group, user)` is callable by any
  signed-in user), `pg_trgm` installed in `public`, and leaked-password protection (a dashboard
  setting).

## Rollout
1. Dry-run the whole file plus post-condition attacks inside one transaction that is rolled back.
2. Apply with `supabase db query --linked -f` (never `db push`: history is out of sync).
3. Re-run the attack simulations (all must be blocked) and the Supabase advisor.
4. Deploy the matching app code (proxy rename, login redirect, invitation hardening).
