update public.app_payout_settings
set profit_min_rate=0.00036,
    profit_max_rate=0.00066,
    loss_min_rate=0.0004,
    loss_max_rate=0.0030
where id=1;

create or replace function public.run_ai_process_market_tick(tick_at timestamptz, market_at timestamptz, market_quotes jsonb)
returns integer
language plpgsql
security definer
set search_path='public'
as $$
declare
  s public.ai_process_sessions%rowtype;
  cfg public.app_payout_settings%rowtype;
  v_symbol text; v_name text; v_type text; v_market_pct numeric;
  v_before numeric; v_rate numeric; v_delta numeric; v_after numeric; v_result text;
  v_wants_profit boolean; v_processed integer := 0; v_outcome_index integer; v_offset integer; v_slot integer;
  v_hash numeric; v_profit_min numeric; v_profit_max numeric; v_loss_min numeric; v_loss_max numeric;
  v_fixed_cap numeric;
begin
  if market_quotes is null or jsonb_typeof(market_quotes) <> 'array' then return 0; end if;
  select * into cfg from public.app_payout_settings where id=1;
  v_loss_min := coalesce(cfg.loss_min_rate,0.0004);
  v_loss_max := greatest(v_loss_min,coalesce(cfg.loss_max_rate,0.0030));

  for s in select * from public.ai_process_sessions where status='running' for update skip locked loop
    if s.ends_at is not null and tick_at >= s.ends_at then
      update public.ai_process_sessions set status='completed',completed_at=tick_at,updated_at=now() where id=s.id;
      continue;
    end if;

    if s.last_market_snapshot_at is not distinct from market_at then
      if s.last_tick_at is null or tick_at>s.last_tick_at then
        update public.ai_process_sessions set last_tick_at=tick_at,updated_at=now() where id=s.id;
      end if;
      continue;
    end if;

    if s.ends_at is null then
      v_profit_min := 0.00070;
      v_profit_max := 0.00127;
    else
      v_profit_min := 0.00036;
      v_profit_max := 0.00066;
    end if;

    select count(*)::integer into v_outcome_index
    from public.ai_process_logs l
    where l.process_id=s.id and l.result_type in ('profit','loss');

    v_offset := mod((('x'||substr(md5(s.id::text),1,8))::bit(32)::bigint),20)::integer;
    if v_offset<0 then v_offset:=v_offset+20; end if;
    v_slot := mod(v_outcome_index+v_offset,20);
    v_wants_profit := v_slot not in (4,11,18);

    select q.symbol,q.name,q.type,q."changePct"
      into v_symbol,v_name,v_type,v_market_pct
    from jsonb_to_recordset(market_quotes)
      as q(symbol text,name text,type text,price numeric,"beforePrice" numeric,"changePct" numeric)
    where (v_wants_profit and coalesce(q."changePct",0) > 0)
       or ((not v_wants_profit) and coalesce(q."changePct",0) < 0)
    order by abs(q."changePct") desc
    limit 1;

    if v_symbol is null then continue; end if;

    v_hash := ((('x'||substr(md5(s.id::text||':'||market_at::text||':rate'),1,8))::bit(32)::bigint)%1000000)::numeric/999999.0;
    if v_hash<0 then v_hash:=-v_hash; end if;

    if v_wants_profit then
      v_rate:=v_profit_min+(v_profit_max-v_profit_min)*v_hash;
      v_result:='profit';
    else
      v_rate:=v_loss_min+(v_loss_max-v_loss_min)*v_hash;
      v_result:='loss';
    end if;

    v_before:=s.current_amount;
    v_delta:=round(v_before*v_rate,2);
    if not v_wants_profit then v_delta:=-v_delta; end if;
    v_after:=greatest(0,v_before+v_delta);

    if s.ends_at is not null then
      v_fixed_cap := s.start_amount * 13;
      v_after := least(v_after, v_fixed_cap);
      v_delta := v_after - v_before;
      if v_delta < 0 then v_result := 'loss'; else v_result := 'profit'; end if;
    end if;

    update public.ai_process_sessions
    set current_amount=v_after,
        total_profit=v_after-start_amount,
        total_return=case when start_amount>0 then ((v_after-start_amount)/start_amount)*100 else 0 end,
        last_market_at=market_at,
        last_market_snapshot_at=market_at,
        last_tick_at=tick_at,
        snapshot_tick_count=1,
        last_asset_symbol=v_symbol,
        last_asset_name=v_name,
        last_asset_type=v_type,
        last_market_pct=v_market_pct,
        last_delta=v_delta,
        updated_at=now()
    where id=s.id;

    insert into public.ai_process_logs(process_id,user_id,market_at,asset_symbol,asset_name,asset_type,market_pct,amount_before,delta,amount_after,result_type)
    values(s.id,s.user_id,market_at,v_symbol,v_name,v_type,v_market_pct,v_before,v_delta,v_after,v_result);

    v_processed:=v_processed+1;
  end loop;
  return v_processed;
end;
$$;