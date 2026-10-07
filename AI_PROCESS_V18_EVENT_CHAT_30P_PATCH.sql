-- ============================================================
-- AI PROCESS V18 - EVENT CHAT + 30% AI PARTICIPATION
-- 2026-10-07
--
-- 1) 이벤트 시작 시 관리자 계정으로 그룹채팅 안내
-- 2) 이벤트 당첨 시 관리자 계정으로 그룹채팅 결과 발표
-- 3) 일반 이벤트는 각 AI 캐릭터가 이벤트별로 독립적으로 30% 확률 참여
-- 4) 선착순은 실제회원 우선 2분 유지 후, 30% 대상 AI 중 1명이 참가/당첨 가능
-- 5) 기존 기프티콘 1:1 자동지급 로직은 변경하지 않음
-- ============================================================

begin;

-- 중복 공지를 막기 위한 기록 테이블
create table if not exists public.event_chat_announcements (
  event_id uuid not null references public.events(id) on delete cascade,
  announcement_type text not null check (announcement_type in ('start','winner')),
  created_at timestamptz not null default now(),
  primary key (event_id, announcement_type)
);

revoke all on public.event_chat_announcements from anon, authenticated;

-- AI 자동참여 설정에 확률 필드 추가
alter table public.ai_event_participation_settings
  add column if not exists participation_rate_percent integer not null default 30;

update public.ai_event_participation_settings
set enabled = true,
    participation_rate_percent = 30,
    normal_start_delay_seconds = 30,
    first_come_delay_seconds = 120,
    updated_at = now()
where id = 1;

-- 이벤트 시작 공지
create or replace function public.announce_event_started_to_group(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path='public'
as $$
declare
  ev public.events%rowtype;
  v_admin_id uuid;
  v_game_name text;
  v_content text;
begin
  select * into ev from public.events where id = target_event_id;
  if not found or ev.status <> 'active' then return; end if;

  insert into public.event_chat_announcements(event_id, announcement_type)
  values(ev.id, 'start')
  on conflict do nothing;
  if not found then return; end if;

  select id into v_admin_id
  from public.profiles
  where role='admin' and approval_status='approved'
  order by created_at asc
  limit 1;
  if v_admin_id is null then return; end if;

  v_game_name := public.event_type_korean(ev.event_type);
  v_content :=
    '🎁 이벤트가 시작되었습니다!' || E'\n\n' ||
    coalesce(ev.title, v_game_name || ' 이벤트') || E'\n' ||
    case when nullif(trim(coalesce(ev.description,'')),'') is not null
      then ev.description || E'\n'
      else '' end ||
    '⏰ 종료 ' || to_char(ev.ends_at at time zone 'Asia/Seoul','HH24:MI') || E'\n\n' ||
    '이벤트 메뉴에서 참여해주세요.';

  insert into public.group_messages(room_id,member_id,message_type,content,is_deleted,created_at)
  values(ev.room_id,v_admin_id,'event',v_content,false,now());
end;
$$;

-- 당첨 결과 공식 발표는 관리자 계정이 담당
create or replace function public.announce_event_winner_to_group()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_event public.events%rowtype;
  v_winner_name text;
  v_admin_id uuid;
  v_game_name text;
  v_content text;
begin
  select * into v_event from public.events where id=new.event_id;
  if not found then return new; end if;

  insert into public.event_chat_announcements(event_id, announcement_type)
  values(new.event_id, 'winner')
  on conflict do nothing;
  if not found then return new; end if;

  select nickname into v_winner_name from public.profiles where id=new.member_id;
  select id into v_admin_id
  from public.profiles
  where role='admin' and approval_status='approved'
  order by created_at asc
  limit 1;
  if v_admin_id is null then return new; end if;

  v_game_name := public.event_type_korean(v_event.event_type);
  v_content :=
    '🎉 ' || v_game_name || ' 이벤트 결과 발표' || E'\n\n' ||
    '🏆 당첨자: ' || coalesce(v_winner_name,'VIP 회원') || ' 님' || E'\n' ||
    '🎁 상품은 1:1 문의로 자동 지급됩니다.' || E'\n\n' ||
    '당첨을 진심으로 축하드립니다!';

  insert into public.group_messages(room_id,member_id,message_type,content,is_deleted,created_at)
  values(v_event.room_id,v_admin_id,'event',v_content,false,now());

  return new;
end;
$$;

-- 기존 이름의 결과 발표 트리거가 있으면 안전하게 재연결
-- (함수 이름 기준으로 중복 실행되지 않도록 대표 트리거 하나를 사용)
drop trigger if exists trg_announce_event_winner_to_group on public.event_winners;
create trigger trg_announce_event_winner_to_group
after insert on public.event_winners
for each row execute function public.announce_event_winner_to_group();

-- 각 AI가 이벤트별로 독립적으로 30% 대상이 되도록 고정 랜덤 해시를 사용.
-- 같은 이벤트의 cron이 여러 번 돌아도 참여 대상이 계속 바뀌어 누적 100%가 되는 문제를 막는다.
create or replace function public.auto_join_ai_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path='public'
as $$
declare
  ev public.events%rowtype;
  cfg public.ai_event_participation_settings%rowtype;
  ai_member record;
  secret_value text;
  quiz_correct integer;
  answer_value text;
  answer_correct boolean;
  rate_percent integer;
begin
  select * into cfg from public.ai_event_participation_settings where id=1;
  if not found or not cfg.enabled then return; end if;

  rate_percent := greatest(0, least(100, coalesce(cfg.participation_rate_percent,30)));

  select * into ev from public.events where id=target_event_id for update;
  if not found
     or not coalesce(ev.auto_event,false)
     or ev.status <> 'active'
     or now() < ev.starts_at
     or now() >= ev.ends_at then
    return;
  end if;

  perform public.setup_event_game(ev.id);
  select secret_answer into secret_value
  from public.event_game_secrets
  where event_id=ev.id;

  if ev.event_type='quiz' then
    select q.correct_option into quiz_correct
    from public.event_quiz_bank q
    where q.id::text=secret_value and q.active=true
    limit 1;
    if quiz_correct is null then return; end if;
  end if;

  -- 선착순은 실제회원에게 2분 우선권을 준다.
  -- 그 뒤에도 아무 참가/당첨이 없을 때, 이번 이벤트의 30% 대상 AI 중 1명만 들어간다.
  if ev.event_type='first_come' then
    if now() < ev.starts_at + make_interval(secs=>cfg.first_come_delay_seconds) then return; end if;
    if exists(select 1 from public.event_winners where event_id=ev.id)
       or exists(select 1 from public.event_entries where event_id=ev.id) then return; end if;

    select p.id,p.nickname into ai_member
    from public.profiles p
    join public.members m on m.id=p.id
    where p.approval_status='approved'
      and coalesce(p.account_type,'human')='ai_character'
      and coalesce(p.ai_chat_enabled,true)=true
      and coalesce(m.status,'approved')='approved'
      and mod(abs(hashtextextended(ev.id::text || ':' || p.id::text, 31)),100) < rate_percent
    order by random()
    limit 1;

    if ai_member.id is null then return; end if;

    insert into public.event_entries(event_id,member_id,answer,is_correct,result_text,submitted_at)
    values(ev.id,ai_member.id,null,true,'AI 자동 선착순 참여',now())
    on conflict(event_id,member_id) do nothing;

    insert into public.event_winners(event_id,member_id,rank)
    values(ev.id,ai_member.id,1)
    on conflict(event_id) do nothing;

    update public.events
    set status='completed', completed_at=now()
    where id=ev.id and exists(select 1 from public.event_winners w where w.event_id=ev.id);
    return;
  end if;

  if now() < ev.starts_at + make_interval(secs=>cfg.normal_start_delay_seconds) then return; end if;

  for ai_member in
    select p.id,p.nickname
    from public.profiles p
    join public.members m on m.id=p.id
    where p.approval_status='approved'
      and coalesce(p.account_type,'human')='ai_character'
      and coalesce(p.ai_chat_enabled,true)=true
      and coalesce(m.status,'approved')='approved'
      and mod(abs(hashtextextended(ev.id::text || ':' || p.id::text, 31)),100) < rate_percent
      and not exists(
        select 1 from public.event_entries ee
        where ee.event_id=ev.id and ee.member_id=p.id
      )
    order by random()
  loop
    answer_value:=null;
    answer_correct:=null;

    if ev.event_type='gift_box' then
      answer_value:=(floor(random()*4)+1)::integer::text;
      answer_correct:=(answer_value=secret_value);
    elsif ev.event_type='number' then
      answer_value:=(floor(random()*100)+1)::integer::text;
      answer_correct:=(answer_value=secret_value);
    elsif ev.event_type='quiz' then
      answer_value:=(floor(random()*4)+1)::integer::text;
      answer_correct:=(answer_value::integer=quiz_correct);
    elsif ev.event_type='roulette' then
      answer_value:='roulette';
    end if;

    insert into public.event_entries(event_id,member_id,answer,is_correct,result_text,submitted_at)
    values(
      ev.id,ai_member.id,answer_value,answer_correct,
      case ev.event_type
        when 'gift_box' then 'AI 자동 선물상자 참여'
        when 'number' then 'AI 자동 숫자 참여'
        when 'roulette' then 'AI 자동 룰렛 참여'
        when 'quiz' then 'AI 자동 퀴즈 참여'
        when 'draw' then 'AI 자동 추첨 응모'
        when 'attendance' then 'AI 자동 출석'
        else 'AI 자동 이벤트 참여'
      end,
      now()
    ) on conflict(event_id,member_id) do nothing;

    if ev.event_type='attendance' then
      insert into public.attendance_records(event_id,member_id,attendance_date)
      values(ev.id,ai_member.id,(now() at time zone 'Asia/Seoul')::date)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

revoke all on function public.auto_join_ai_event(uuid) from public,anon,authenticated;

-- 자동 이벤트 엔진에 시작 공지 + AI 30% 참여 연결
create or replace function public.run_auto_event_engine()
returns void
language plpgsql
security definer
set search_path='public'
as $$
declare
  korea_today date;
  target record;
begin
  korea_today := (now() at time zone 'Asia/Seoul')::date;
  perform public.create_daily_auto_events(korea_today);

  for target in
    select id from public.events
    where auto_event=true and schedule_date=korea_today
  loop
    perform public.setup_event_game(target.id);
  end loop;

  for target in
    select id from public.events
    where auto_event=true
      and status='scheduled'
      and starts_at<=now()
      and ends_at>now()
  loop
    update public.events set status='active' where id=target.id;
    perform public.announce_event_started_to_group(target.id);

    insert into public.ai_community_events(event_type,member_id,source_key,status)
    values('event_started',null,target.id::text,'pending')
    on conflict do nothing;
  end loop;

  -- 패치 적용 시 이미 진행 중인 이벤트도 시작 공지를 1회 보강
  for target in
    select id from public.events
    where auto_event=true
      and status='active'
      and schedule_date=korea_today
      and ends_at>now()
  loop
    perform public.announce_event_started_to_group(target.id);
    perform public.auto_join_ai_event(target.id);
  end loop;

  for target in
    select id from public.events
    where auto_event=true
      and status in('scheduled','active')
      and ends_at<=now()
  loop
    perform public.finish_auto_event(target.id);
  end loop;
end;
$$;

-- 현재 진행 중 회차에 즉시 한 번 반영
select public.run_auto_event_engine();

commit;

-- 확인용
select
  enabled,
  participation_rate_percent,
  normal_start_delay_seconds,
  first_come_delay_seconds
from public.ai_event_participation_settings
where id=1;

select
  e.event_type,
  e.status,
  count(ee.*) filter (where coalesce(p.account_type,'human')='ai_character') as ai_entries,
  count(ee.*) as total_entries
from public.events e
left join public.event_entries ee on ee.event_id=e.id
left join public.profiles p on p.id=ee.member_id
where e.auto_event=true
  and e.schedule_date=(now() at time zone 'Asia/Seoul')::date
group by e.id,e.event_type,e.status,e.starts_at
order by e.starts_at desc
limit 20;
