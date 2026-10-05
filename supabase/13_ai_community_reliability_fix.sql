-- ============================================================
-- AI PROCESS V17.2 - AI COMMUNITY RELIABILITY FIX
-- 2026-10-05
--
-- 목적
-- 1) 실제회원 메시지 뒤 3~4명의 반응이 끝까지 이어지도록 보조
-- 2) AI 자발대화가 별도 1분 엔진으로 계속 진행되도록 구성
-- 3) 기존 market cron 주소가 있으면 AI community cron을 자동 연결
-- 4) 테스트 중 남아 있는 오래된 일반/자발대화 예약을 정리
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 기존 V17 설정을 조금 더 활기 있게 조정합니다.
-- 실제회원 대화가 있으면 여전히 그것이 최우선입니다.
update public.ai_community_settings
set autonomous_gap_min_minutes = 6,
    autonomous_gap_max_minutes = 14,
    human_quiet_minutes = 4,
    updated_at = now()
where id = 1;

-- 패치 적용 직후 새 흐름으로 테스트할 수 있도록 이전 일반 예약만 정리합니다.
update public.ai_reply_queue q
set status = 'cancelled'
from public.ai_conversation_threads t
where q.thread_id = t.id
  and q.status = 'queued'
  and t.thread_type in ('human_reply','welcome','autonomous');

update public.ai_conversation_threads
set status = 'cancelled',
    completed_at = now()
where status = 'active'
  and thread_type in ('human_reply','welcome','autonomous');

-- 적용 후 약 3분 뒤부터 자발대화 시작 여부를 확인할 수 있게 합니다.
update public.ai_community_state
set next_autonomous_at = now() + interval '3 minutes',
    updated_at = now()
where id = 1;

-- ------------------------------------------------------------
-- 전용 AI COMMUNITY 1분 Cron
-- 시장 엔진과 별도로 예약 큐/자발대화를 깨우기 위한 용도입니다.
-- ------------------------------------------------------------
create or replace function public.configure_ai_community_cron(base_url text)
returns text
language plpgsql
security definer
set search_path to 'public','cron','net'
as $$
declare
  v_job_id bigint;
  v_base text;
  v_url text;
begin
  if base_url is null or length(trim(base_url)) < 8 then
    raise exception 'Vercel 주소를 입력해주세요.';
  end if;

  v_base := regexp_replace(trim(base_url), '/+$', '');
  v_base := regexp_replace(v_base, '/api/.*$', '');
  v_url := v_base || '/api/ai-community-tick';

  for v_job_id in
    select jobid from cron.job where jobname = 'vip-ai-community'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'vip-ai-community',
    '* * * * *',
    format('select net.http_get(url := %L);', v_url)
  );

  return v_url;
end;
$$;

revoke all on function public.configure_ai_community_cron(text) from public, anon, authenticated;

-- 기존 AI PROCESS market cron이 이미 설정되어 있으면
-- 그 Vercel 주소를 읽어 AI community cron도 자동으로 연결합니다.
do $$
declare
  v_command text;
  v_existing_url text;
  v_base text;
begin
  select command
  into v_command
  from cron.job
  where jobname = 'vip-ai-process-market'
  order by jobid desc
  limit 1;

  if v_command is not null then
    v_existing_url := substring(v_command from 'https?://[^'']+');

    if v_existing_url is not null then
      v_base := regexp_replace(v_existing_url, '/api/market-sim.*$', '');
      perform public.configure_ai_community_cron(v_base);
    end if;
  end if;
end;
$$;

-- 결과 확인용
select
  (select count(*) from public.profiles
    where account_type = 'ai_character'
      and approval_status = 'approved') as ai_accounts,
  (select count(*) from public.ai_reply_queue
    where status = 'queued') as queued_replies,
  (select count(*) from cron.job
    where jobname = 'vip-ai-community') as community_cron_jobs,
  (select next_autonomous_at from public.ai_community_state where id = 1) as next_autonomous_at,
  (select human_quiet_minutes from public.ai_community_settings where id = 1) as human_quiet_minutes,
  (select autonomous_gap_min_minutes from public.ai_community_settings where id = 1) as autonomous_gap_min_minutes,
  (select autonomous_gap_max_minutes from public.ai_community_settings where id = 1) as autonomous_gap_max_minutes;
