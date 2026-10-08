-- V45: one-time AI PROCESS demo claim, target-return auto completion, gift inventory and automatic 1:1 delivery.
alter table public.event_prize_catalog add column if not exists image_url text;
alter table public.event_reward_deliveries add column if not exists gift_item_id uuid;
alter table public.ai_process_demo_sessions add column if not exists target_return numeric;

create table if not exists public.event_gift_inventory (
  id uuid primary key default gen_random_uuid(),
  prize_catalog_id uuid not null references public.event_prize_catalog(id) on delete cascade,
  gift_url text not null,
  status text not null default 'available',
  assigned_member_id uuid references public.profiles(id) on delete set null,
  delivery_id uuid references public.event_reward_deliveries(id) on delete set null,
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  opened_at timestamptz,
  unique(gift_url)
);
create index if not exists event_gift_inventory_prize_status_idx on public.event_gift_inventory(prize_catalog_id,status,created_at);

do $$ begin
  alter table public.event_gift_inventory add constraint event_gift_inventory_status_check check (status in ('available','assigned','opened'));
exception when duplicate_object then null; end $$;

create or replace function public.admin_add_gift_links(p_prize_id uuid,p_links text)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer:=0; v_link text;
begin
  if not public.is_current_user_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  if not exists(select 1 from public.event_prize_catalog where id=p_prize_id and reward_type='physical' and is_active=true) then raise exception '실제 상품을 찾을 수 없습니다.'; end if;
  for v_link in select btrim(x) from regexp_split_to_table(coalesce(p_links,''), E'[\r\n,]+') x loop
    if v_link ~* '^https?://' then
      insert into public.event_gift_inventory(prize_catalog_id,gift_url) values(p_prize_id,v_link) on conflict(gift_url) do nothing;
      if found then v_count:=v_count+1; end if;
    end if;
  end loop;
  update public.event_prize_catalog p set stock_qty=(select count(*) from public.event_gift_inventory i where i.prize_catalog_id=p.id), used_qty=(select count(*) from public.event_gift_inventory i where i.prize_catalog_id=p.id and i.status<>'available'), updated_at=now() where p.id=p_prize_id;
  return v_count;
end $$;

create or replace function public.get_admin_gift_inventory_summary()
returns table(prize_catalog_id uuid,total_count bigint,available_count bigint,assigned_count bigint,opened_count bigint)
language sql security definer set search_path=public as $$
 select p.id,count(i.id),count(i.id) filter(where i.status='available'),count(i.id) filter(where i.status='assigned'),count(i.id) filter(where i.status='opened')
 from public.event_prize_catalog p left join public.event_gift_inventory i on i.prize_catalog_id=p.id
 where public.is_current_user_admin() and p.reward_type='physical' and p.is_active=true group by p.id;
$$;

create or replace function public.get_my_gift_link(p_delivery_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_url text; v_item uuid;
begin
  select i.id,i.gift_url into v_item,v_url from public.event_reward_deliveries d join public.event_gift_inventory i on i.id=d.gift_item_id where d.id=p_delivery_id and d.member_id=auth.uid();
  if v_url is null then raise exception '지급된 기프티콘을 찾을 수 없습니다.'; end if;
  update public.event_gift_inventory set status='opened',opened_at=coalesce(opened_at,now()) where id=v_item;
  update public.event_reward_deliveries set status='delivered',delivered_at=coalesce(delivered_at,now()) where id=p_delivery_id;
  return v_url;
end $$;

create or replace function public.claim_ai_process_demo_reward(p_delivery_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare d public.event_reward_deliveries%rowtype; p public.event_prize_catalog%rowtype; v_id uuid;
begin
  select * into d from public.event_reward_deliveries where id=p_delivery_id and member_id=auth.uid() and reward_type='ai_process' for update;
  if d.id is null then raise exception '사용 가능한 AI PROCESS 체험 혜택이 없습니다.'; end if;
  if d.status='delivered' then raise exception '이미 사용한 체험 혜택입니다.'; end if;
  if exists(select 1 from public.ai_process_demo_sessions where user_id=auth.uid() and status='running') then raise exception '이미 AI PROCESS 체험이 진행 중입니다.'; end if;
  select * into p from public.event_prize_catalog where id=d.prize_catalog_id;
  v_id:=public.start_ai_process_demo(auth.uid(),coalesce(p.ai_demo_amount,10000),coalesce(p.ai_demo_minutes,60),'reward');
  update public.event_reward_deliveries set status='delivered',delivered_at=now() where id=d.id;
  return v_id;
end $$;

create or replace function public.start_ai_process_demo(p_user_id uuid, p_amount numeric default 10000, p_minutes integer default 60, p_source text default 'event')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_caller uuid := auth.uid(); v_target numeric;
begin
  if v_caller is not null and v_caller<>p_user_id and not public.is_current_user_admin() then raise exception '권한이 없습니다.'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id and approval_status='approved') then raise exception '승인 회원을 찾을 수 없습니다.'; end if;
  select id into v_id from public.ai_process_demo_sessions where user_id=p_user_id and status='running' limit 1;
  if v_id is not null then return v_id; end if;
  v_target:=100 + floor(random()*201);
  insert into public.ai_process_demo_sessions(user_id,source,status,start_amount,current_amount,ends_at,target_return)
  values(p_user_id,coalesce(nullif(p_source,''),'event'),'running',greatest(1000,coalesce(p_amount,10000)),greatest(1000,coalesce(p_amount,10000)),now()+interval '12 hours',v_target)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.get_my_ai_process_demo()
returns table(id uuid,status text,start_amount numeric,current_amount numeric,total_profit numeric,total_return numeric,target_return numeric,started_at timestamptz,ends_at timestamptz,last_tick_at timestamptz,last_asset_symbol text,last_asset_name text,last_asset_type text,last_market_pct numeric,last_delta numeric)
language sql security definer set search_path=public as $$
 select s.id,s.status,s.start_amount,s.current_amount,s.total_profit,s.total_return,s.target_return,s.started_at,s.ends_at,s.last_tick_at,s.last_asset_symbol,s.last_asset_name,s.last_asset_type,s.last_market_pct,s.last_delta
 from public.ai_process_demo_sessions s where s.user_id=auth.uid() order by s.started_at desc limit 1;
$$;

create or replace function public.run_ai_process_demo_tick()
returns integer language plpgsql security definer set search_path=public as $$
declare s record; cache jsonb; desired text; q jsonb; move_pct numeric; pct numeric; before_amt numeric; after_amt numeric; delta_amt numeric; target_amt numeric; count_done integer:=0; complete_now boolean;
begin
 select payload into cache from public.market_sim_cache where cache_key='main' order by fetched_at desc limit 1;
 if cache is null or jsonb_array_length(coalesce(cache->'quotes','[]'::jsonb))=0 then return 0; end if;
 for s in select * from public.ai_process_demo_sessions where status='running' for update skip locked loop
   if s.last_tick_at is not null and s.last_tick_at>now()-interval '170 seconds' then continue; end if;
   desired:=case when random()<0.88 then 'profit' else 'loss' end;
   select value into q from jsonb_array_elements(cache->'quotes') e(value) where case when desired='profit' then (value->>'changePct')::numeric>0 else (value->>'changePct')::numeric<0 end order by random() limit 1;
   if q is null then continue; end if;
   move_pct:=(q->>'changePct')::numeric;
   pct:=case when desired='profit' then (0.055 + random()*0.095) else -(0.006 + random()*0.024) end;
   before_amt:=s.current_amount;
   target_amt:=s.start_amount*(1+coalesce(s.target_return,100)/100);
   after_amt:=round(before_amt*(1+pct),2);
   if desired='profit' and after_amt>=target_amt then after_amt:=target_amt; end if;
   delta_amt:=after_amt-before_amt;
   complete_now:=after_amt>=target_amt or now()>=s.ends_at;
   update public.ai_process_demo_sessions set current_amount=after_amt,total_profit=after_amt-start_amount,total_return=case when start_amount>0 then ((after_amt-start_amount)/start_amount)*100 else 0 end,last_tick_at=now(),last_asset_symbol=q->>'symbol',last_asset_name=q->>'name',last_asset_type=q->>'type',last_market_pct=move_pct,last_delta=delta_amt,updated_at=now(),status=case when complete_now then 'completed' else 'running' end,completed_at=case when complete_now then now() else completed_at end where id=s.id;
   insert into public.ai_process_demo_logs(session_id,user_id,market_at,asset_symbol,asset_name,asset_type,market_pct,amount_before,delta,amount_after,result_type) values(s.id,s.user_id,now(),q->>'symbol',q->>'name',q->>'type',move_pct,before_amt,delta_amt,after_amt,case when delta_amt>=0 then 'profit' else 'loss' end);
   count_done:=count_done+1;
 end loop;
 return count_done;
end $$;

create or replace function public.assign_event_reward_delivery()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_event public.events%rowtype; v_prize public.event_prize_catalog%rowtype; v_status text; v_delivery uuid; v_item uuid; v_admin uuid; v_chat uuid;
begin
  select * into v_event from public.events where id=new.event_id;
  if v_event.prize_catalog_id is not null then select * into v_prize from public.event_prize_catalog where id=v_event.prize_catalog_id; end if;
  if v_prize.id is null then select * into v_prize from public.event_prize_catalog where is_active=true and lower(name)=lower(coalesce(v_event.prize,'')) order by is_selected desc limit 1; end if;
  v_status:=case when coalesce(v_prize.reward_type,'physical')='ai_process' then 'ready' else 'pending' end;
  insert into public.event_reward_deliveries(event_id,winner_id,member_id,prize_catalog_id,reward_type,reward_name,status) values(new.event_id,new.id,new.member_id,v_prize.id,coalesce(v_prize.reward_type,'physical'),coalesce(v_prize.name,v_event.prize,'VIP EVENT 당첨'),v_status) on conflict(winner_id) do nothing returning id into v_delivery;
  if v_delivery is null then return new; end if;
  if coalesce(v_prize.reward_type,'physical')='physical' and v_prize.id is not null then
    select id into v_item from public.event_gift_inventory where prize_catalog_id=v_prize.id and status='available' order by created_at for update skip locked limit 1;
    if v_item is not null then
      update public.event_gift_inventory set status='assigned',assigned_member_id=new.member_id,delivery_id=v_delivery,assigned_at=now() where id=v_item;
      update public.event_reward_deliveries set gift_item_id=v_item,status='ready' where id=v_delivery;
      select id into v_admin from public.profiles where role='admin' and approval_status='approved' order by created_at limit 1;
      select id into v_chat from public.private_chats where member_id=new.member_id limit 1;
      if v_chat is null and v_admin is not null then insert into public.private_chats(member_id,operator_id,status) values(new.member_id,v_admin,'active') returning id into v_chat; end if;
      if v_chat is not null and v_admin is not null then insert into public.private_messages(chat_id,sender_id,message_type,content,is_deleted,is_read) values(v_chat,v_admin,'text','[[GIFT]]'||v_delivery::text||'|'||coalesce(v_prize.name,v_event.prize,'이벤트 상품'),false,false); end if;
    end if;
  end if;
  if v_prize.id is not null then update public.event_prize_catalog p set stock_qty=(select count(*) from public.event_gift_inventory i where i.prize_catalog_id=p.id),used_qty=(select count(*) from public.event_gift_inventory i where i.prize_catalog_id=p.id and i.status<>'available'),updated_at=now() where p.id=v_prize.id; end if;
  return new;
end $$;

drop trigger if exists trg_assign_event_reward_delivery on public.event_winners;
create trigger trg_assign_event_reward_delivery after insert on public.event_winners for each row execute function public.assign_event_reward_delivery();

create or replace function public.admin_add_event_reward(
  p_name text,
  p_reward_type text default 'physical',
  p_face_value integer default null,
  p_stock_qty integer default 1,
  p_ai_demo_amount numeric default null,
  p_ai_demo_minutes integer default null,
  p_notes text default null,
  p_image_url text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_name text := btrim(coalesce(p_name,''));
begin
  if not public.is_current_user_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  if length(v_name)<2 then raise exception '상품명을 2자 이상 입력해주세요.'; end if;
  if p_reward_type not in ('physical','ai_process') then raise exception '지원하지 않는 상품 유형입니다.'; end if;
  if p_reward_type='ai_process' and (coalesce(p_ai_demo_amount,0)<=0 or coalesce(p_ai_demo_minutes,0)<3) then raise exception 'AI PROCESS 혜택은 체험금과 3분 이상의 진행시간이 필요합니다.'; end if;
  insert into public.event_prize_catalog(name,is_active,is_selected,reward_type,face_value,stock_qty,used_qty,ai_demo_amount,ai_demo_minutes,notes,image_url,updated_at)
  values(v_name,true,false,p_reward_type,p_face_value,greatest(1,coalesce(p_stock_qty,1)),0,p_ai_demo_amount,p_ai_demo_minutes,p_notes,nullif(btrim(coalesce(p_image_url,'')),''),now())
  on conflict do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.event_prize_catalog where lower(name)=lower(v_name) limit 1;
    update public.event_prize_catalog set is_active=true,reward_type=p_reward_type,face_value=p_face_value,stock_qty=greatest(1,coalesce(p_stock_qty,1)),ai_demo_amount=p_ai_demo_amount,ai_demo_minutes=p_ai_demo_minutes,notes=p_notes,image_url=nullif(btrim(coalesce(p_image_url,'')),''),updated_at=now() where id=v_id;
  end if;
  return v_id;
end $$;
