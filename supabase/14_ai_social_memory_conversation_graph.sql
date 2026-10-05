-- ============================================================
-- AI PROCESS V17.4 - SOCIAL MEMORY + CONVERSATION GRAPH
-- 2026-10-05
--
-- 목적
-- 1) 한 줄로만 이어지는 대화가 아니라 여러 대화 가지(thread)가 동시에 살아있게 함
-- 2) 각 메시지가 어떤 이전 메시지에 답한 것인지 내부적으로 저장
-- 3) AI↔AI, AI↔실제회원 관계/기억/과거 사건이 누적되게 함
-- 4) 미리 대사를 여러 개 만들어 예약하지 않고, 말할 시간이 올 때마다 최신 맥락으로 다음 1개만 생성
-- 5) 실제회원 대화는 항상 최우선, AI 자발대화는 빈 공간을 채우는 역할
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. 대화 그래프: 실제 화면은 그대로 두고 DB 내부에서 연결만 기억
-- ------------------------------------------------------------
alter table public.group_messages
  add column if not exists ai_thread_id uuid,
  add column if not exists reply_to_message_id uuid,
  add column if not exists conversation_act text,
  add column if not exists topic_id uuid;

create index if not exists group_messages_ai_thread_created_idx
  on public.group_messages(ai_thread_id, created_at);
create index if not exists group_messages_reply_to_idx
  on public.group_messages(reply_to_message_id);
create index if not exists group_messages_topic_created_idx
  on public.group_messages(topic_id, created_at desc);

-- self FK는 여러 번 실행해도 한 번만 생성
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='group_messages_reply_to_message_id_fkey'
      and conrelid='public.group_messages'::regclass
  ) then
    alter table public.group_messages
      add constraint group_messages_reply_to_message_id_fkey
      foreign key (reply_to_message_id) references public.group_messages(id) on delete set null;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. 기존 conversation thread를 '살아있는 대화 가지'로 확장
-- ------------------------------------------------------------
alter table public.ai_conversation_threads
  add column if not exists title text,
  add column if not exists parent_thread_id uuid,
  add column if not exists last_message_id uuid,
  add column if not exists last_speaker_id uuid,
  add column if not exists last_activity_at timestamptz,
  add column if not exists turn_count integer not null default 0,
  add column if not exists min_turns integer not null default 3,
  add column if not exists max_turns integer not null default 10,
  add column if not exists energy numeric not null default 0.75,
  add column if not exists open_question boolean not null default false,
  add column if not exists summary text,
  add column if not exists priority integer not null default 10;

create index if not exists ai_threads_live_activity_idx
  on public.ai_conversation_threads(status, last_activity_at desc);

-- 기존 FK 제약은 안전하게 조건부 생성
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='ai_threads_parent_thread_id_fkey'
      and conrelid='public.ai_conversation_threads'::regclass
  ) then
    alter table public.ai_conversation_threads
      add constraint ai_threads_parent_thread_id_fkey
      foreign key (parent_thread_id) references public.ai_conversation_threads(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='ai_threads_last_message_id_fkey'
      and conrelid='public.ai_conversation_threads'::regclass
  ) then
    alter table public.ai_conversation_threads
      add constraint ai_threads_last_message_id_fkey
      foreign key (last_message_id) references public.group_messages(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='ai_threads_last_speaker_id_fkey'
      and conrelid='public.ai_conversation_threads'::regclass
  ) then
    alter table public.ai_conversation_threads
      add constraint ai_threads_last_speaker_id_fkey
      foreign key (last_speaker_id) references public.profiles(id) on delete set null;
  end if;
end $$;

-- group_messages -> thread/topic FK는 대상 테이블이 존재한 뒤 생성
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='group_messages_ai_thread_id_fkey'
      and conrelid='public.group_messages'::regclass
  ) then
    alter table public.group_messages
      add constraint group_messages_ai_thread_id_fkey
      foreign key (ai_thread_id) references public.ai_conversation_threads(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='group_messages_topic_id_fkey'
      and conrelid='public.group_messages'::regclass
  ) then
    alter table public.group_messages
      add constraint group_messages_topic_id_fkey
      foreign key (topic_id) references public.ai_chat_topics(id) on delete set null;
  end if;
end $$;

-- ------------------------------------------------------------
-- 3. 스레드 참가자: 같은 대화에 누가 섞였는지 기억
-- ------------------------------------------------------------
create table if not exists public.ai_thread_participants (
  thread_id uuid not null references public.ai_conversation_threads(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_spoke_at timestamptz,
  turns integer not null default 0,
  primary key(thread_id, member_id)
);

create index if not exists ai_thread_participants_member_idx
  on public.ai_thread_participants(member_id, last_spoke_at desc);

-- ------------------------------------------------------------
-- 4. '대사를 미리 생성하지 않는' 다음 턴 예약표
-- content를 저장하지 않고, 시간이 됐을 때 최신 채팅을 다시 읽고 1문장 생성
-- ------------------------------------------------------------
create table if not exists public.ai_turn_queue (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_conversation_threads(id) on delete cascade,
  preferred_member_id uuid references public.profiles(id) on delete set null,
  target_message_id uuid references public.group_messages(id) on delete set null,
  turn_kind text not null default 'continue'
    check (turn_kind in ('continue','human_reply','welcome','celebration','loss','autonomous_start')),
  scheduled_at timestamptz not null,
  priority integer not null default 10,
  status text not null default 'queued'
    check (status in ('queued','processing','done','cancelled')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists ai_turn_queue_due_idx
  on public.ai_turn_queue(status, priority desc, scheduled_at);
create unique index if not exists ai_turn_queue_one_live_per_thread
  on public.ai_turn_queue(thread_id)
  where status in ('queued','processing');

-- 여러 요청이 동시에 들어와도 같은 턴을 두 번 게시하지 않도록 원자적으로 1건만 선점
create or replace function public.claim_due_ai_turn()
returns setof public.ai_turn_queue
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.ai_turn_queue
  where status='queued'
    and scheduled_at <= now()
  order by priority desc, scheduled_at asc
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  update public.ai_turn_queue
  set status='processing'
  where id=v_id;

  return query
  select * from public.ai_turn_queue where id=v_id;
end;
$$;

revoke all on function public.claim_due_ai_turn() from public, anon, authenticated;
grant execute on function public.claim_due_ai_turn() to service_role;

-- ------------------------------------------------------------
-- 5. 캐릭터의 현재 사회적 상태
-- 같은 캐릭터가 계속 튀어나오지 않게 '말하고 싶은 정도'도 저장
-- ------------------------------------------------------------
alter table public.ai_character_state
  add column if not exists social_energy integer not null default 55,
  add column if not exists talk_drive integer not null default 50,
  add column if not exists current_mood text,
  add column if not exists active_interest text;

-- ------------------------------------------------------------
-- 6. 관계 그래프: AI↔AI / AI↔실제회원 모두 누적
-- member_low/member_high는 UUID 문자열 정렬 후 저장
-- ------------------------------------------------------------
create table if not exists public.ai_relationships (
  member_low uuid not null references public.profiles(id) on delete cascade,
  member_high uuid not null references public.profiles(id) on delete cascade,
  familiarity numeric not null default 0,
  affinity numeric not null default 50,
  comfort numeric not null default 20,
  playfulness numeric not null default 10,
  trust numeric not null default 20,
  interaction_count integer not null default 0,
  shared_interests text[] not null default '{}'::text[],
  summary text,
  last_interaction_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(member_low, member_high),
  check (member_low <> member_high)
);

create index if not exists ai_relationships_recent_idx
  on public.ai_relationships(last_interaction_at desc);

create table if not exists public.ai_relationship_events (
  id uuid primary key default gen_random_uuid(),
  member_low uuid not null references public.profiles(id) on delete cascade,
  member_high uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid references public.ai_conversation_threads(id) on delete set null,
  source_message_id uuid references public.group_messages(id) on delete set null,
  event_note text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_relationship_events_pair_created_idx
  on public.ai_relationship_events(member_low, member_high, created_at desc);

-- ------------------------------------------------------------
-- 7. 장기 기억
-- personal: 캐릭터 자신의 생활 서사
-- person: 특정 상대에 대해 기억하는 사실
-- relationship: 둘 사이에 쌓인 기억
-- community: 채팅방 전체 사건
-- future: 앞으로 있을 예정/약속
-- ------------------------------------------------------------
create table if not exists public.ai_social_memories (
  id uuid primary key default gen_random_uuid(),
  owner_member_id uuid references public.profiles(id) on delete cascade,
  subject_member_id uuid references public.profiles(id) on delete cascade,
  scope text not null
    check (scope in ('personal','person','relationship','community','future')),
  fact text not null,
  importance integer not null default 50 check (importance between 1 and 100),
  confidence integer not null default 100 check (confidence between 1 and 100),
  event_at timestamptz,
  valid_until timestamptz,
  source_message_id uuid references public.group_messages(id) on delete set null,
  thread_id uuid references public.ai_conversation_threads(id) on delete set null,
  memory_key text generated always as (
    md5(coalesce(owner_member_id::text,'') || '|' || coalesce(subject_member_id::text,'') || '|' || scope || '|' || fact)
  ) stored,
  recall_count integer not null default 0,
  last_recalled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_social_memories_owner_created_idx
  on public.ai_social_memories(owner_member_id, created_at desc);
create index if not exists ai_social_memories_subject_created_idx
  on public.ai_social_memories(subject_member_id, created_at desc);
create index if not exists ai_social_memories_scope_importance_idx
  on public.ai_social_memories(scope, importance desc, created_at desc);
create index if not exists ai_social_memories_future_idx
  on public.ai_social_memories(scope, event_at)
  where scope='future';

alter table public.ai_social_memories
  add column if not exists memory_key text generated always as (
    md5(coalesce(owner_member_id::text,'') || '|' || coalesce(subject_member_id::text,'') || '|' || scope || '|' || fact)
  ) stored;

-- 같은 사실을 같은 대상에 계속 중복 저장하지 않음
create unique index if not exists ai_social_memories_memory_key_unique
  on public.ai_social_memories(memory_key);

-- ------------------------------------------------------------
-- 8. 설정: 여러 대화 가지 허용 + 기억 검색 범위
-- ------------------------------------------------------------
alter table public.ai_community_settings
  add column if not exists autonomous_max_active_threads integer not null default 3,
  add column if not exists recent_context_messages integer not null default 36,
  add column if not exists memory_recall_limit integer not null default 8,
  add column if not exists relationship_event_limit integer not null default 5,
  add column if not exists autonomous_thread_min_turns integer not null default 4,
  add column if not exists autonomous_thread_max_turns integer not null default 12,
  add column if not exists new_parallel_topic_chance integer not null default 32;

update public.ai_community_settings
set autonomous_max_active_threads = 3,
    recent_context_messages = 36,
    memory_recall_limit = 8,
    relationship_event_limit = 5,
    autonomous_thread_min_turns = 4,
    autonomous_thread_max_turns = 12,
    new_parallel_topic_chance = 32,
    human_quiet_minutes = 4,
    autonomous_gap_min_minutes = 5,
    autonomous_gap_max_minutes = 11,
    updated_at = now()
where id=1;

-- ------------------------------------------------------------
-- 9. V17.3의 미리 만들어둔 예약 대사를 정리
-- V17.4부터 ai_turn_queue만 사용
-- ------------------------------------------------------------
update public.ai_reply_queue
set status='cancelled'
where status='queued';

update public.ai_conversation_threads
set status='completed',
    completed_at=coalesce(completed_at, now())
where status='active';

delete from public.ai_turn_queue where status in ('queued','processing');

update public.ai_community_state
set next_autonomous_at = now() + interval '3 minutes',
    updated_at = now()
where id=1;

commit;

-- ------------------------------------------------------------
-- 설치 확인
-- ------------------------------------------------------------
select
  (select count(*) from public.profiles
    where account_type='ai_character' and approval_status='approved') as ai_accounts,
  (select count(*) from public.ai_relationships) as relationship_rows,
  (select count(*) from public.ai_social_memories) as memory_rows,
  (select count(*) from public.ai_turn_queue where status='queued') as queued_turns,
  (select autonomous_max_active_threads from public.ai_community_settings where id=1) as max_active_threads,
  (select count(*) from cron.job where jobname='vip-ai-community') as community_cron_jobs;
