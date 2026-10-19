# VIP Design Rebuild — 2026-10-19

## Target
Private Financial Editorial + Quiet System Motion

The `26` project remains untouched as the recovery/reference build. All redesign work is isolated on `ai-so20/AI` branch `design-rebuild-20261019` until the final review.

## Deployment policy
- Vercel Preview Deployments are disabled during Parts 1–5.
- Do not deploy after individual edits.
- Work on the isolated redesign branch.
- Re-enable previews only if a specific visual inspection is required.
- Prefer one consolidated production deployment after Part 5.

## Core rules
1. One page = one primary accent. Positive/negative semantic colors are the only exceptions.
2. Do not map one piece of information to one card.
3. Same role = same component language.
4. Different importance = clearly different scale, spacing and structure.
5. Prefer typography, divider, rail and row over boxed cards.
6. Use progressive disclosure for secondary data.
7. Motion communicates state; it is not decoration.
8. VIP is communicated by restraint, private-member language and personalization — not gold, crowns or luxury clichés.

## Foundation tokens
Source of truth: `app/vip-design-system.css`
- off-white / white / charcoal surfaces
- midnight / steel AI language
- muted amber Event + Attendance
- muted violet Reward
- muted green positive / salmon negative
- fixed spacing rhythm: 4 / 8 / 12 / 20 / 32 / 48
- limited radius vocabulary
- quiet motion timing tokens

## Existing design debt found in Part 1
- `app/globals.css` is approximately 188 KB and carries multiple generations of unrelated UI rules.
- `app/page.js` is approximately 245 KB and still owns most Event / Attendance / Reward UI in one large client page.
- AI PROCESS styling is split across `globals.css`, `ai-process-p3.css`, `ai-process-controls.css`, and `ai-process-mobile.css`.
- Root layout still contains an inline dark body background, so global presentation is not fully owned by the stylesheet layer.
- AI PROCESS has extracted components, while other primary product areas are less componentized, producing inconsistent structural boundaries.
- Current AI styles still include repeated same-size dark cards / panels, gold-brown accents and nested boxed KPI groups, which directly conflicts with the new editorial direction.

## Part 2 — Event + Attendance
- Current event is the dominant hero/surface.
- Remaining sessions become editorial rows, not repeated cards.
- Attendance becomes an Editorial Attendance Calendar: thin rules, typography, subtle completion marks; no game-like stamp board styling.
- Event/Attendance share one amber accent family but have different information composition.
- Add only quiet status motion.

## Part 3 — AI PROCESS
- Reduce dashboard fragmentation.
- Hero contains current value, return and essential status.
- KPI cards become a data rail.
- Market / state-change use the same fold header language.
- Secondary data is progressively disclosed.
- Process stages become a rail/system diagram rather than a stack of cards.
- Fix completed-state progress display so completed reads 100% without forcing profit to target.
- Reassess indefinite-duration support separately; do not silently reintroduce it.

## Part 4 — Reward Center
- Shift from generic support/chat visual language to Private Ledger.
- Restrict violet to accent/status roles.
- Reuse shared page-header and row language.

## Part 5 — Consolidation / QA
- Absorb page-specific overrides into stable page sheets.
- Remove obsolete/duplicate selectors only after replacements are verified.
- Reduce structural wrappers where safe.
- Unify icon stroke language and motion timing.
- Mobile spacing/type/alignment audit.
- Re-enable deployment flow only after final source review.
