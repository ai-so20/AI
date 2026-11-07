-- REVIEW ONLY. NOT A MIGRATION. DO NOT EXECUTE ON PRODUCTION WITHOUT USER APPROVAL.
-- Target exclusively the independent AI Supabase project (vyjtpushaumjedcfwxbn) after a backup
-- and a successful staging test. Never run against the original 26 project.
-- No gift inventory, payout, prize assignment, 26-user migration or existing attendance_records changes.
--
-- Requirements: member profile is authenticated, role='member', approval_status='approved'.
-- Date authority: database transaction at Asia/Seoul. One check-in per member per KST date.
-- 30-check-in milestone is informational ONLY; no automatic gift is granted.
-- RPC return fields match app/design-attendance/page.js.
--
-- SECURITY NOTE: Review this entire transaction and verify ownership/permissions in a test DB.
-- SECURITY DEFINER is intentional: clients can only insert via explicit approved-member RPC.
-- Explicitly revoke PUBLIC/anon EXECUTE as well as direct table mutation permissions.

begin;

create table public.ai_daily_checkins (
  member_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  checked_at timestamptz not null default now(),
  constraint ai_daily_checkins_pkey primary key(member_id, attendance_date)
);

-- Preserve 30/60/90/... milestones without creating gift inventory or deliveries.
create table public.ai_attendance_milestones (
  member_id uuid not null references public.profiles(id) on delete cascade,
  milestone_count integer not null check (milestone_count > 0 and milestone_count % 30 = 0),
  reached_at timestamptz not null default now(),
  constraint ai_attendance_milestones_pkey primary key(member_id, milestone_count)
);

-- Direct mutation is denied; privileged RPC performs the strictly checked insert.
alter table public.ai_daily_checkins enable row level security;
alter table public.ai_attendance_milestones enable row level security;

revoke all on table public.ai_daily_checkins from public, anon, authenticated;
revoke all on table public.ai_attendance_milestones from public, anon, authenticated;
grant select on table public.ai_daily_checkins to authenticated;
grant select on table public.ai_attendance_milestones to authenticated;

create policy "ai_daily_checkins_owner_read"
on public.ai_daily_checkins
as permissive for select to authenticated
using (
  member_id = (select auth.uid())
  and exists (
    select 1 from public.profiles as p
    where p.id = (select auth.uid())
      and p.role = 'member'
      and p.approval_status = 'approved'
  )
);

create policy "ai_attendance_milestones_owner_read"
on public.ai_attendance_milestones
as permissive for select to authenticated
using (
  member_id = (select auth.uid())
  and exists (
    select 1 from public.profiles as p
    where p.id = (select auth.uid())
      and p.role = 'member'
      and p.approval_status = 'approved'
  )
);

-- Read-only RPC returns the original client contract, using this DB's own records.
create function public.get_daily_attendance_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_total integer;
  v_checked boolean;
  v_pending boolean;
  v_target integer;
begin
  if v_user is null or not exists (
    select 1 from public.profiles as p
    where p.id = v_user and p.role = 'member' and p.approval_status = 'approved'
  ) then
    raise exception 'Approved member authentication required' using errcode = '42501';
  end if;

  select count(*)::integer into v_total
  from public.ai_daily_checkins as a where a.member_id = v_user;

  select exists (
    select 1 from public.ai_daily_checkins as a
    where a.member_id = v_user and a.attendance_date = v_today
  ) into v_checked;

  select exists (
    select 1 from public.ai_attendance_milestones as m
    where m.member_id = v_user
  ) into v_pending;

  v_target := (v_total / 30 + 1) * 30;

  return jsonb_build_object(
    'checked_today', v_checked,
    'total_count', v_total,
    'reward_ready', v_pending,
    'next_reward_at', v_target,
    'reward_status', 'deferred',
    'gift_delivered', false
  );
end;
$$;

-- Atomic check-in. Primary key plus ON CONFLICT is the duplicate-request guard.
create function public.check_daily_attendance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_new boolean := false;
  v_total integer;
  v_target integer;
  v_milestone boolean;
begin
  if v_user is null or not exists (
    select 1 from public.profiles as p
    where p.id = v_user and p.role = 'member' and p.approval_status = 'approved'
  ) then
    raise exception 'Approved member authentication required' using errcode = '42501';
  end if;

  insert into public.ai_daily_checkins (member_id, attendance_date)
  values (v_user, v_today)
  on conflict (member_id, attendance_date) do nothing
  returning true into v_new;

  select count(*)::integer into v_total
  from public.ai_daily_checkins as a where a.member_id = v_user;

  if coalesce(v_new, false) and v_total > 0 and v_total % 30 = 0 then
    insert into public.ai_attendance_milestones (member_id, milestone_count)
    values (v_user, v_total)
    on conflict (member_id, milestone_count) do nothing;
  end if;

  select exists (
    select 1 from public.ai_attendance_milestones as m
    where m.member_id = v_user
  ) into v_milestone;

  v_target := (v_total / 30 + 1) * 30;

  return jsonb_build_object(
    'success', true,
    'newly_checked', coalesce(v_new, false),
    'checked_today', true,
    'total_count', v_total,
    'reward_ready', v_milestone,
    'next_reward_at', v_target,
    'message', case when coalesce(v_new, false)
       then '오늘 출석이 완료되었습니다.' else '오늘은 이미 출석했습니다.' end,
    'reward_result', jsonb_build_object(
      'success', false, 'reason', 'reward_deferred'
    )
  );
end;
$$;

-- Function creation may grant EXECUTE to PUBLIC by default; revoke explicitly.
revoke all on function public.get_daily_attendance_status() from public, anon, authenticated;
revoke all on function public.check_daily_attendance() from public, anon, authenticated;
grant execute on function public.get_daily_attendance_status() to authenticated;
grant execute on function public.check_daily_attendance() to authenticated;

commit;

-- REVIEW CHECKLIST BEFORE APPLYING TO A TEST DB:
-- [ ] Verify these objects do not exist with different definitions.
-- [ ] Verify object owner, RLS, privileges, and both RPC proconfig/search_path.
-- [ ] Call both RPCs as anon: access denied.
-- [ ] Call both as signed-in unapproved user/admin: access denied.
-- [ ] Approved member A: 0 -> 1 today; duplicate same-day check remains 1.
-- [ ] Two simultaneous checks for member A: only one row for KST date.
-- [ ] Member B cannot SELECT member A's records or milestones; cannot INSERT either table directly.
-- [ ] KST 23:59 -> 00:00 test in isolated environment, no client timezone dependence.
-- [ ] At count 30: a pending milestone ledger row is created ONCE, but no gift URL/stock/delivery row.
-- [ ] At count 31: milestone 30 remains recorded, reward_ready stays true while unpaid.
-- [ ] Repeated count-30 check produces no duplicate, no gift payment.
-- [ ] Confirm previously existing attendance_records and events remain unchanged.
