-- V31 AI PROCESS 85/15 distribution fix
-- Applied to production Supabase on 2026-10-07.
-- Behavior: every 20 market snapshots => 17 profit / 3 loss, distributed per process.
-- Market movement stays factual in market_pct; PROCESS result direction is applied to delta.

-- Production function definition is managed in Supabase migration:
-- fix_ai_process_85_15_distribution
