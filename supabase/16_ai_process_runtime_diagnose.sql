-- AI PROCESS runtime diagnostic (READ ONLY)
-- 목적: 시장 가격은 보이지만 PROCESS 금액/차트가 움직이지 않는 원인을 확인합니다.
-- 데이터 변경 없음. Supabase SQL Editor에서 그대로 실행하세요.

-- 1) 필요한 확장
select
  'extensions' as section,
  extname as item,
  extversion as value
from pg_extension
where extname in ('pg_cron','pg_net')
order by extname;

-- 2) 핵심 함수 존재 여부
select
  'functions' as section,
  x.name as item,
  case when to_regprocedure(x.signature) is null then 'MISSING' else 'OK' end as value
from (values
  ('run_ai_process_market_tick','public.run_ai_process_market_tick(timestamp with time zone,timestamp with time zone,jsonb)'),
  ('configure_ai_process_market_cron','public.configure_ai_process_market_cron(text)'),
  ('get_ai_process_public_sessions','public.get_ai_process_public_sessions()'),
  ('admin_start_ai_process','public.admin_start_ai_process(uuid,numeric,integer)')
) as x(name, signature);

-- 3) V11/V12 PROCESS 컬럼 존재 여부
select
  'session_columns' as section,
  c.column_name as item,
  c.data_type as value
from information_schema.columns c
where c.table_schema='public'
  and c.table_name='ai_process_sessions'
  and c.column_name in (
    'id','user_id','status','start_amount','current_amount','total_profit','total_return',
    'last_market_at','last_market_snapshot_at','last_tick_at','snapshot_tick_count','last_delta','updated_at'
  )
order by c.ordinal_position;

-- 4) 시장 엔진 Cron 등록 상태
select
  'cron' as section,
  jobname as item,
  concat('active=',active,', schedule=',schedule,', command=',command) as value
from cron.job
where jobname in ('vip-ai-process-market','vip-ai-process-log-compact')
order by jobname;

-- 5) 진행 중 PROCESS 실제 갱신 상태
select
  'running_sessions' as section,
  s.id::text as process_id,
  p.nickname,
  s.status,
  s.start_amount,
  s.current_amount,
  s.total_profit,
  s.total_return,
  s.last_tick_at,
  s.last_market_at,
  s.last_market_snapshot_at,
  s.snapshot_tick_count,
  s.last_asset_symbol,
  s.last_market_pct,
  s.last_delta,
  s.updated_at
from public.ai_process_sessions s
join public.profiles p on p.id=s.user_id
where s.status='running'
order by s.started_at desc;

-- 6) 시장 캐시가 실제로 5분마다 바뀌는지 확인
select
  'market_cache' as section,
  cache_key,
  fetched_at,
  now() - fetched_at as cache_age,
  payload->>'updatedAt' as payload_updated_at,
  payload->>'provider' as provider,
  jsonb_array_length(coalesce(payload->'quotes','[]'::jsonb)) as quote_count
from public.market_sim_cache
where cache_key='main';

-- 7) 최근 PROCESS 로그
select
  'latest_logs' as section,
  l.process_id::text,
  p.nickname,
  l.market_at,
  l.asset_symbol,
  l.market_pct,
  l.amount_before,
  l.delta,
  l.amount_after,
  l.result_type,
  l.created_at
from public.ai_process_logs l
join public.profiles p on p.id=l.user_id
order by l.created_at desc
limit 20;

-- 8) 최근 Cron 실행 결과 (pg_cron이 있을 때)
select
  'cron_history' as section,
  d.jobid::text as item,
  concat('status=',d.status,', start=',d.start_time,', end=',d.end_time,', message=',coalesce(d.return_message,'')) as value
from cron.job_run_details d
join cron.job j on j.jobid=d.jobid
where j.jobname='vip-ai-process-market'
order by d.start_time desc
limit 10;
