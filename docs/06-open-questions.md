# 06 – Open Questions

| # | Question | Context | Recommended Default |
|---|----------|---------|---------------------|
| 1 | **How to handle habit timezone changes for existing occurrences?** | Users may want to change their profile timezone after habits are created. | Disallow changing a habit’s timezone once any occurrence exists; require creating a new habit version.
| 2 | **What is the maximum allowed size for evidence files?** | Storage costs and upload time. | 10 MiB per file, limited to image/video MIME types (jpg, png, mp4). Enforce via Supabase storage rules.
| 3 | **Should penalties be capped per period?** | Prevent runaway debt for very active groups. | Cap total penalty per offender per period at 5 × the habit’s `penalty_amount`.
| 4 | **Do we need a “group pot” ledger account for pooled penalties?** | Ledger design currently records debit from offender and credit to a virtual pot. | Keep the virtual pot; expose it only in admin reports, not to members.
| 5 | **How to handle DST transitions for habits in zones that observe DST?** | Period boundaries computed in habit timezone. | Use PostgreSQL’s `AT TIME ZONE` which respects DST; store timezone name, not offset.
| 6 | **Should we allow partial payments (installments) for large penalties?** | Large penalties could be burdensome. | Not in MVP; require full payment on confirmation.
| 7 | **What UI flow for disputed check‑ins?** | Need clear path for reviewer and offender. | Modal dialog for reviewer with approve/reject; offender sees status and can appeal (creates `flag_dispute`).
| 8 | **Do we need a “soft delete” for groups or habits?** | Legal/retention concerns. | Implement a `deleted_at` timestamp; rows are hidden via RLS but retained for audit.
| 9 | **Should email notifications be batched or immediate?** | Avoid spamming users. | Immediate for critical events (penalty, payment); batch daily summary for routine updates.
|10| **Will we support multi‑currency groups in the future?** | Expansion to international users. | Store currency per group now; defer conversion logic to a future phase.

*These questions will be revisited during design reviews. The recommended defaults are chosen to keep the MVP simple while preserving extensibility.*