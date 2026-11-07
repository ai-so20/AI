-- REVIEW-ONLY SQL DRAFT. DO NOT APPLY TO ANY LIVE SUPABASE PROJECT.
-- Prepared for isolated AI project (vyjtpushaumjedcfwxbn), never original 26.
-- Risk discovered from read-only metadata: public event tables are RLS OFF and
-- anon has SELECT/INSERT/UPDATE/DELETE privileges; some SECURITY DEFINER event
-- engine functions also grant anon EXECUTE without any auth.uid() checks.
--
-- This is a candidate for STAGING REVIEW, not an approved production migration.
-- Apply only after backup and side-by-side API, RPC, admin and cron tests.
-- WARNING: Existing UI / admin RPCs can break if their privilege model differs.
-- Does NOT create, modify, assign, delete, or inspect any prize URL, winner,
-- check-in, profit, member or event record; does NOT alter pg_cron jobs.
--
-- Key read-only source evidence:
-- * AI app/page.js admin uses direct SELECT from event_prize_catalog.
-- * Other event display/submit flows use get_auto_events/join_auto_event RPCs.
-- * AI cron.job: vip-auto-event-engine every minute invokes run_auto_event_engine.
-- * setup_event_game, finish_auto_event and run_auto_event_engine
--   have no user-auth checks and currently allow anon EXECUTE.
--
-- This draft *intentionally* leaves the public event read-RPC (get_auto_events)
-- callable by ANY authenticated account, including unapproved accounts.
-- Harden its FUNCTION BODY with role and approval checks before production.
-- The current get_auto_events also returns event_entries.result_text for active
-- quizzes; join_auto_event stores '정답 제출 완료' on correct quiz answers.
-- This reveals success before event completion via RPC, even if UI hides it.
-- Add CASE WHEN e.status='completed' THEN result_text ELSE NULL END in the
-- read-RPC (and preferably make pre-completion quiz status text neutral).
-- Restrict join_auto_event to role='member' as well as approved status.
-- Do not claim these commands alone fully secure the application.

begin;

-- Disable direct Data API access to confidential or mutable event tables.
-- All privileged event mutation should happen through separately audited RPCs.
alter table public.events enable row level security;
alter table public.event_entries enable row level security;
alter table public.event_winners enable row level security;
alter table public.event_game_secrets enable row level security;
alter table public.event_quiz_bank enable row level security;
alter table public.event_prize_catalog enable row level security;
alter table public.event_gift_inventory enable row level security;
alter table public.event_reward_deliveries enable row level security;

revoke all on table public.events from public, anon, authenticated;
revoke all on table public.event_entries from public, anon, authenticated;
revoke all on table public.event_winners from public, anon, authenticated;
revoke all on table public.event_game_secrets from public, anon, authenticated;
revoke all on table public.event_quiz_bank from public, anon, authenticated;
revoke all on table public.event_prize_catalog from public, anon, authenticated;
revoke all on table public.event_gift_inventory from public, anon, authenticated;
revoke all on table public.event_reward_deliveries from public, anon, authenticated;

-- Existing AI administrator UI SELECTs the catalog directly. Retain only this
-- owner-checked SELECT; writes still must go via separately audited admin RPCs.
grant select on table public.event_prize_catalog to authenticated;
create policy ai_event_catalog_admin_read
on public.event_prize_catalog
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.approval_status = 'approved'
  )
);

-- Explicitly avoid PUBLIC's implicit function EXECUTE inheritance.
-- These operational functions should run only from trusted internal callers
-- (e.g. PostgreSQL cron) after validating their owning role and execution path.
revoke execute on function public.setup_event_game(uuid)
  from public, anon, authenticated;
revoke execute on function public.finish_auto_event(uuid)
  from public, anon, authenticated;
revoke execute on function public.run_auto_event_engine()
  from public, anon, authenticated;

-- Only authenticated users may call these entry points, but the function BODY
-- must also enforce authorized membership/admin roles (see notes above).
revoke execute on function public.get_auto_events()
  from public, anon, authenticated;
revoke execute on function public.join_auto_event(uuid,text)
  from public, anon, authenticated;
revoke execute on function public.get_admin_event_operations()
  from public, anon, authenticated;
grant execute on function public.get_auto_events() to authenticated;
grant execute on function public.join_auto_event(uuid,text) to authenticated;
grant execute on function public.get_admin_event_operations() to authenticated;

commit;

-- STAGING ACCEPTANCE CHECKLIST (mandatory before considering deployment):
-- [ ] pg_cron owner retains permission to invoke run_auto_event_engine().
-- [ ] Its internal setup_event_game()/finish_auto_event() calls still function.
-- [ ] At scheduled times events still generate, start and finish as before.
-- [ ] Anonymous HTTP REST cannot SELECT/INSERT/UPDATE/DELETE protected tables.
-- [ ] Anonymous HTTP RPC cannot execute setup_event_game, finish_auto_event,
--     run_auto_event_engine, get_auto_events or join_auto_event.
-- [ ] Unapproved authenticated account cannot obtain event data via
--     get_auto_events (needs further function-body hardening beyond this draft).
-- [ ] Approved member can read allowed event metadata only, not quiz answers.
-- [ ] Approved member can submit one event entry only via join_auto_event.
-- [ ] Approved admin's existing event_prize_catalog SELECT still succeeds.
-- [ ] Approved admin's own admin RPCs still work without direct-table writes.
-- [ ] Quiz correct_option, secret_answer, quiz_answer, gift_url
--     inaccessible to anon/unapproved before and after the event.
-- [ ] Existing RLS ON group_messages and private chats are unchanged.
-- [ ] No existing table rows, gift inventory, user accounts or cron jobs change.
-- [ ] Review all other SECURITY DEFINER public functions and ACLs; a single
--     unreviewed function can still bypass these table-level protections.
