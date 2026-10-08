-- V46: survey alignment - demo completion, home notice, event operations and schedule control.

create table if not exists public.vip_home_notice (
  id integer primary key default 1 check (id=1),
  title text not null default 'VIP 운영 안내',
  body text not null default '중요 안내가 등록되면 이곳에 표시됩니다.',
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.vip_home_notice(id) values(1) on conflict(id) do nothing;

create table if not exists public.event_runtime_settings (
  id integer primary key default 1 check (id=1),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.event_runtime_settings(id) values(1) on conflict(id) do nothing;

create or replace function public.get_home_notice()
returns table(title text,body text,is_active boolean,updated_at timestamptz)
language sql security definer set search_path=public as $$
  select n.title,n.body,n.is_active,n.updated_at from public.vip_home_notice n where n.id=1;
$$;

create or replace function public.admin_set_home_notice(p_title text,p_body text,p_active boolean default true)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_current_user_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  update public.vip_home_notice
  set title=coalesce(nullif(btrim(p_title),''),'VIP 운영 안내'),
      body=coalesce(nullif(btrim(p_body),''),'중요 안내가 등록되면 이곳에 표시됩니다.'),
      is_active=coalesce(p_active,true),updated_at=now(),updated_by=auth.uid()
  where id=1;
end $$;

create or replace function public.get_event_runtime_settings()
returns table(enabled boolean,updated_at timestamptz)
language sql security definer set search_path=public as $$
  select s.enabled,s.updated_at from public.event_runtime_settings s where s.id=1;
$$;

create or replace function public.admin_set_event_runtime_enabled(p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_current_user_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  update public.event_runtime_settings set enabled=coalesce(p_enabled,true),updated_at=now(),updated_by=auth.uid() where id=1;
end $$;

create or replace function public.get_admin_event_operations()
returns table(event_id uuid,title text,event_type text,status text,starts_at timestamptz,ends_at timestamptz,round_number integer,participant_count bigint,winner_count bigint,prize text)
language sql security definer set search_path=public as $$
  select e.id,e.title,e.event_type,e.status,e.starts_at,e.ends_at,e.round_number,
         (select count(*) from public.event_entries ee where ee.event_id=e.id) participant_count,
         (select count(*) from public.event_winners ew where ew.event_id=e.id) winner_count,
         e.prize
  from public.events e
  where public.is_current_user_admin()
    and e.auto_event=true
    and e.schedule_date=(now() at time zone 'Asia/Seoul')::date
  order by e.round_number;
$$;

create or replace function public.run_auto_event_engine()
returns void language plpgsql security definer set search_path=public as $$
declare korea_today date; target record; v_enabled boolean;
begin
  select enabled into v_enabled from public.event_runtime_settings where id=1;
  if coalesce(v_enabled,true)=false then return; end if;
  korea_today := (now() at time zone 'Asia/Seoul')::date;
  perform public.create_daily_auto_events(korea_today);
  for target in select id from public.events where auto_event=true and schedule_date=korea_today loop
    perform public.setup_event_game(target.id);
  end loop;
  update public.events set status='active'
   where auto_event=true and status='scheduled' and starts_at<=now() and ends_at>now();
  for target in select id from public.events where auto_event=true and status in ('scheduled','active') and ends_at<=now() loop
    perform public.finish_auto_event(target.id);
  end loop;
end $$;

create or replace function public.run_ai_process_demo_tick()
returns integer language plpgsql security definer set search_path=public as $$
declare s record; cache jsonb; desired text; q jsonb; move_pct numeric; pct numeric; before_amt numeric; after_amt numeric; delta_amt numeric; target_amt numeric; count_done integer:=0; complete_now boolean;
begin
 select payload into cache from public.market_sim_cache where cache_key='main' order by fetched_at desc limit 1;
 if cache is null or jsonb_array_length(coalesce(cache->'quotes','[]'::jsonb))=0 then return 0; end if;
 for s in select * from public.ai_process_demo_sessions where status='running' for update skip locked loop
   if s.last_tick_at is not null and s.last_tick_at>now()-interval '170 seconds' then continue; end if;
   desired:=case when random()<0.88 then 'profit' else 'loss' end;
   select value into q from jsonb_array_elements(cache->'quotes') e(value)
    where case when desired='profit' then (value->>'changePct')::numeric>0 else (value->>'changePct')::numeric<0 end
    order by random() limit 1;
   if q is null then continue; end if;
   move_pct:=(q->>'changePct')::numeric;
   pct:=case when desired='profit' then (0.055 + random()*0.095) else -(0.006 + random()*0.024) end;
   before_amt:=s.current_amount;
   target_amt:=s.start_amount*(1+coalesce(s.target_return,100)/100);
   after_amt:=round(before_amt*(1+pct),2);
   if desired='profit' and after_amt>=target_amt then after_amt:=target_amt; end if;
   delta_amt:=after_amt-before_amt;
   complete_now:=after_amt>=target_amt;
   update public.ai_process_demo_sessions
      set current_amount=after_amt,total_profit=after_amt-start_amount,
          total_return=case when start_amount>0 then ((after_amt-start_amount)/start_amount)*100 else 0 end,
          last_tick_at=now(),last_asset_symbol=q->>'symbol',last_asset_name=q->>'name',last_asset_type=q->>'type',
          last_market_pct=move_pct,last_delta=delta_amt,updated_at=now(),
          status=case when complete_now then 'completed' else 'running' end,
          completed_at=case when complete_now then now() else completed_at end
    where id=s.id;
   insert into public.ai_process_demo_logs(session_id,user_id,market_at,asset_symbol,asset_name,asset_type,market_pct,amount_before,delta,amount_after,result_type)
   values(s.id,s.user_id,now(),q->>'symbol',q->>'name',q->>'type',move_pct,before_amt,delta_amt,after_amt,case when delta_amt>=0 then 'profit' else 'loss' end);
   count_done:=count_done+1;
 end loop;
 return count_done;
end $$;

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
  if p_reward_type not in ('physical','ai_process','event_bonus','custom') then raise exception '지원하지 않는 혜택 유형입니다.'; end if;
  if p_reward_type='ai_process' and coalesce(p_ai_demo_amount,0)<=0 then raise exception 'AI PROCESS 체험금이 필요합니다.'; end if;
  insert into public.event_prize_catalog(name,is_active,is_selected,reward_type,face_value,stock_qty,used_qty,ai_demo_amount,ai_demo_minutes,notes,image_url,updated_at)
  values(v_name,true,false,p_reward_type,p_face_value,greatest(1,coalesce(p_stock_qty,1)),0,p_ai_demo_amount,p_ai_demo_minutes,p_notes,nullif(btrim(coalesce(p_image_url,'')),''),now())
  on conflict do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.event_prize_catalog where lower(name)=lower(v_name) limit 1;
    update public.event_prize_catalog set is_active=true,reward_type=p_reward_type,face_value=p_face_value,stock_qty=greatest(1,coalesce(p_stock_qty,1)),ai_demo_amount=p_ai_demo_amount,ai_demo_minutes=p_ai_demo_minutes,notes=p_notes,image_url=nullif(btrim(coalesce(p_image_url,'')),''),updated_at=now() where id=v_id;
  end if;
  return v_id;
end $$;

create or replace function public.assign_event_reward_delivery()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_event public.events%rowtype; v_prize public.event_prize_catalog%rowtype; v_status text; v_delivery uuid; v_item uuid; v_admin uuid; v_chat uuid;
begin
  select * into v_event from public.events where id=new.event_id;
  if v_event.prize_catalog_id is not null then select * into v_prize from public.event_prize_catalog where id=v_event.prize_catalog_id; end if;
  if v_prize.id is null then select * into v_prize from public.event_prize_catalog where is_active=true and lower(name)=lower(coalesce(v_event.prize,'')) order by is_selected desc limit 1; end if;
  v_status:=case when coalesce(v_prize.reward_type,'physical')='ai_process' then 'ready' else 'pending' end;
  insert into public.event_reward_deliveries(event_id,winner_id,member_id,prize_catalog_id,reward_type,reward_name,status)
  values(new.event_id,new.id,new.member_id,v_prize.id,coalesce(v_prize.reward_type,'physical'),coalesce(v_prize.name,v_event.prize,'VIP EVENT 당첨'),v_status)
  on conflict(winner_id) do nothing returning id into v_delivery;
  if v_delivery is null then return new; end if;
  if coalesce(v_prize.reward_type,'physical')='physical' and v_prize.id is not null then
    select id into v_item from public.event_gift_inventory where prize_catalog_id=v_prize.id and status='available' order by created_at for update skip locked limit 1;
    if v_item is not null then
      update public.event_gift_inventory set status='assigned',assigned_member_id=new.member_id,delivery_id=v_delivery,assigned_at=now() where id=v_item;
      update public.event_reward_deliveries set gift_item_id=v_item,status='ready' where id=v_delivery;
      select id into v_admin from public.profiles where role='admin' and approval_status='approved' order by created_at limit 1;
      select id into v_chat from public.private_chats where member_id=new.member_id limit 1;
      if v_chat is null and v_admin is not null then insert into public.private_chats(member_id,operator_id,status) values(new.member_id,v_admin,'active') returning id into v_chat; end if;
      if v_chat is not null and v_admin is not null then
        insert into public.private_messages(chat_id,sender_id,message_type,content,is_deleted,is_read)
        values(v_chat,v_admin,'text','[[GIFT]]'||v_delivery::text||'|'||coalesce(v_prize.name,v_event.prize,'이벤트 상품')||'|'||coalesce(v_prize.image_url,''),false,false);
      end if;
    end if;
  end if;
  if v_prize.id is not null then update public.event_prize_catalog p set stock_qty=(select count(*) from public.event_gift_inventory i where i.prize_catalog_id=p.id),used_qty=(select count(*) from public.event_gift_inventory i where i.prize_catalog_id=p.id and i.status<>'available'),updated_at=now() where p.id=v_prize.id; end if;
  return new;
end $$;