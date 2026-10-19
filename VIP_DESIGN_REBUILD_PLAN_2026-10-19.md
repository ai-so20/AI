# VIP Design Rebuild — 2026-10-19

## Target
Private Financial Editorial + Quiet System Motion

The `26` project remains untouched as the recovery/reference build. All redesign work is isolated on `ai-so20/AI` branch `design-rebuild-20261019` until visual review.

## Deployment policy
- Parts 1–5 were completed without intermediate Vercel preview deployments.
- `26` remains untouched.
- The first visual-review deployment is created only after Part 5 source review.
- Further deploys should batch user feedback rather than deploy each small adjustment.

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
- muted amber Event
- muted violet Reward/private support
- muted green positive / salmon negative
- fixed spacing rhythm: 4 / 8 / 12 / 20 / 32 / 48
- limited radius vocabulary
- quiet motion timing tokens

## Existing design debt found in Part 1
- `app/globals.css` is approximately 188 KB and carries multiple generations of unrelated UI rules.
- `app/page.js` is approximately 245 KB and still owns most Event / Reward UI in one large client page.
- AI PROCESS styling is split across `globals.css`, `ai-process-p3.css`, `ai-process-controls.css`, and `ai-process-mobile.css`.
- Root layout still contains an inline dark body background, so global presentation is not fully owned by the stylesheet layer.
- AI PROCESS has extracted components, while other primary product areas are less componentized, producing inconsistent structural boundaries.

## Part 2 — Event
Completed on the isolated branch.
- Current event is visually dominant.
- Remaining sessions use editorial rows instead of a repeated card wall.
- Event uses a restrained amber accent and quiet reveal motion.
- The repository does not contain the separate 30-count Attendance page originally assumed by the design brief. Only `event_type="attendance"` exists inside the event engine, so no synthetic attendance page/data model was introduced.

## Part 3 — AI PROCESS
Completed on the isolated branch.
- Current valuation and return are the primary hero information.
- KPI cards were replaced by an editorial data rail.
- A compact process rail was introduced.
- Chart / market / history surfaces are visually flattened toward editorial sections rather than equal dashboard cards.
- Steel/Midnight is the single primary AI accent; profit/loss retain semantic colors.
- Completed sessions display progress as 100% without changing profit, valuation, or target calculations.
- Existing 3-minute process behavior and data/service paths remain unchanged.

## Part 4 — Private Reward / Support
Completed on the isolated branch.
- The repository's actual reward/support surface is the existing private-chat flow rather than a separate reward-center application.
- Its existing member intro was converted toward a restrained Private Ledger/benefits header language.
- Existing chat, delivery messages, links, push behavior and reward data paths were preserved.
- Violet is restricted to the reward/private-support accent role.

## Part 5 — Consolidation / QA
Source review completed before first deployment.
- Compared `design-rebuild-20261019` against `main`: the redesign is isolated to the design plan, root stylesheet import, two extracted AI PROCESS components, and `app/vip-design-system.css`.
- No Supabase schema, RPC, API route, service, simulation engine, payout/reward data path, event participation logic, or chat delivery logic was changed by this redesign branch.
- No additional V17/V18-style override file was added during finalization; the rebuild remains concentrated in one design-system stylesheet plus source-native AI component changes.
- Legacy CSS was **not deleted blindly** before visual verification. Removal will happen only after the first deployed visual QA proves the replacement selectors are safe.
- Motion remains limited to event reveal / AI running-state pulse / ledger reveal, with no card-hover lift, neon, particle, or decorative loop system.
- Final visual QA is intentionally performed on a single Vercel deployment after this source freeze.

## First visual review checkpoint
After this document is committed, deploy the exact branch SHA to the Vercel `ai` project only. Do not deploy or modify `26`.
