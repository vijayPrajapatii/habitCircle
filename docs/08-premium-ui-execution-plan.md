# HabitCircle Premium UI Execution Plan

## Purpose

This document is the implementation plan for improving HabitCircle into a polished, premium, responsive product. It is intentionally explicit so that a lower-capability coding model can execute it safely without guessing architecture, changing business rules, or creating inconsistent screens.

The target feeling is:

- Linear: calm hierarchy, precise spacing, excellent keyboard behavior.
- Stripe: confident fintech surfaces, strong numbers, clear status language.
- Modern fitness product: progress, momentum, encouraging feedback, useful motion.

The product is a social habit-accountability app. The UI must make three things obvious at all times:

1. What should I do today?
2. How am I progressing?
3. What are my group members doing?

## Non-Negotiable Rules

1. Work only in the current repository and existing stack.
2. Do not add a dependency.
3. Do not change database schema, RLS, auth, money logic, or API contracts during the visual UI phase.
4. Do not replace existing user changes. Read the file before editing it.
5. Do not use placeholder content when real data is available.
6. Keep Activity Feed, Leaderboard, and Financial Ledger out of the primary navigation. They are intentionally deferred to keep the first version focused.
7. Do not show fake metrics such as hard-coded streaks, completion rates, or member counts.
8. Use the existing `brand.ts` and `APP_NAME`; never hard-code the product name in new components.
9. Keep the existing dark theme and light theme support.
10. Every interactive control must work with keyboard input.
11. Every page must have loading, empty, error, and success states where the page performs data work.
12. Mobile target: 375px wide. Desktop target: 1280px wide.
13. Do not use horizontal scrolling for the main page.
14. Do not put cards inside cards.
15. Do not use giant hero sections or marketing copy. The first screen must be the usable product.
16. Use lucide-react icons already installed. Do not draw custom SVG icons.
17. Run validation after every phase. Do not continue after a failed validation.

## Files In Scope

Primary UI files:

- `src/app/globals.css`
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/groups/page.tsx`
- `src/app/dashboard/groups/[groupId]/page.tsx`
- `src/app/dashboard/habits/page.tsx`
- `src/app/dashboard/settings/page.tsx`
- `src/app/dashboard/profile/page.tsx`
- `src/components/shell/sidebar.tsx`
- `src/components/shell/bottom-nav.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/toast.tsx`
- `tailwind.config.ts`

Do not casually edit these files during the UI pass:

- `supabase/migrations/*`
- `src/features/*/actions.ts`
- `src/lib/supabase/*`
- `src/types/supabase.ts`
- `src/middleware.ts`
- `src/lib/env.ts`

If a UI issue appears to require a server or schema change, stop and report it instead of silently changing the contract.

## Required Execution Order

Execute these phases in order. Complete one phase and validate it before starting the next phase.

### Phase 0: Baseline and Inventory

Goal: understand the current state before changing visual code.

Steps:

1. Read `CLAUDE.md`.
2. Read `docs/PROGRESS.md`.
3. Read `docs/MOBILE_UI_EDITS.md` if it exists.
4. Read the current versions of every file in `Files In Scope` that will be edited.
5. Run:

```powershell
pnpm typecheck
pnpm lint
pnpm test
```

6. Record any pre-existing failures. Do not attribute them to later UI work.
7. Check `git status --short` and preserve unrelated changes.

Acceptance:

- The model can name the current shell entry point.
- The model knows which files already contain user changes.
- Baseline command results are recorded before editing.

### Phase 1: Design Tokens and Visual Foundation

Goal: establish a coherent visual system before styling individual screens.

Edit only:

- `src/app/globals.css`
- `tailwind.config.ts` only if an existing token cannot be expressed in CSS.

Add or refine CSS variables for:

- page background
- elevated surface
- raised surface
- border subtle
- border strong
- foreground
- muted foreground
- primary accent
- success
- warning
- danger
- information
- focus ring

Use the existing HSL variable convention. Do not change the theme architecture.

Visual direction:

- Dark background: near-black with a slight cool neutral tint, not pure black.
- Surfaces: distinguish page, card, and raised dialog surfaces with small luminance steps.
- Accent: use one confident blue/cyan accent for primary actions and progress. Use green only for success, amber for warnings, red for destructive states.
- Avoid purple gradients and avoid a one-color interface.
- Borders should be visible but quiet.
- Text hierarchy must include primary, secondary, muted, and disabled levels.

Add utility classes only when they are reused at least twice. Do not create a large custom CSS framework.

Acceptance at 375px and 1280px:

- Text has readable contrast.
- Card edges are visible.
- Focus rings are visible.
- No page-wide horizontal scrollbar.
- Light theme still has readable borders and muted text.

### Phase 2: Shell, Navigation, and Mobile Safety

Goal: make navigation reliable and comfortable on phones.

Edit:

- `src/app/dashboard/layout.tsx`
- `src/components/shell/sidebar.tsx`
- `src/components/shell/bottom-nav.tsx`

Required behavior:

1. Desktop at `lg` and above:
   - Fixed-width sidebar on the left.
   - Main content fills remaining width.
   - Sidebar navigation shows active route clearly.
   - Long labels do not overflow.

2. Mobile below `lg`:
   - Bottom navigation is fixed and always above page content.
   - Main content has bottom padding equal to bottom-nav height plus safe-area inset.
   - The sidebar opens as a drawer with an overlay.
   - The drawer closes when a navigation link is selected.
   - The menu button never covers a bottom-nav item.
   - Use `env(safe-area-inset-bottom)` for iOS devices.

3. Navigation routes:
   - Home -> `/dashboard`
   - Groups -> `/dashboard/groups`
   - Habits -> `/dashboard/habits`
   - Settings/Profile -> an existing real route only
   - Never link to a route that does not exist.

4. Touch targets:
   - Icon buttons: minimum 40px by 40px.
   - Navigation items: minimum 44px high.
   - Text buttons: minimum 40px high.

5. Accessibility:
   - Every icon-only button has `aria-label` and `title`.
   - Current route uses `aria-current="page"`.
   - Drawer has a usable close button.
   - Keyboard focus is visible.

Acceptance:

- Navigate through every mobile nav item at 375px.
- No content is hidden behind the bottom nav.
- Sidebar opens and closes without trapping the user.
- No dead route returns a 404.

### Phase 3: Shared Components and Interaction Quality

Goal: make controls feel consistent across the product.

Edit:

- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/toast.tsx`

Button rules:

- Primary action: solid accent button.
- Secondary action: bordered or muted button.
- Destructive action: danger color and confirmation dialog.
- Loading state: keep button width stable; show spinner and disable it.
- Do not use a text button where a familiar icon is sufficient.
- Do not hide required button text on mobile unless the button has an accessible label and tooltip.

Card rules:

- Cards are for repeated items or framed tools only.
- Use no more than 8px radius unless the existing design system requires otherwise.
- Use consistent padding: 16px desktop, 12px mobile when content is dense.
- Do not nest cards inside cards.
- Do not make every page section a floating card.

Dialog rules:

- Width on phone: `calc(100% - 1rem)`.
- Maximum height: `calc(100dvh - 2rem)`.
- Long content scrolls inside the dialog.
- Close button has a 40px touch target.
- Dialog footer stacks on phones and aligns right on desktop.
- Destructive actions must name the object being deleted.

Input rules:

- Visible label for every input.
- Error text below the relevant input.
- `aria-invalid` and `aria-describedby` when invalid.
- Minimum height 40px.
- Do not use placeholder text as the only label.

Toast rules:

- Success confirms what changed.
- Error names the failed operation and gives the next action.
- Do not show a success toast before the server action succeeds.

Acceptance:

- Open every existing dialog at 375px.
- Submit empty forms and verify visible errors.
- Submit successful forms and verify visible success feedback.
- Test Escape and keyboard focus for dialogs.

### Phase 4: Dashboard Home Experience

Goal: make the dashboard answer “what should I do today?” immediately.

Edit:

- `src/app/dashboard/page.tsx`

Do not invent metrics. Use only data returned by the existing queries.

Layout:

1. Header:
   - Short greeting.
   - Current date or “Today” label.
   - One primary next action.

2. Priority area:
   - A full-width “Today” section.
   - Show pending habits first.
   - Show completed habits below pending habits.
   - Use compact rows on mobile and comfortable rows on desktop.

3. Summary metrics:
   - Use a responsive 2-column grid on phones.
   - Use 4 columns only when enough width exists.
   - Never display a hard-coded streak.
   - If a metric is unavailable, show “Not available” or omit it.

4. Empty state:
   - No groups: explain the next action and link to Groups.
   - Groups but no habits: explain the next action and link to Habits.
   - Loading: use stable skeleton blocks, not a shifting spinner-only layout.
   - Error: show a retry action.

5. Habit row:
   - Name and frequency are primary.
   - Date must be short and human-readable.
   - Status must be text plus color, never color alone.
   - Long names truncate without expanding the layout.

Acceptance:

- A new user understands the next action within 5 seconds.
- Dashboard works at 375px without horizontal scrolling.
- No fake numbers remain.
- Loading and error layouts do not jump when data arrives.

### Phase 5: Groups Experience

Goal: make groups feel social, clear, and easy to manage.

Edit:

- `src/app/dashboard/groups/page.tsx`
- `src/app/dashboard/groups/[groupId]/page.tsx`

Groups list:

- Show group name as the strongest text.
- Show actual active member count, not maximum capacity.
- Show a compact secondary description or “No description”.
- Make the entire card a keyboard-accessible link.
- Give the create-group action an accessible name on mobile.
- Keep empty state useful and action-oriented.

Group detail:

1. Header:
   - Group name.
   - Actual member count.
   - Owner/admin actions grouped separately from member actions.

2. Members:
   - Avatar or initials.
   - Username.
   - Role badge.
   - Active state.
   - Scrollable list on small screens if needed.

3. Invitation:
   - Clearly distinguish “Create invite” from “Copy invite link”.
   - Show success only after the invitation exists.
   - Show the actual generated link.
   - Explain that a link can be copied if email delivery is not configured.

4. Destructive actions:
   - Rename uses inline edit or dialog.
   - Delete uses a confirmation dialog with the group name.
   - Explain what related data will be removed.

Acceptance:

- Keyboard users can open a group card.
- Member count reflects active members.
- No invite link points to a nonexistent route.
- Destructive actions cannot be triggered accidentally.

### Phase 6: Habits and Check-in Experience

Goal: make habits feel like a focused fitness workflow rather than an admin table.

Edit:

- `src/app/dashboard/habits/page.tsx`
- Existing habit action/query files only when a UI contract is already missing. Do not change RLS in this phase without a separate approved schema plan.

Habit card structure:

1. Habit name.
2. Group name.
3. “Created by username”.
4. Frequency and target.
5. Primary check-in control for the habit creator.
6. `Check-ins: N` or `Check-ins today: N` only when the period is truly today.
7. List of check-in usernames and statuses.
8. Empty activity text: “No check-ins recorded for this period.”
9. Delete control only for the creator, with confirmation.

Check-in behavior:

- Keep button width stable while loading.
- Disable the button during the request.
- Treat a duplicate check-in as idempotent success, not a red failure.
- After success, update the local card immediately and refresh from the server.
- Show who checked in.
- If the user is not the creator, show `View only` and explain why if needed.
- Never show `0` when the activity query failed. Show an error state instead.

Habit creation dialog:

- Group selector.
- Name.
- Frequency.
- Target quantity.
- Clear validation.
- Mobile-safe scroll.
- Success closes the dialog and updates the list.

Acceptance:

- Creator can check in once per period.
- Repeat click does not create duplicates.
- Other members can see the habit and check-in activity.
- Other members cannot check in to someone else’s habit.
- Creator can delete their own habit after confirmation.
- The UI distinguishes empty activity from failed activity loading.

### Phase 7: Profile, Settings, Login, and Empty States

Goal: make the supporting screens feel part of the same product.

Edit:

- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/dashboard/profile/page.tsx` if it exists
- `src/app/dashboard/settings/page.tsx`

Requirements:

- Use the same spacing and field styles as habit dialogs.
- Mobile forms use one column.
- Submit button remains visible near the bottom of the viewport.
- Password fields have accessible labels and clear error messages.
- Loading states preserve layout dimensions.
- Settings sections have clear headings and short descriptions.
- Dangerous account actions are visually separated and confirmed.
- Empty profile data uses a real fallback, not broken text.

Acceptance:

- Signup, login, onboarding, profile edit, and settings work at 375px.
- Keyboard can move through every field.
- Errors are adjacent to the field that needs correction.

### Phase 8: Motion and Polish

Goal: add premium feel without distracting animation.

Use only a few meaningful animations:

- Page content fades in once.
- Lists use a short stagger of 20-40ms per item.
- Dialogs use the existing open/close motion.
- Success state can use a short scale/fade transition.

Do not:

- Animate every button on hover.
- Use bouncing or infinite motion for decoration.
- Add gradients, blobs, or ornamental orbs.
- Make motion required to understand state.

Respect `prefers-reduced-motion` by disabling nonessential animation.

Acceptance:

- Motion does not delay interaction.
- Reduced-motion users receive the same information.
- No layout shift occurs during animation.

### Phase 9: Responsive and Accessibility Verification

Test every changed screen at:

- 375 x 812
- 390 x 844
- 768 x 1024
- 1280 x 800

For each screen verify:

- No horizontal scrolling.
- No text clipped inside buttons.
- No fixed navigation overlap.
- All icons have accessible names.
- Focus ring is visible.
- Touch targets are at least 40px, preferably 44px.
- Dialogs fit and scroll.
- Long names and emails truncate safely.
- Empty, loading, error, and success states are readable.
- Dark and light themes maintain contrast.

Use this manual checklist:

- [ ] Login
- [ ] Signup
- [ ] Onboarding
- [ ] Dashboard empty state
- [ ] Dashboard with habits
- [ ] Groups empty state
- [ ] Groups with cards
- [ ] Group detail
- [ ] Invite dialog
- [ ] Habits empty state
- [ ] Habit creation dialog
- [ ] Habit card with no check-in
- [ ] Habit card after check-in
- [ ] Habit card with other member activity
- [ ] Delete habit dialog
- [ ] Delete group dialog
- [ ] Settings
- [ ] Profile
- [ ] Mobile drawer
- [ ] Mobile bottom navigation

## Validation Commands

Run after every phase:

```powershell
pnpm typecheck
pnpm lint
pnpm test
```

If the repository has a running local Supabase environment, also run:

```powershell
supabase db reset
supabase test db
```

If Docker is unavailable, do not claim database validation passed. Use the hosted Supabase SQL Editor only for explicitly approved SQL scripts and report that limitation.

## Commit Plan

Use one commit per completed phase. Use Conventional Commit messages:

- `feat: establish premium ui tokens`
- `fix: make dashboard shell mobile safe`
- `feat: improve group navigation and states`
- `feat: improve habit check-in experience`
- `feat: polish auth and settings screens`
- `test: verify responsive dashboard flows`

Do not commit generated files such as `tsconfig.tsbuildinfo` unless the repository already tracks them intentionally.

## Definition of Done

The UI plan is complete only when:

1. All dashboard screens work at 375px and 1280px.
2. Mobile navigation does not obscure content.
3. No dead navigation links remain.
4. Group cards are keyboard accessible.
5. Dialogs fit small screens and have usable close controls.
6. Habits clearly show creator, activity, check-in state, and permissions.
7. Real data is used for metrics and member counts.
8. Loading, empty, error, and success states exist for changed workflows.
9. `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass.
10. No unrelated files are reformatted or reverted.
11. The final response reports changed areas, validation results, known gaps, and the next recommended phase.

## Prompt Template For The Implementing Model

Use this prompt before each phase:

> You are implementing one phase of HabitCircle's premium UI plan. Read `CLAUDE.md`, this plan, and every target file before editing. Work only on the current phase. Preserve existing user changes. Do not change database schema, RLS, auth, money logic, API contracts, or dependencies. Make the smallest coherent edits. Use existing components, Tailwind, lucide-react, and brand tokens. After editing, run `pnpm typecheck`, `pnpm lint`, and `pnpm test`. If any command fails, stop and fix only the current phase. Report files changed, behavior improved, validation results, and remaining gaps. Do not start the next phase without explicit approval.
