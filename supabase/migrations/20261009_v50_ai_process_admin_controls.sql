-- V50: AI PROCESS admin controls, stop/restart synchronization, manual balance adjustments.

create or replace function public.admin_start_ai_process(target_user_id uuid, starting_amount numeric, process_duration_hours integer)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from public.profiles me where me.id=auth.uid() and me.role='admin' and me.approval_status='approved') then
    raise exception '관리자만 AI PROCESS를 시작할 수 있습니다.';
  end if;
  if starting_amount is null or starting_amount<=0 then raise exception '운용금액은 0보다 커야 합니다.'; end if;
  if process_duration_hours is null or process_duration_hours<0 or process_duration_hours>720 then raise exception '진행시간은 기간 미정(0) 또는 1시간~720시간이어야 합니다.'; end if;
  if not exists (select 1 from public.profiles p where p.id=target_user_id and p.approval_status='approved' and coalesce(p.role,'member')<>'admin') then
    raise exception '승인된 회원을 찾을 수 없습니다.';
  end if;

  insert into public.ai_process_sessions(user_id,status,start_amount,current_amount,total_profit,total_return,duration_hours,started_at,ends_at,completed_at,last_market_at,last_asset_symbol,last_asset_name,last_asset_type,last_market_pct,last_delta,updated_at)
  values(target_user_id,'running',starting_amount,starting_amount,0,0,process_duration_hours,now(),case when process_duration_hours=0 then null else now()+make_interval(hours=>process_duration_hours) end,null,null,null,null,null,null,null,now())
  on conflict(user_id) do update set status='running',start_amount=excluded.start_amount,current_amount=excluded.current_amount,total_profit=0,total_return=0,duration_hours=excluded.duration_hours,started_at=excluded.started_at,ends_at=excluded.ends_at,completed_at=null,last_market_at=null,last_asset_symbol=null,last_asset_name=null,last_asset_type=null,last_market_pct=null,last_delta=null,updated_at=now();
  delete from public.ai_process_logs where user_id=target_user_id;
end $$;

create or replace function public.admin_adjust_ai_process(target_user_id uuid, adjustment_type text, adjustment_amount numeric)
returns void language plpgsql security definer set search_path=public as $$
declare s public.ai_process_sessions%rowtype; before_amount numeric; after_amount numeric; new_start numeric; delta_amount numeric;
begin
  if not exists (select 1 from public.profiles me where me.id=auth.uid() and me.role='admin' and me.approval_status='approved') then raise exception '관리자만 AI PROCESS 금액을 조정할 수 있습니다.'; end if;
  if adjustment_amount is null or adjustment_amount<=0 then raise exception '조정 금액은 0보다 커야 합니다.'; end if;
  if adjustment_type not in ('deposit','profit','loss') then raise exception '지원하지 않는 조정 유형입니다.'; end if;
  select * into s from public.ai_process_sessions where user_id=target_user_id for update;
  if not found then raise exception 'AI PROCESS 세션을 찾을 수 없습니다.'; end if;
  if s.status<>'running' then raise exception '진행 중인 AI PROCESS만 조정할 수 있습니다.'; end if;
  before_amount:=s.current_amount; new_start:=s.start_amount;
  if adjustment_type='deposit' then new_start:=s.start_amount+adjustment_amount; after_amount:=s.current_amount+adjustment_amount;
  elsif adjustment_type='profit' then after_amount:=s.current_amount+adjustment_amount;
  else after_amount:=greatest(0,s.current_amount-adjustment_amount); end if;
  delta_amount:=after_amount-before_amount;
  update public.ai_process_sessions set start_amount=new_start,current_amount=after_amount,total_profit=after_amount-new_start,total_return=case when new_start>0 then ((after_amount-new_start)/new_start)*100 else 0 end,last_delta=delta_amount,last_market_at=now(),last_asset_symbol='ADMIN',last_asset_name=case adjustment_type when 'deposit' then '투자금 추가' when 'profit' then '수익금 추가' else '손실 반영' end,last_asset_type='manual',last_market_pct=null,updated_at=now() where user_id=target_user_id;
  insert into public.ai_process_logs(process_id,user_id,market_at,asset_symbol,asset_name,asset_type,market_pct,amount_before,delta,amount_after,result_type)
  values(s.id,target_user_id,now(),'ADMIN',case adjustment_type when 'deposit' then '투자금 추가' when 'profit' then '수익금 추가' else '손실 반영' end,'manual',null,before_amount,delta_amount,after_amount,case when adjustment_type='loss' then 'loss' else 'profit' end);
end $$;

create or replace function public.admin_restart_ai_process(target_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare s public.ai_process_sessions%rowtype;
begin
  if not exists (select 1 from public.profiles me where me.id=auth.uid() and me.role='admin' and me.approval_status='approved') then raise exception '관리자만 AI PROCESS를 재시작할 수 있습니다.'; end if;
  select * into s from public.ai_process_sessions where user_id=target_user_id for update;
  if not found then raise exception 'AI PROCESS 세션을 찾을 수 없습니다.'; end if;
  if s.status='running' then raise exception '이미 진행 중인 AI PROCESS입니다.'; end if;
  update public.ai_process_sessions set status='running',start_amount=current_amount,total_profit=0,total_return=0,started_at=now(),ends_at=case when coalesce(duration_hours,0)=0 then null else now()+make_interval(hours=>duration_hours) end,completed_at=null,last_market_at=null,last_asset_symbol=null,last_asset_name=null,last_asset_type=null,last_market_pct=null,last_delta=null,updated_at=now() where user_id=target_user_id;
  delete from public.ai_process_logs where user_id=target_user_id;
end $$;

create or replace function public.get_ai_process_public_sessions()
returns table(user_id uuid,nickname text,avatar text,status text,start_amount numeric,current_amount numeric,total_profit numeric,total_return numeric,duration_hours integer,started_at timestamptz,ends_at timestamptz,last_asset_symbol text,last_asset_name text,last_asset_type text,last_market_pct numeric,last_delta numeric,updated_at timestamptz)
language sql security definer set search_path=public as $$
  select s.user_id,p.nickname,p.avatar,s.status,s.start_amount,s.current_amount,s.total_profit,s.total_return,s.duration_hours,s.started_at,s.ends_at,s.last_asset_symbol,s.last_asset_name,s.last_asset_type,s.last_market_pct,s.last_delta,s.updated_at
  from public.ai_process_sessions s join public.profiles p on p.id=s.user_id
  where p.approval_status='approved'
    and exists(select 1 from public.profiles me where me.id=auth.uid() and me.approval_status='approved')
    and (s.status='running' or (s.status='stopped' and exists(select 1 from public.profiles me2 where me2.id=auth.uid() and me2.role='admin' and me2.approval_status='approved')))
  order by case when s.status='running' then 0 else 1 end,s.updated_at desc,p.nickname asc;
$$;
