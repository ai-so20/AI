-- V44: typed event rewards, reward delivery tracking, AI PROCESS demo sessions.

alter table public.event_prize_catalog add column if not exists reward_type text not null default 'physical';
alter table public.event_prize_catalog add column if not exists face_value integer;
alter table public.event_prize_catalog add column if not exists stock_qty integer not null default 1;
alter table public.event_prize_catalog add column if not exists used_qty integer not null default 0;
alter table public.event_prize_catalog add column if not exists ai_demo_amount numeric;
alter table public.event_prize_catalog add column if not exists ai_demo_minutes integer;
alter table public.event_prize_catalog add column if not exists notes text;

do $$ begin
  alter table public.event_prize_catalog add constraint event_prize_catalog_reward_type_check check (reward_type in ('physical','ai_process'));
exception when duplicate_object then null; end $$;

alter table public.events add column if not exists prize_catalog_id uuid references public.event_prize_catalog(id) on delete set null;

create table if not exists public.event_reward_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  winner_id uuid references public.event_winners(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  prize_catalog_id uuid references public.event_prize_catalog(id) on delete set null,
  reward_type text not null default 'physical',
  reward_name text not null,
  status text not null default 'pending',
  delivery_note text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique(winner_id)
);

do $$ begin
  alter table public.event_reward_deliveries add constraint event_reward_deliveries_type_check check (reward_type in ('physical','ai_process'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.event_reward_deliveries add constraint event_reward_deliveries_status_check check (status in ('pending','ready','delivered'));
exception when duplicate_object then null; end $$;

create index if not exists event_reward_deliveries_member_idx on public.event_reward_deliveries(member_id, created_at desc);
create index if not exists event_reward_deliveries_status_idx on public.event_reward_deliveries(status, created_at desc);

create table if not exists public.ai_process_demo_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'event',
  status text not null default 'running',
  start_amount numeric not null default 10000,
  current_amount numeric not null default 10000,
  total_profit numeric not null default 0,
  total_return numeric not null default 0,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  completed_at timestamptz,
  last_tick_at timestamptz,
  last_asset_symbol text,
  last_asset_name text,
  last_asset_type text,
  last_market_pct numeric,
  last_delta numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ai_process_demo_one_running_per_user on public.ai_process_demo_sessions(user_id) where status='running';

create table if not exists public.ai_process_demo_logs (
  id bigserial primary key,
  session_id uuid not null references public.ai_process_demo_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  market_at timestamptz not null default now(),
  asset_symbol text,
  asset_name text,
  asset_type text,
  market_pct numeric,
  amount_before numeric,
  delta numeric,
  amount_after numeric,
  result_type text,
  created_at timestamptz not null default now()
);
create index if not exists ai_process_demo_logs_session_idx on public.ai_process_demo_logs(session_id, market_at desc);

create or replace function public.normalize_event_prize_catalog_id()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.prize_catalog_id is null and new.prize is not null then
    select id into new.prize_catalog_id from public.event_prize_catalog
    where is_active=true and lower(name)=lower(new.prize)
    order by is_selected desc, updated_at desc limit 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_normalize_event_prize_catalog_id on public.events;
create trigger trg_normalize_event_prize_catalog_id before insert or update of prize,prize_catalog_id on public.events
for each row execute function public.normalize_event_prize_catalog_id();

create or replace function public.admin_add_event_reward(
  p_name text,
  p_reward_type text default 'physical',
  p_face_value integer default null,
  p_stock_qty integer default 1,
  p_ai_demo_amount numeric default null,
  p_ai_demo_minutes integer default null,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_name text := btrim(coalesce(p_name,''));
begin
  if not public.is_current_user_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  if length(v_name)<2 then raise exception '상품명을 2자 이상 입력해주세요.'; end if;
  if p_reward_type not in ('physical','ai_process') then raise exception '지원하지 않는 상품 유형입니다.'; end if;
  if p_reward_type='ai_process' and (coalesce(p_ai_demo_amount,0)<=0 or coalesce(p_ai_demo_minutes,0)<3) then
    raise exception 'AI PROCESS 혜택은 체험금과 3분 이상의 진행시간이 필요합니다.';
  end if;
  insert into public.event_prize_catalog(name,is_active,is_selected,reward_type,face_value,stock_qty,used_qty,ai_demo_amount,ai_demo_minutes,notes,updated_at)
  values(v_name,true,false,p_reward_type,p_face_value,greatest(1,coalesce(p_stock_qty,1)),0,p_ai_demo_amount,p_ai_demo_minutes,p_notes,now())
  on conflict do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.event_prize_catalog where lower(name)=lower(v_name) limit 1;
    update public.event_prize_catalog set is_active=true,reward_type=p_reward_type,face_value=p_face_value,stock_qty=greatest(1,coalesce(p_stock_qty,1)),ai_demo_amount=p_ai_demo_amount,ai_demo_minutes=p_ai_demo_minutes,notes=p_notes,updated_at=now() where id=v_id;
  end if;
  return v_id;
end $$;

create or replace function public.admin_select_event_prize(p_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
  if not public.is_current_user_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  select name into v_name from public.event_prize_catalog where id=p_id and is_active=true;
  if v_name is null then raise exception '사용 가능한 상품을 찾을 수 없습니다.'; end if;
  update public.event_prize_catalog set is_selected=false,updated_at=now() where is_selected=true and id<>p_id;
  update public.event_prize_catalog set is_selected=true,updated_at=now() where id=p_id;
  update public.events set prize=v_name, prize_catalog_id=p_id where auto_event=true and status='scheduled' and starts_at>now();
  return v_name;
end $$;

create or replace function public.start_ai_process_demo(p_user_id uuid, p_amount numeric default 10000, p_minutes integer default 60, p_source text default 'event')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_caller uuid := auth.uid();
begin
  if v_caller is not null and v_caller<>p_user_id and not public.is_current_user_admin() then raise exception '권한이 없습니다.'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id and approval_status='approved') then raise exception '승인 회원을 찾을 수 없습니다.'; end if;
  select id into v_id from public.ai_process_demo_sessions where user_id=p_user_id and status='running' limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.ai_process_demo_sessions(user_id,source,status,start_amount,current_amount,ends_at)
  values(p_user_id,coalesce(nullif(p_source,''),'event'),'running',greatest(1000,coalesce(p_amount,10000)),greatest(1000,coalesce(p_amount,10000)),now()+make_interval(mins=>greatest(3,least(720,coalesce(p_minutes,60)))))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.assign_event_reward_delivery()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_event public.events%rowtype; v_prize public.event_prize_catalog%rowtype; v_status text; v_delivery uuid;
begin
  select * into v_event from public.events where id=new.event_id;
  if v_event.prize_catalog_id is not null then select * into v_prize from public.event_prize_catalog where id=v_event.prize_catalog_id; end if;
  if v_prize.id is null then
    select * into v_prize from public.event_prize_catalog where is_active=true and lower(name)=lower(coalesce(v_event.prize,'')) order by is_selected desc limit 1;
  end if;
  v_status := case when coalesce(v_prize.reward_type,'physical')='ai_process' then 'ready' else 'pending' end;
  insert into public.event_reward_deliveries(event_id,winner_id,member_id,prize_catalog_id,reward_type,reward_name,status)
  values(new.event_id,new.id,new.member_id,v_prize.id,coalesce(v_prize.reward_type,'physical'),coalesce(v_prize.name,v_event.prize,'VIP EVENT 당첨'),v_status)
  on conflict(winner_id) do nothing returning id into v_delivery;
  if v_delivery is not null and coalesce(v_prize.reward_type,'physical')='ai_process' then
    perform public.start_ai_process_demo(new.member_id,coalesce(v_prize.ai_demo_amount,10000),coalesce(v_prize.ai_demo_minutes,60),'reward');
  end if;
  if v_delivery is not null and v_prize.id is not null then
    update public.event_prize_catalog set used_qty=used_qty+1, updated_at=now() where id=v_prize.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_assign_event_reward_delivery on public.event_winners;
create trigger trg_assign_event_reward_delivery after insert on public.event_winners for each row execute function public.assign_event_reward_delivery();

create or replace function public.get_my_event_rewards()
returns table(id uuid,event_id uuid,reward_type text,reward_name text,status text,delivery_note text,created_at timestamptz,delivered_at timestamptz)
language sql security definer set search_path=public as $$
 select d.id,d.event_id,d.reward_type,d.reward_name,d.status,d.delivery_note,d.created_at,d.delivered_at
 from public.event_reward_deliveries d where d.member_id=auth.uid() order by d.created_at desc limit 30;
$$;

create or replace function public.get_admin_event_rewards()
returns table(id uuid,event_id uuid,member_id uuid,nickname text,reward_type text,reward_name text,status text,created_at timestamptz,delivered_at timestamptz)
language sql security definer set search_path=public as $$
 select d.id,d.event_id,d.member_id,p.nickname,d.reward_type,d.reward_name,d.status,d.created_at,d.delivered_at
 from public.event_reward_deliveries d join public.profiles p on p.id=d.member_id
 where public.is_current_user_admin() order by case when d.status='pending' then 0 when d.status='ready' then 1 else 2 end,d.created_at desc limit 100;
$$;

create or replace function public.admin_mark_event_reward_delivered(p_delivery_id uuid,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.is_current_user_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
 update public.event_reward_deliveries set status='delivered',delivery_note=nullif(btrim(coalesce(p_note,'')),''),delivered_at=now() where id=p_delivery_id;
 return found;
end $$;

create or replace function public.get_my_ai_process_demo()
returns table(id uuid,status text,start_amount numeric,current_amount numeric,total_profit numeric,total_return numeric,started_at timestamptz,ends_at timestamptz,last_tick_at timestamptz,last_asset_symbol text,last_asset_name text,last_asset_type text,last_market_pct numeric,last_delta numeric)
language sql security definer set search_path=public as $$
 select s.id,s.status,s.start_amount,s.current_amount,s.total_profit,s.total_return,s.started_at,s.ends_at,s.last_tick_at,s.last_asset_symbol,s.last_asset_name,s.last_asset_type,s.last_market_pct,s.last_delta
 from public.ai_process_demo_sessions s where s.user_id=auth.uid() order by s.started_at desc limit 1;
$$;

create or replace function public.get_my_ai_process_demo_logs(p_session_id uuid)
returns table(market_at timestamptz,asset_symbol text,asset_name text,asset_type text,market_pct numeric,amount_before numeric,delta numeric,amount_after numeric,result_type text)
language sql security definer set search_path=public as $$
 select l.market_at,l.asset_symbol,l.asset_name,l.asset_type,l.market_pct,l.amount_before,l.delta,l.amount_after,l.result_type
 from public.ai_process_demo_logs l join public.ai_process_demo_sessions s on s.id=l.session_id
 where l.session_id=p_session_id and s.user_id=auth.uid() order by l.market_at desc limit 100;
$$;

create or replace function public.run_ai_process_demo_tick()
returns integer language plpgsql security definer set search_path=public as $$
declare s record; cache jsonb; desired text; q jsonb; pct numeric; move_pct numeric; before_amt numeric; delta_amt numeric; count_done integer:=0;
begin
 select payload into cache from public.market_sim_cache where cache_key='main' order by fetched_at desc limit 1;
 if cache is null or jsonb_array_length(coalesce(cache->'quotes','[]'::jsonb))=0 then return 0; end if;
 for s in select * from public.ai_process_demo_sessions where status='running' for update skip locked loop
   if now()>=s.ends_at then update public.ai_process_demo_sessions set status='completed',completed_at=now(),updated_at=now() where id=s.id; continue; end if;
   if s.last_tick_at is not null and s.last_tick_at>now()-interval '170 seconds' then continue; end if;
   desired := case when random()<0.85 then 'profit' else 'loss' end;
   select value into q from jsonb_array_elements(cache->'quotes') e(value)
     where case when desired='profit' then (value->>'changePct')::numeric>0 else (value->>'changePct')::numeric<0 end
     order by random() limit 1;
   if q is null then continue; end if;
   move_pct := (q->>'changePct')::numeric;
   pct := case when desired='profit' then (0.0035 + random()*(0.0105-0.0035)) else -(0.0004 + random()*(0.0030-0.0004)) end;
   before_amt := s.current_amount;
   delta_amt := round(before_amt*pct,2);
   update public.ai_process_demo_sessions set current_amount=before_amt+delta_amt,total_profit=(before_amt+delta_amt)-start_amount,total_return=case when start_amount>0 then (((before_amt+delta_amt)-start_amount)/start_amount)*100 else 0 end,last_tick_at=now(),last_asset_symbol=q->>'symbol',last_asset_name=q->>'name',last_asset_type=q->>'type',last_market_pct=move_pct,last_delta=delta_amt,updated_at=now() where id=s.id;
   insert into public.ai_process_demo_logs(session_id,user_id,market_at,asset_symbol,asset_name,asset_type,market_pct,amount_before,delta,amount_after,result_type)
   values(s.id,s.user_id,now(),q->>'symbol',q->>'name',q->>'type',move_pct,before_amt,delta_amt,before_amt+delta_amt,desired);
   count_done:=count_done+1;
 end loop;
 return count_done;
end $$;

create or replace function public.admin_start_surprise_ai_demo(p_amount numeric default 10000,p_minutes integer default 60)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target uuid; nick text; demo_id uuid; admin_id uuid;
begin
 if not public.is_current_user_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
 select p.id,p.nickname into target,nick from public.profiles p
 where p.approval_status='approved' and coalesce(p.role,'member')<>'admin' and coalesce(p.account_type,'human')='human'
 and not exists(select 1 from public.ai_process_demo_sessions s where s.user_id=p.id and s.status='running')
 order by random() limit 1;
 if target is null then raise exception '체험 이벤트 대상 회원이 없습니다.'; end if;
 demo_id:=public.start_ai_process_demo(target,p_amount,p_minutes,'surprise');
 select id into admin_id from public.profiles where role='admin' and approval_status='approved' order by created_at limit 1;
 insert into public.group_messages(room_id,member_id,message_type,content,is_deleted)
 values('0a495a02-bcb8-4e38-b3ef-4e7059c2a883'::uuid,admin_id,'event','⚡ AI PROCESS 돌발 체험 이벤트\n'||nick||' 님이 선정되었습니다.\n체험금 '||to_char(p_amount,'FM999,999,999')||'원 · '||p_minutes||'분 동안 모의 AI PROCESS가 자동 진행됩니다.',false);
 return jsonb_build_object('success',true,'member_id',target,'nickname',nick,'demo_id',demo_id);
end $$;

-- Production uses pg_cron. Rebuild environments can schedule this after pg_cron is enabled:
-- select cron.schedule('vip-ai-process-demo','*/3 * * * *','select public.run_ai_process_demo_tick();');
