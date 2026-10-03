-- AI PROCESS 기간 미정 복구
-- 0시간을 "기간 미정"으로 처리하고, ends_at을 NULL로 저장합니다.
-- 기존 1~720시간 방식은 그대로 유지됩니다.

begin;

create or replace function public.admin_start_ai_process(
  target_user_id uuid,
  starting_amount numeric,
  process_duration_hours integer
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_duration integer;
  v_ends_at timestamptz;
begin
  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.role = 'admin'
      and me.approval_status = 'approved'
  ) then
    raise exception '관리자만 AI PROCESS를 시작할 수 있습니다.';
  end if;

  if starting_amount is null or starting_amount <= 0 then
    raise exception '운용금액은 0보다 커야 합니다.';
  end if;

  -- 0 = 기간 미정 / 1~720 = 시간 지정
  if process_duration_hours is null or process_duration_hours < 0 or process_duration_hours > 720 then
    raise exception '진행시간은 0(기간 미정) 또는 1시간~720시간이어야 합니다.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = target_user_id
      and p.approval_status = 'approved'
      and coalesce(p.role,'member') <> 'admin'
  ) then
    raise exception '승인된 회원을 찾을 수 없습니다.';
  end if;

  if process_duration_hours = 0 then
    -- duration_hours 컬럼의 기존 1~720 제약을 유지하기 위해 내부값은 720을 사용하고,
    -- 실제 기간 미정 여부는 ends_at IS NULL 로 판별합니다.
    v_duration := 720;
    v_ends_at := null;
  else
    v_duration := process_duration_hours;
    v_ends_at := now() + make_interval(hours => process_duration_hours);
  end if;

  insert into public.ai_process_sessions(
    user_id,status,start_amount,current_amount,total_profit,total_return,duration_hours,
    started_at,ends_at,completed_at,last_market_at,last_asset_symbol,last_asset_name,
    last_asset_type,last_market_pct,last_delta,updated_at
  ) values (
    target_user_id,'running',starting_amount,starting_amount,0,0,v_duration,
    now(),v_ends_at,null,null,null,null,null,null,null,now()
  )
  on conflict(user_id) do update set
    status='running',
    start_amount=excluded.start_amount,
    current_amount=excluded.current_amount,
    total_profit=0,
    total_return=0,
    duration_hours=excluded.duration_hours,
    started_at=excluded.started_at,
    ends_at=excluded.ends_at,
    completed_at=null,
    last_market_at=null,
    last_asset_symbol=null,
    last_asset_name=null,
    last_asset_type=null,
    last_market_pct=null,
    last_delta=null,
    updated_at=now();

  delete from public.ai_process_logs where user_id = target_user_id;
end;
$$;

grant execute on function public.admin_start_ai_process(uuid,numeric,integer) to authenticated;

commit;
