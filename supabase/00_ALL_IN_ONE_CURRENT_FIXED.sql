-- ============================================================
-- AI PROCESS VIP CURRENT ALL-IN-ONE SQL - FIXED
-- 기준일: 2026-10-02
-- 대상: 새 Supabase 프로젝트 또는 VIP Push 프로젝트에 현재 사이트 구조 복원
-- 구성: 2026-10-01 기본 스키마 + 2026-10-02 AI PROCESS/프로필75 업그레이드
--
-- 이번 FIX에서 복구한 항목:
-- 1) CREATE TABLE 21곳의 잘못된 literal \n 제거
-- 2) 잘려 있던 RLS 정책 3곳 복구
-- 3) profiles 승인 동기화 INSERT/UPDATE 트리거 이름 분리
-- 4) auth.users -> profiles 자동 생성 트리거 추가
-- 5) 프론트가 사용하는 고정 그룹방/room_chat_settings 기본 행 추가
--
-- 주의:
-- - 실제 Auth 사용자/기존 회원 데이터/채팅 데이터/Storage 파일은 포함하지 않습니다.
-- - 기존 DB에 동일 이름 객체가 있으면 현재 구조와 충돌할 수 있으므로 오류가 나면 그 오류를 기준으로 병합해야 합니다.
-- ============================================================

-- VIP-EVENT 현재 Supabase 메타데이터 기반 복원 SQL
-- 2026-10-01 조회 결과에서 생성.
-- 중요: 이 파일은 '스키마/함수/정책/트리거/인덱스' 복원용입니다.
-- Auth 사용자, 실제 테이블 데이터, Storage 파일/버킷, 프로젝트 설정/Secrets는 포함하지 않습니다.
-- 새 Supabase 프로젝트에서는 먼저 Extensions에서 pg_cron이 필요한 경우 활성화하세요.

create extension if not exists pgcrypto;

create table if not exists public."ai_character_memories" (
  "id" uuid default gen_random_uuid() not null,
  "character_id" uuid not null,
  "memory_date" date default CURRENT_DATE not null,
  "category" text not null,
  "content" text not null,
  "created_at" timestamptz default now() not null
);

create table if not exists public."ai_characters" (
  "id" uuid default gen_random_uuid() not null,
  "nickname" text not null,
  "is_active" boolean default true not null,
  "age" integer,
  "gender" text,
  "occupation" text,
  "personality" text,
  "speaking_style" text,
  "behavior" text,
  "activity_start" time default '11:00:00'::time without time zone not null,
  "activity_end" time default '18:30:00'::time without time zone not null,
  "created_at" timestamptz default now() not null,
  "avatar" text default 'vip_01'::text not null
);

create table if not exists public."attendance_records" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "member_id" uuid not null,
  "attendance_date" date default CURRENT_DATE not null,
  "checked_at" timestamptz default now() not null
);

create table if not exists public."chat_rooms" (
  "id" uuid default gen_random_uuid() not null,
  "name" text default 'VIP 이벤트 혜택방'::text not null,
  "description" text,
  "is_active" boolean default true not null,
  "created_at" timestamptz default now() not null
);

create table if not exists public."event_entries" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "member_id" uuid not null,
  "answer" text,
  "is_correct" boolean,
  "joined_at" timestamptz default now() not null,
  "result_text" text,
  "submitted_at" timestamptz default now() not null
);

create table if not exists public."event_game_secrets" (
  "event_id" uuid not null,
  "secret_answer" text,
  "created_at" timestamptz default now() not null
);

create table if not exists public."event_quiz_bank" (
  "id" uuid default gen_random_uuid() not null,
  "question" text not null,
  "option_1" text not null,
  "option_2" text not null,
  "option_3" text not null,
  "option_4" text not null,
  "correct_option" integer not null,
  "active" boolean default true not null,
  "created_at" timestamptz default now() not null
);

create table if not exists public."event_winners" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "member_id" uuid not null,
  "rank" integer default 1 not null,
  "selected_at" timestamptz default now() not null
);

create table if not exists public."events" (
  "id" uuid default gen_random_uuid() not null,
  "room_id" uuid not null,
  "created_by" uuid,
  "title" text not null,
  "description" text,
  "prize" text,
  "event_type" text not null,
  "status" text default 'draft'::text not null,
  "winner_count" integer default 1 not null,
  "quiz_question" text,
  "quiz_answer" text,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "completed_at" timestamptz,
  "group_message_id" uuid,
  "schedule_date" date,
  "round_number" integer,
  "auto_event" boolean default false not null
);

create table if not exists public."group_messages" (
  "id" uuid default gen_random_uuid() not null,
  "room_id" uuid not null,
  "member_id" uuid,
  "message_type" text default 'text'::text not null,
  "content" text,
  "is_deleted" boolean default false not null,
  "created_at" timestamptz default now() not null
);

create table if not exists public."market_sim_cache" (
  "cache_key" text not null,
  "payload" jsonb not null,
  "fetched_at" timestamptz default now() not null
);

create table if not exists public."member_notes" (
  "id" uuid default gen_random_uuid() not null,
  "member_id" uuid not null,
  "operator_id" uuid,
  "content" text not null,
  "created_at" timestamptz default now() not null
);

create table if not exists public."members" (
  "id" uuid default gen_random_uuid() not null,
  "nickname" text not null,
  "password_hash" text not null,
  "role" text default 'member'::text not null,
  "status" text default 'pending'::text not null,
  "created_at" timestamptz default now() not null,
  "approved_at" timestamptz,
  "last_seen_at" timestamptz,
  "is_muted" boolean default false not null,
  "muted_until" timestamptz,
  "ban_reason" text,
  "left_at" timestamptz
);

create table if not exists public."moderation_logs" (
  "id" uuid default gen_random_uuid() not null,
  "target_member_id" uuid,
  "operator_id" uuid,
  "action" text not null,
  "reason" text,
  "created_at" timestamptz default now() not null
);

create table if not exists public."private_chats" (
  "id" uuid default gen_random_uuid() not null,
  "member_id" uuid not null,
  "operator_id" uuid,
  "status" text default 'open'::text not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table if not exists public."private_messages" (
  "id" uuid default gen_random_uuid() not null,
  "chat_id" uuid not null,
  "sender_id" uuid,
  "message_type" text default 'text'::text not null,
  "content" text not null,
  "is_deleted" boolean default false not null,
  "is_read" boolean default false not null,
  "created_at" timestamptz default now() not null
);

create table if not exists public."profiles" (
  "id" uuid not null,
  "nickname" text not null,
  "real_name" text not null,
  "approval_status" text default 'pending'::text not null,
  "created_at" timestamptz default now() not null,
  "avatar" text default 'vip_01'::text not null,
  "role" text default 'member'::text not null,
  "show_in_admin_chat" boolean default true not null
);

create table if not exists public."push_subscriptions" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "endpoint" text not null,
  "p256dh" text not null,
  "auth" text not null,
  "user_agent" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table if not exists public."room_chat_settings" (
  "room_id" uuid not null,
  "is_frozen" boolean default false not null,
  "updated_at" timestamptz default now() not null,
  "updated_by" uuid
);

create table if not exists public."room_members" (
  "id" uuid default gen_random_uuid() not null,
  "room_id" uuid not null,
  "member_id" uuid not null,
  "joined_at" timestamptz default now() not null,
  "is_muted" boolean default false not null
);

create table if not exists public."room_restrictions" (
  "id" uuid default gen_random_uuid() not null,
  "room_id" uuid not null,
  "member_id" uuid not null,
  "restriction_type" text not null,
  "reason" text,
  "created_by" uuid,
  "created_at" timestamptz default now() not null,
  "expires_at" timestamptz
);

-- FIX2: referenced tables must have PRIMARY KEY / UNIQUE constraints before FOREIGN KEY constraints are added.
-- This preflight section makes the schema safe to run on a fresh or partially-created project.

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='ai_character_memories' and c.conname='ai_character_memories_pkey'
  ) then
    execute 'alter table public."ai_character_memories" add constraint "ai_character_memories_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='ai_characters' and c.conname='ai_characters_pkey'
  ) then
    execute 'alter table public."ai_characters" add constraint "ai_characters_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='attendance_records' and c.conname='attendance_records_pkey'
  ) then
    execute 'alter table public."attendance_records" add constraint "attendance_records_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='chat_rooms' and c.conname='chat_rooms_pkey'
  ) then
    execute 'alter table public."chat_rooms" add constraint "chat_rooms_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_entries' and c.conname='event_entries_pkey'
  ) then
    execute 'alter table public."event_entries" add constraint "event_entries_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_game_secrets' and c.conname='event_game_secrets_pkey'
  ) then
    execute 'alter table public."event_game_secrets" add constraint "event_game_secrets_pkey" PRIMARY KEY (event_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_quiz_bank' and c.conname='event_quiz_bank_pkey'
  ) then
    execute 'alter table public."event_quiz_bank" add constraint "event_quiz_bank_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_winners' and c.conname='event_winners_pkey'
  ) then
    execute 'alter table public."event_winners" add constraint "event_winners_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='events' and c.conname='events_pkey'
  ) then
    execute 'alter table public."events" add constraint "events_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='group_messages' and c.conname='group_messages_pkey'
  ) then
    execute 'alter table public."group_messages" add constraint "group_messages_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='market_sim_cache' and c.conname='market_sim_cache_pkey'
  ) then
    execute 'alter table public."market_sim_cache" add constraint "market_sim_cache_pkey" PRIMARY KEY (cache_key)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='member_notes' and c.conname='member_notes_pkey'
  ) then
    execute 'alter table public."member_notes" add constraint "member_notes_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='members' and c.conname='members_pkey'
  ) then
    execute 'alter table public."members" add constraint "members_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='moderation_logs' and c.conname='moderation_logs_pkey'
  ) then
    execute 'alter table public."moderation_logs" add constraint "moderation_logs_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_chats' and c.conname='private_chats_pkey'
  ) then
    execute 'alter table public."private_chats" add constraint "private_chats_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_messages' and c.conname='private_messages_pkey'
  ) then
    execute 'alter table public."private_messages" add constraint "private_messages_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='profiles' and c.conname='profiles_pkey'
  ) then
    execute 'alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='push_subscriptions' and c.conname='push_subscriptions_pkey'
  ) then
    execute 'alter table public."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_chat_settings' and c.conname='room_chat_settings_pkey'
  ) then
    execute 'alter table public."room_chat_settings" add constraint "room_chat_settings_pkey" PRIMARY KEY (room_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_members' and c.conname='room_members_pkey'
  ) then
    execute 'alter table public."room_members" add constraint "room_members_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_restrictions' and c.conname='room_restrictions_pkey'
  ) then
    execute 'alter table public."room_restrictions" add constraint "room_restrictions_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='ai_characters' and c.conname='ai_characters_nickname_key'
  ) then
    execute 'alter table public."ai_characters" add constraint "ai_characters_nickname_key" UNIQUE (nickname)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='attendance_records' and c.conname='attendance_records_event_id_member_id_attendance_date_key'
  ) then
    execute 'alter table public."attendance_records" add constraint "attendance_records_event_id_member_id_attendance_date_key" UNIQUE (event_id, member_id, attendance_date)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_entries' and c.conname='event_entries_event_id_member_id_key'
  ) then
    execute 'alter table public."event_entries" add constraint "event_entries_event_id_member_id_key" UNIQUE (event_id, member_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_winners' and c.conname='event_winners_event_id_member_id_key'
  ) then
    execute 'alter table public."event_winners" add constraint "event_winners_event_id_member_id_key" UNIQUE (event_id, member_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='members' and c.conname='members_nickname_key'
  ) then
    execute 'alter table public."members" add constraint "members_nickname_key" UNIQUE (nickname)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_chats' and c.conname='private_chats_member_id_key'
  ) then
    execute 'alter table public."private_chats" add constraint "private_chats_member_id_key" UNIQUE (member_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='profiles' and c.conname='profiles_nickname_key'
  ) then
    execute 'alter table public."profiles" add constraint "profiles_nickname_key" UNIQUE (nickname)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='push_subscriptions' and c.conname='push_subscriptions_endpoint_key'
  ) then
    execute 'alter table public."push_subscriptions" add constraint "push_subscriptions_endpoint_key" UNIQUE (endpoint)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_members' and c.conname='room_members_room_id_member_id_key'
  ) then
    execute 'alter table public."room_members" add constraint "room_members_room_id_member_id_key" UNIQUE (room_id, member_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='ai_character_memories' and c.conname='ai_character_memories_character_id_fkey'
  ) then
    execute 'alter table public."ai_character_memories" add constraint "ai_character_memories_character_id_fkey" FOREIGN KEY (character_id) REFERENCES ai_characters(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='ai_character_memories' and c.conname='ai_character_memories_pkey'
  ) then
    execute 'alter table public."ai_character_memories" add constraint "ai_character_memories_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='ai_characters' and c.conname='ai_characters_nickname_key'
  ) then
    execute 'alter table public."ai_characters" add constraint "ai_characters_nickname_key" UNIQUE (nickname)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='ai_characters' and c.conname='ai_characters_pkey'
  ) then
    execute 'alter table public."ai_characters" add constraint "ai_characters_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='attendance_records' and c.conname='attendance_records_event_id_fkey'
  ) then
    execute 'alter table public."attendance_records" add constraint "attendance_records_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='attendance_records' and c.conname='attendance_records_event_id_member_id_attendance_date_key'
  ) then
    execute 'alter table public."attendance_records" add constraint "attendance_records_event_id_member_id_attendance_date_key" UNIQUE (event_id, member_id, attendance_date)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='attendance_records' and c.conname='attendance_records_member_id_fkey'
  ) then
    execute 'alter table public."attendance_records" add constraint "attendance_records_member_id_fkey" FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='attendance_records' and c.conname='attendance_records_pkey'
  ) then
    execute 'alter table public."attendance_records" add constraint "attendance_records_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='chat_rooms' and c.conname='chat_rooms_pkey'
  ) then
    execute 'alter table public."chat_rooms" add constraint "chat_rooms_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_entries' and c.conname='event_entries_event_id_fkey'
  ) then
    execute 'alter table public."event_entries" add constraint "event_entries_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_entries' and c.conname='event_entries_event_id_member_id_key'
  ) then
    execute 'alter table public."event_entries" add constraint "event_entries_event_id_member_id_key" UNIQUE (event_id, member_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_entries' and c.conname='event_entries_member_id_fkey'
  ) then
    execute 'alter table public."event_entries" add constraint "event_entries_member_id_fkey" FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_entries' and c.conname='event_entries_pkey'
  ) then
    execute 'alter table public."event_entries" add constraint "event_entries_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_game_secrets' and c.conname='event_game_secrets_event_id_fkey'
  ) then
    execute 'alter table public."event_game_secrets" add constraint "event_game_secrets_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_game_secrets' and c.conname='event_game_secrets_pkey'
  ) then
    execute 'alter table public."event_game_secrets" add constraint "event_game_secrets_pkey" PRIMARY KEY (event_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_quiz_bank' and c.conname='event_quiz_bank_correct_option_check'
  ) then
    execute 'alter table public."event_quiz_bank" add constraint "event_quiz_bank_correct_option_check" CHECK (((correct_option >= 1) AND (correct_option <= 4)))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_quiz_bank' and c.conname='event_quiz_bank_pkey'
  ) then
    execute 'alter table public."event_quiz_bank" add constraint "event_quiz_bank_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_winners' and c.conname='event_winners_event_id_fkey'
  ) then
    execute 'alter table public."event_winners" add constraint "event_winners_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_winners' and c.conname='event_winners_event_id_member_id_key'
  ) then
    execute 'alter table public."event_winners" add constraint "event_winners_event_id_member_id_key" UNIQUE (event_id, member_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_winners' and c.conname='event_winners_member_id_fkey'
  ) then
    execute 'alter table public."event_winners" add constraint "event_winners_member_id_fkey" FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_winners' and c.conname='event_winners_pkey'
  ) then
    execute 'alter table public."event_winners" add constraint "event_winners_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='event_winners' and c.conname='event_winners_rank_check'
  ) then
    execute 'alter table public."event_winners" add constraint "event_winners_rank_check" CHECK ((rank > 0))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='events' and c.conname='events_created_by_fkey'
  ) then
    execute 'alter table public."events" add constraint "events_created_by_fkey" FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='events' and c.conname='events_event_type_check'
  ) then
    execute 'alter table public."events" add constraint "events_event_type_check" CHECK ((event_type = ANY (ARRAY[''gift_box''::text, ''number''::text, ''roulette''::text, ''first_come''::text, ''quiz''::text, ''draw''::text, ''attendance''::text])))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='events' and c.conname='events_group_message_id_fkey'
  ) then
    execute 'alter table public."events" add constraint "events_group_message_id_fkey" FOREIGN KEY (group_message_id) REFERENCES group_messages(id) ON DELETE SET NULL';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='events' and c.conname='events_pkey'
  ) then
    execute 'alter table public."events" add constraint "events_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='events' and c.conname='events_room_id_fkey'
  ) then
    execute 'alter table public."events" add constraint "events_room_id_fkey" FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='events' and c.conname='events_status_check'
  ) then
    execute 'alter table public."events" add constraint "events_status_check" CHECK ((status = ANY (ARRAY[''draft''::text, ''scheduled''::text, ''active''::text, ''completed''::text, ''cancelled''::text])))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='events' and c.conname='events_winner_count_check'
  ) then
    execute 'alter table public."events" add constraint "events_winner_count_check" CHECK ((winner_count > 0))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='group_messages' and c.conname='group_messages_member_id_fkey'
  ) then
    execute 'alter table public."group_messages" add constraint "group_messages_member_id_fkey" FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='group_messages' and c.conname='group_messages_message_type_check'
  ) then
    execute 'alter table public."group_messages" add constraint "group_messages_message_type_check" CHECK ((message_type = ANY (ARRAY[''text''::text, ''notice''::text, ''event''::text, ''system''::text])))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='group_messages' and c.conname='group_messages_pkey'
  ) then
    execute 'alter table public."group_messages" add constraint "group_messages_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='group_messages' and c.conname='group_messages_room_id_fkey'
  ) then
    execute 'alter table public."group_messages" add constraint "group_messages_room_id_fkey" FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='market_sim_cache' and c.conname='market_sim_cache_pkey'
  ) then
    execute 'alter table public."market_sim_cache" add constraint "market_sim_cache_pkey" PRIMARY KEY (cache_key)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='member_notes' and c.conname='member_notes_member_id_fkey'
  ) then
    execute 'alter table public."member_notes" add constraint "member_notes_member_id_fkey" FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='member_notes' and c.conname='member_notes_operator_id_fkey'
  ) then
    execute 'alter table public."member_notes" add constraint "member_notes_operator_id_fkey" FOREIGN KEY (operator_id) REFERENCES members(id) ON DELETE SET NULL';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='member_notes' and c.conname='member_notes_pkey'
  ) then
    execute 'alter table public."member_notes" add constraint "member_notes_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='members' and c.conname='members_nickname_key'
  ) then
    execute 'alter table public."members" add constraint "members_nickname_key" UNIQUE (nickname)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='members' and c.conname='members_pkey'
  ) then
    execute 'alter table public."members" add constraint "members_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='members' and c.conname='members_role_check'
  ) then
    execute 'alter table public."members" add constraint "members_role_check" CHECK ((role = ANY (ARRAY[''member''::text, ''operator''::text, ''admin''::text])))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='members' and c.conname='members_status_check'
  ) then
    execute 'alter table public."members" add constraint "members_status_check" CHECK ((status = ANY (ARRAY[''pending''::text, ''approved''::text, ''suspended''::text, ''banned''::text, ''left''::text])))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='moderation_logs' and c.conname='moderation_logs_action_check'
  ) then
    execute 'alter table public."moderation_logs" add constraint "moderation_logs_action_check" CHECK ((action = ANY (ARRAY[''approve''::text, ''reject''::text, ''warn''::text, ''mute''::text, ''unmute''::text, ''silent_kick''::text, ''ban''::text, ''unban''::text, ''promote_operator''::text, ''remove_operator''::text])))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='moderation_logs' and c.conname='moderation_logs_operator_id_fkey'
  ) then
    execute 'alter table public."moderation_logs" add constraint "moderation_logs_operator_id_fkey" FOREIGN KEY (operator_id) REFERENCES members(id) ON DELETE SET NULL';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='moderation_logs' and c.conname='moderation_logs_pkey'
  ) then
    execute 'alter table public."moderation_logs" add constraint "moderation_logs_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='moderation_logs' and c.conname='moderation_logs_target_member_id_fkey'
  ) then
    execute 'alter table public."moderation_logs" add constraint "moderation_logs_target_member_id_fkey" FOREIGN KEY (target_member_id) REFERENCES members(id) ON DELETE SET NULL';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_chats' and c.conname='private_chats_member_id_fkey'
  ) then
    execute 'alter table public."private_chats" add constraint "private_chats_member_id_fkey" FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_chats' and c.conname='private_chats_member_id_key'
  ) then
    execute 'alter table public."private_chats" add constraint "private_chats_member_id_key" UNIQUE (member_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_chats' and c.conname='private_chats_operator_id_fkey'
  ) then
    execute 'alter table public."private_chats" add constraint "private_chats_operator_id_fkey" FOREIGN KEY (operator_id) REFERENCES members(id) ON DELETE SET NULL';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_chats' and c.conname='private_chats_pkey'
  ) then
    execute 'alter table public."private_chats" add constraint "private_chats_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_chats' and c.conname='private_chats_status_check'
  ) then
    execute 'alter table public."private_chats" add constraint "private_chats_status_check" CHECK ((status = ANY (ARRAY[''open''::text, ''closed''::text])))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_messages' and c.conname='private_messages_chat_id_fkey'
  ) then
    execute 'alter table public."private_messages" add constraint "private_messages_chat_id_fkey" FOREIGN KEY (chat_id) REFERENCES private_chats(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_messages' and c.conname='private_messages_message_type_check'
  ) then
    execute 'alter table public."private_messages" add constraint "private_messages_message_type_check" CHECK ((message_type = ANY (ARRAY[''text''::text, ''system''::text])))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_messages' and c.conname='private_messages_pkey'
  ) then
    execute 'alter table public."private_messages" add constraint "private_messages_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='private_messages' and c.conname='private_messages_sender_id_fkey'
  ) then
    execute 'alter table public."private_messages" add constraint "private_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES members(id) ON DELETE SET NULL';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='profiles' and c.conname='profiles_approval_status_check'
  ) then
    execute 'alter table public."profiles" add constraint "profiles_approval_status_check" CHECK ((approval_status = ANY (ARRAY[''pending''::text, ''approved''::text, ''rejected''::text])))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='profiles' and c.conname='profiles_id_fkey'
  ) then
    execute 'alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='profiles' and c.conname='profiles_nickname_key'
  ) then
    execute 'alter table public."profiles" add constraint "profiles_nickname_key" UNIQUE (nickname)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='profiles' and c.conname='profiles_pkey'
  ) then
    execute 'alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='push_subscriptions' and c.conname='push_subscriptions_endpoint_key'
  ) then
    execute 'alter table public."push_subscriptions" add constraint "push_subscriptions_endpoint_key" UNIQUE (endpoint)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='push_subscriptions' and c.conname='push_subscriptions_pkey'
  ) then
    execute 'alter table public."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='push_subscriptions' and c.conname='push_subscriptions_user_id_fkey'
  ) then
    execute 'alter table public."push_subscriptions" add constraint "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_chat_settings' and c.conname='room_chat_settings_pkey'
  ) then
    execute 'alter table public."room_chat_settings" add constraint "room_chat_settings_pkey" PRIMARY KEY (room_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_members' and c.conname='room_members_member_id_fkey'
  ) then
    execute 'alter table public."room_members" add constraint "room_members_member_id_fkey" FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_members' and c.conname='room_members_pkey'
  ) then
    execute 'alter table public."room_members" add constraint "room_members_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_members' and c.conname='room_members_room_id_fkey'
  ) then
    execute 'alter table public."room_members" add constraint "room_members_room_id_fkey" FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_members' and c.conname='room_members_room_id_member_id_key'
  ) then
    execute 'alter table public."room_members" add constraint "room_members_room_id_member_id_key" UNIQUE (room_id, member_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_restrictions' and c.conname='room_restrictions_created_by_fkey'
  ) then
    execute 'alter table public."room_restrictions" add constraint "room_restrictions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_restrictions' and c.conname='room_restrictions_member_id_fkey'
  ) then
    execute 'alter table public."room_restrictions" add constraint "room_restrictions_member_id_fkey" FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_restrictions' and c.conname='room_restrictions_pkey'
  ) then
    execute 'alter table public."room_restrictions" add constraint "room_restrictions_pkey" PRIMARY KEY (id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_restrictions' and c.conname='room_restrictions_restriction_type_check'
  ) then
    execute 'alter table public."room_restrictions" add constraint "room_restrictions_restriction_type_check" CHECK ((restriction_type = ANY (ARRAY[''kicked''::text, ''banned''::text])))';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='room_restrictions' and c.conname='room_restrictions_room_id_fkey'
  ) then
    execute 'alter table public."room_restrictions" add constraint "room_restrictions_room_id_fkey" FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE';
  end if;
end $$;


-- Essential fixed room used by the current frontend and auto-event engine.
insert into public.chat_rooms (id, name, description, is_active)
values (
  '0a495a02-bcb8-4e38-b3ef-4e7059c2a883'::uuid,
  'VIP 이벤트 혜택방',
  'AI PROCESS VIP 그룹 라운지',
  true
)
on conflict (id) do nothing;

insert into public.room_chat_settings (room_id, is_frozen, updated_at)
values (
  '0a495a02-bcb8-4e38-b3ef-4e7059c2a883'::uuid,
  false,
  now()
)
on conflict (room_id) do nothing;

CREATE OR REPLACE FUNCTION public.admin_delete_group_message(target_message_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_current_user_admin() then
    raise exception '관리자만 메시지를 삭제할 수 있습니다.';
  end if;

  delete from public.group_messages
  where id = target_message_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_private_message(target_message_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_current_user_admin() then
    raise exception '관리자만 메시지를 삭제할 수 있습니다.';
  end if;

  delete from public.private_messages
  where id = target_message_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_or_create_private_chat(target_member_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result_chat_id uuid;
begin
  -- 관리자 확인
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and approval_status = 'approved'
  ) then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;

  -- 선택한 회원 확인
  if not exists (
    select 1
    from public.profiles
    where id = target_member_id
      and approval_status = 'approved'
      and show_in_admin_chat = true
      and coalesce(role, 'member') <> 'admin'
  ) then
    raise exception '사용할 수 없는 회원입니다.';
  end if;

  -- 기존 상담방 확인
  select id
  into result_chat_id
  from public.private_chats
  where member_id = target_member_id
  limit 1;

  -- 기존 상담방이 있으면 다시 열기
  if result_chat_id is not null then
    update public.private_chats
    set
      operator_id = auth.uid(),
      status = 'open',
      updated_at = now()
    where id = result_chat_id;

    return result_chat_id;
  end if;

  -- members 테이블에도 회원이 존재하도록 보장
  insert into public.members (
    id,
    nickname,
    password_hash,
    role,
    status,
    approved_at
  )
  select
    id,
    nickname,
    'SUPABASE_AUTH',
    'member',
    'approved',
    now()
  from public.profiles
  where id = target_member_id
  on conflict (id) do update
  set
    nickname = excluded.nickname,
    status = 'approved';

  -- 새 상담방 생성
  insert into public.private_chats (
    member_id,
    operator_id,
    status
  )
  values (
    target_member_id,
    auth.uid(),
    'open'
  )
  returning id into result_chat_id;

  return result_chat_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_kick_member(target_member_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_current_user_admin() then
    raise exception '관리자만 회원을 퇴장시킬 수 있습니다.';
  end if;

  if target_member_id = auth.uid() then
    raise exception '관리자 본인은 퇴장시킬 수 없습니다.';
  end if;

  if exists (
    select 1 from public.profiles
    where id = target_member_id and role = 'admin'
  ) then
    raise exception '다른 관리자는 퇴장시킬 수 없습니다.';
  end if;

  update public.profiles
  set approval_status = 'rejected'
  where id = target_member_id;

  update public.members
  set status = 'rejected'
  where id = target_member_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.announce_event_winner_to_group()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_event public.events%rowtype;
  v_winner_name text;
  v_admin_id uuid;
  v_game_name text;
begin
  select * into v_event
  from public.events
  where id = new.event_id;

  if not found then
    return new;
  end if;

  select nickname into v_winner_name
  from public.profiles
  where id = new.member_id;

  select id into v_admin_id
  from public.profiles
  where role = 'admin'
    and approval_status = 'approved'
  order by created_at asc
  limit 1;

  if v_admin_id is null then
    return new;
  end if;

  v_game_name := public.event_type_korean(v_event.event_type);

  insert into public.group_messages(
    room_id,
    member_id,
    message_type,
    content,
    is_deleted,
    created_at
  )
  values (
    v_event.room_id,
    v_admin_id,
    'text',
    '🎉 축하드립니다!' || E'\n\n' ||
    '이번 ' || v_game_name || ' 이벤트 당첨자는' || E'\n' ||
    '🏆 ' || coalesce(v_winner_name, 'VIP 회원') || ' 님입니다!' || E'\n\n' ||
    '🎁 상품은 1:1 문의로 즉시 지급됩니다.' || E'\n' ||
    '당첨을 진심으로 축하드립니다! ✨',
    false,
    now()
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_daily_auto_events(target_date date DEFAULT ((now() AT TIME ZONE 'Asia/Seoul'::text))::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare

  room_uuid uuid :=
    '0a495a02-bcb8-4e38-b3ef-4e7059c2a883';

  i integer;

  event_start timestamp;
  event_end timestamp;

  selected_type text;
  selected_title text;
  selected_description text;

  created_event_id uuid;

begin

  for i in 0..19 loop

    event_start :=
      target_date::timestamp
      + time '11:00'
      + (interval '435 minutes' * i / 19.0);

    event_end :=
      event_start + interval '15 minutes';


    case (i % 7)

      when 0 then

        selected_type := 'gift_box';

        selected_title :=
          '🎁 랜덤 선물상자';

        selected_description :=
          '4개의 선물상자 중 하나를 선택하세요. 당첨 상자를 선택한 회원이 여러 명이면 그중 1명을 무작위로 선정합니다.';


      when 1 then

        selected_type := 'number';

        selected_title :=
          '🎯 숫자 맞히기';

        selected_description :=
          '1부터 100까지 숫자 하나를 선택하세요. 정답자가 여러 명이면 1명을 무작위 선정하며, 정답자가 없으면 가장 가까운 숫자를 선택한 회원 중 1명을 선정합니다.';


      when 2 then

        selected_type := 'roulette';

        selected_title :=
          '🎰 행운의 룰렛';

        selected_description :=
          '룰렛을 돌려 이벤트에 응모하세요. 회차 종료 후 실제 참여자 중 1명을 서버에서 무작위 선정합니다.';


      when 3 then

        selected_type := 'first_come';

        selected_title :=
          '⚡ 선착순 미션';

        selected_description :=
          '이벤트 시작 후 가장 먼저 정상 접수된 회원 1명이 즉시 당첨됩니다. 서버 접수시간을 기준으로 판정합니다.';


      when 4 then

        selected_type := 'quiz';

        selected_title :=
          '🧩 오늘의 퀴즈';

        selected_description :=
          '4개의 보기 중 정답 하나를 선택하세요. 정답자가 여러 명이면 정답자 중 1명을 무작위로 선정합니다.';


      when 5 then

        selected_type := 'draw';

        selected_title :=
          '🎟️ 자동 추첨';

        selected_description :=
          '한 번 응모하면 참여 완료됩니다. 회차 종료 후 실제 응모자 중 1명을 무작위로 선정합니다.';


      else

        selected_type := 'attendance';

        selected_title :=
          '📅 누적 출석';

        selected_description :=
          '출석 버튼을 눌러 오늘의 출석 기록을 남기세요. 해당 회차 출석자 중 1명을 무작위로 선정합니다.';

    end case;


    insert into public.events (
      room_id,
      created_by,
      title,
      description,
      prize,
      event_type,
      status,
      winner_count,
      starts_at,
      ends_at,
      schedule_date,
      round_number,
      auto_event
    )

    values (
      room_uuid,
      null,
      selected_title,
      selected_description,
      'VIP EVENT 당첨',
      selected_type,
      'scheduled',
      1,

      event_start at time zone 'Asia/Seoul',
      event_end at time zone 'Asia/Seoul',

      target_date,
      i + 1,
      true
    )

    on conflict do nothing;

  end loop;


  -- 오늘 생성되어 있는 모든 자동 이벤트에
  -- 게임 설정을 붙임.
  for created_event_id in

    select id
    from public.events

    where auto_event = true
      and schedule_date = target_date

  loop

    perform public.setup_event_game(
      created_event_id
    );

  end loop;

end;
$function$;

CREATE OR REPLACE FUNCTION public.event_type_korean(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case t
    when 'gift_box' then '랜덤 선물상자'
    when 'number' then '숫자 맞히기'
    when 'roulette' then '룰렛'
    when 'first_come' then '선착순'
    when 'quiz' then '퀴즈'
    when 'draw' then '자동 추첨'
    when 'attendance' then '출석'
    else coalesce(t, '이벤트')
  end;
$function$;

CREATE OR REPLACE FUNCTION public.finish_auto_event(target_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare

  target_event public.events%rowtype;

  selected_member uuid;

  secret_value text;

  minimum_difference integer;

begin

  select *
  into target_event

  from public.events

  where id = target_event_id

  for update;


  if not found then
    return;
  end if;


  -- 이미 완료된 이벤트는 절대 재추첨하지 않음
  if target_event.status = 'completed' then
    return;
  end if;


  -- 이미 당첨자가 존재한다면
  -- 당첨자를 바꾸지 않고 완료만 처리
  if exists (

    select 1

    from public.event_winners

    where event_id =
      target_event_id

  ) then

    update public.events

    set
      status = 'completed',
      completed_at =
        coalesce(completed_at, now())

    where id =
      target_event_id;

    return;

  end if;


  perform public.setup_event_game(
    target_event_id
  );


  select secret_answer
  into secret_value

  from public.event_game_secrets

  where event_id =
    target_event_id;


  -- =====================================================
  -- 선물상자
  -- 당첨 상자를 선택한 회원 중 랜덤 1명
  -- =====================================================

  if target_event.event_type = 'gift_box' then

    select ee.member_id
    into selected_member

    from public.event_entries ee

    where ee.event_id =
      target_event_id

      and ee.answer =
        secret_value

    order by random()

    limit 1;


  -- =====================================================
  -- 숫자 맞히기
  -- 정확한 정답자 우선
  -- =====================================================

  elsif target_event.event_type = 'number' then

    select ee.member_id
    into selected_member

    from public.event_entries ee

    where ee.event_id =
      target_event_id

      and ee.answer::integer =
        secret_value::integer

    order by random()

    limit 1;


    -- 정답자가 없으면 가장 가까운 숫자
    if selected_member is null then

      select
        min(
          abs(
            ee.answer::integer -
            secret_value::integer
          )
        )

      into minimum_difference

      from public.event_entries ee

      where ee.event_id =
        target_event_id;


      if minimum_difference is not null then

        select ee.member_id
        into selected_member

        from public.event_entries ee

        where ee.event_id =
          target_event_id

          and abs(
            ee.answer::integer -
            secret_value::integer
          ) =
          minimum_difference

        order by random()

        limit 1;

      end if;

    end if;


  -- =====================================================
  -- 퀴즈
  -- 정답자 중 랜덤 1명
  -- =====================================================

  elsif target_event.event_type = 'quiz' then

    select ee.member_id
    into selected_member

    from public.event_entries ee

    where ee.event_id =
      target_event_id

      and ee.is_correct = true

    order by random()

    limit 1;


  -- =====================================================
  -- 선착순
  -- 정상적으로는 참여 순간 이미 결정됨.
  -- 혹시 기존 데이터가 있으면 가장 빠른 접수자 사용.
  -- =====================================================

  elsif target_event.event_type = 'first_come' then

    select ee.member_id
    into selected_member

    from public.event_entries ee

    where ee.event_id =
      target_event_id

    order by
      ee.submitted_at asc,
      ee.id asc

    limit 1;


  -- =====================================================
  -- 룰렛 / 자동추첨 / 출석
  -- 실제 참여자 중 랜덤 1명
  -- =====================================================

  else

    select ee.member_id
    into selected_member

    from public.event_entries ee

    where ee.event_id =
      target_event_id

    order by random()

    limit 1;

  end if;


  -- 당첨자 저장
  if selected_member is not null then

    insert into public.event_winners (
      event_id,
      member_id,
      rank
    )

    values (
      target_event_id,
      selected_member,
      1
    )

    on conflict (event_id)
    do nothing;

  end if;


  -- 완료 처리
  update public.events

  set
    status = 'completed',
    completed_at = now()

  where id =
    target_event_id;

end;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_member_list()
 RETURNS TABLE(member_id uuid, nickname text, avatar text, chat_id uuid, chat_status text, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.id as member_id,
    p.nickname,
    p.avatar,
    pc.id as chat_id,
    pc.status as chat_status,
    pc.updated_at
  from public.profiles p
  left join public.private_chats pc
    on pc.member_id = p.id
  where p.approval_status = 'approved'
    and coalesce(p.role, 'member') <> 'admin'
    and p.show_in_admin_chat = true
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.approval_status = 'approved'
    )
  order by
    case when pc.updated_at is null then 1 else 0 end,
    pc.updated_at desc nulls last,
    p.nickname asc;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_private_chats()
 RETURNS TABLE(chat_id uuid, member_id uuid, nickname text, avatar text, status text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    pc.id as chat_id,
    pc.member_id,
    p.nickname,
    p.avatar,
    pc.status,
    pc.created_at,
    pc.updated_at
  from public.private_chats pc
  join public.profiles p
    on p.id = pc.member_id
  where pc.operator_id = auth.uid()
    and pc.status = 'open'
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.approval_status = 'approved'
    )
  order by pc.updated_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_private_unread_counts()
 RETURNS TABLE(chat_id uuid, unread_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    pc.id as chat_id,
    count(pm.id) as unread_count
  from public.private_chats pc
  left join public.private_messages pm
    on pm.chat_id = pc.id
    and pm.sender_id = pc.member_id
    and pm.is_read = false
    and pm.is_deleted = false
  where pc.operator_id = auth.uid()
    and pc.status = 'open'
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.approval_status = 'approved'
    )
  group by pc.id;
$function$;

CREATE OR REPLACE FUNCTION public.get_auto_events()
 RETURNS TABLE(event_id uuid, title text, description text, prize text, event_type text, status text, starts_at timestamp with time zone, ends_at timestamp with time zone, round_number integer, participated boolean, winner_nickname text, my_answer text, my_result_text text, quiz_question text, quiz_option_1 text, quiz_option_2 text, quiz_option_3 text, quiz_option_4 text, revealed_answer text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  select

    e.id,

    e.title,
    e.description,
    e.prize,

    e.event_type,
    e.status,

    e.starts_at,
    e.ends_at,

    e.round_number,

    exists (
      select 1
      from public.event_entries ee
      where ee.event_id = e.id
        and ee.member_id = auth.uid()
    ) as participated,

    (
      select p.nickname
      from public.event_winners ew
      join public.profiles p
        on p.id = ew.member_id
      where ew.event_id = e.id
      limit 1
    ) as winner_nickname,

    (
      select ee.answer
      from public.event_entries ee
      where ee.event_id = e.id
        and ee.member_id = auth.uid()
      limit 1
    ) as my_answer,

    (
      select ee.result_text
      from public.event_entries ee
      where ee.event_id = e.id
        and ee.member_id = auth.uid()
      limit 1
    ) as my_result_text,

    case
      when e.event_type = 'quiz'
      then q.question
      else null
    end as quiz_question,

    case
      when e.event_type = 'quiz'
      then q.option_1
      else null
    end as quiz_option_1,

    case
      when e.event_type = 'quiz'
      then q.option_2
      else null
    end as quiz_option_2,

    case
      when e.event_type = 'quiz'
      then q.option_3
      else null
    end as quiz_option_3,

    case
      when e.event_type = 'quiz'
      then q.option_4
      else null
    end as quiz_option_4,

    case

      when e.status <> 'completed'
      then null

      when e.event_type = 'number'
      then s.secret_answer

      when e.event_type = 'gift_box'
      then s.secret_answer

      when e.event_type = 'quiz'
      then q.correct_option::text

      else null

    end as revealed_answer

  from public.events e

  left join public.event_game_secrets s
    on s.event_id = e.id

  /*
    핵심 수정:
    quiz 이벤트일 때만 secret_answer를 UUID로 변환한다.
    선물상자/숫자의 "1", "4", "57" 같은 값은
    절대로 UUID 변환을 시도하지 않는다.
  */
  left join public.event_quiz_bank q
    on e.event_type = 'quiz'
    and s.secret_answer is not null
    and q.id::text = s.secret_answer

  where e.auto_event = true
    and e.schedule_date =
      (now() at time zone 'Asia/Seoul')::date

  order by e.round_number;

$function$;

CREATE OR REPLACE FUNCTION public.get_chat_avatars()
 RETURNS TABLE(id uuid, avatar text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- 승인된 일반 회원 프로필
  select
    p.id,
    p.avatar
  from public.profiles p
  where p.approval_status = 'approved'
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.approval_status = 'approved'
    )

  union all

  -- 활성화된 AI 캐릭터 프로필
  select
    a.id,
    a.avatar
  from public.ai_characters a
  where a.is_active = true
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.approval_status = 'approved'
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_group_chat_state(target_room_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select is_frozen from public.room_chat_settings where room_id = target_room_id), false);
$function$;

CREATE OR REPLACE FUNCTION public.get_my_private_unread_count()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)
  from public.private_messages pm
  join public.private_chats pc
    on pc.id = pm.chat_id
  where pc.member_id = auth.uid()
    and pm.sender_id <> auth.uid()
    and pm.is_read = false
    and pm.is_deleted = false;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_admin_chat()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  admin_id uuid;
  chat_id uuid;
begin
  -- 승인된 관리자 찾기
  select id into admin_id
  from public.profiles
  where role = 'admin'
    and approval_status = 'approved'
  limit 1;

  if admin_id is null then
    raise exception '관리자 계정을 찾을 수 없습니다.';
  end if;

  -- 관리자가 자기 자신과 상담방을 만드는 것은 막기
  if auth.uid() = admin_id then
    raise exception '관리자 계정입니다.';
  end if;

  -- 승인된 회원만 사용 가능
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and approval_status = 'approved'
  ) then
    raise exception '승인된 회원만 이용할 수 있습니다.';
  end if;

  -- 기존 상담방 찾기
  select id into chat_id
  from public.private_chats
  where member_id = auth.uid()
    and operator_id = admin_id
  limit 1;

  -- 없으면 새 상담방 생성
  if chat_id is null then
    insert into public.private_chats (
      member_id,
      operator_id,
      status
    )
    values (
      auth.uid(),
      admin_id,
      'open'
    )
    returning id into chat_id;
  end if;

  return chat_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (
    id,
    nickname,
    real_name,
    approval_status
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'nickname',
    new.raw_user_meta_data ->> 'real_name',
    'pending'
  );

  return new;
end;
$function$;

-- Create a profile automatically after Supabase Auth signup.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and approval_status = 'approved'
  );
$function$;

CREATE OR REPLACE FUNCTION public.join_auto_event(target_event_id uuid, submitted_answer text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare

  target_event public.events%rowtype;

  secret_value text;

  quiz_correct integer;

  submitted_number integer;

  submitted_box integer;

begin

  -- 로그인 확인
  if auth.uid() is null then

    raise exception
      '로그인이 필요합니다.';

  end if;


  -- 승인 회원 확인
  if not exists (

    select 1

    from public.profiles

    where id = auth.uid()
      and approval_status = 'approved'

  ) then

    raise exception
      '승인된 회원만 참여할 수 있습니다.';

  end if;


  -- 이벤트 잠금
  select *
  into target_event

  from public.events

  where id = target_event_id

  for update;


  if not found then

    raise exception
      '이벤트를 찾을 수 없습니다.';

  end if;


  -- 서버시간 기준
  if now() < target_event.starts_at then

    return jsonb_build_object(
      'success', false,
      'message',
      '아직 시작되지 않은 이벤트입니다.'
    );

  end if;


  if now() >= target_event.ends_at then

    return jsonb_build_object(
      'success', false,
      'message',
      '이미 종료된 이벤트입니다.'
    );

  end if;


  if target_event.status = 'completed' then

    return jsonb_build_object(
      'success', false,
      'message',
      '이미 종료된 이벤트입니다.'
    );

  end if;


  -- 중복 참여 확인
  if exists (

    select 1

    from public.event_entries

    where event_id = target_event_id
      and member_id = auth.uid()

  ) then

    return jsonb_build_object(
      'success', false,
      'message',
      '이미 참여한 이벤트입니다.'
    );

  end if;


  -- 게임 설정 보장
  perform public.setup_event_game(
    target_event_id
  );


  select secret_answer
  into secret_value

  from public.event_game_secrets

  where event_id = target_event_id;


  -- =====================================================
  -- 숫자 맞히기
  -- =====================================================

  if target_event.event_type = 'number' then

    begin

      submitted_number :=
        trim(submitted_answer)::integer;

    exception when others then

      return jsonb_build_object(
        'success', false,
        'message',
        '1부터 100까지 숫자를 선택해주세요.'
      );

    end;


    if submitted_number < 1
       or submitted_number > 100 then

      return jsonb_build_object(
        'success', false,
        'message',
        '숫자는 1부터 100까지만 선택할 수 있습니다.'
      );

    end if;


    insert into public.event_entries (
      event_id,
      member_id,
      answer,
      is_correct,
      result_text,
      submitted_at
    )

    values (
      target_event_id,
      auth.uid(),
      submitted_number::text,

      submitted_number::text =
        secret_value,

      '숫자 선택 완료',
      now()
    );


    return jsonb_build_object(
      'success', true,
      'message',
      submitted_number ||
      '번으로 참여가 완료되었습니다.'
    );


  -- =====================================================
  -- 선물상자
  -- =====================================================

  elsif target_event.event_type = 'gift_box' then

    begin

      submitted_box :=
        trim(submitted_answer)::integer;

    exception when others then

      return jsonb_build_object(
        'success', false,
        'message',
        '선물상자를 선택해주세요.'
      );

    end;


    if submitted_box < 1
       or submitted_box > 4 then

      return jsonb_build_object(
        'success', false,
        'message',
        '1번부터 4번까지의 선물상자 중 하나를 선택해주세요.'
      );

    end if;


    insert into public.event_entries (
      event_id,
      member_id,
      answer,
      is_correct,
      result_text,
      submitted_at
    )

    values (
      target_event_id,
      auth.uid(),
      submitted_box::text,

      submitted_box::text =
        secret_value,

      submitted_box ||
        '번 선물상자 선택 완료',

      now()
    );


    return jsonb_build_object(
      'success', true,
      'message',
      submitted_box ||
      '번 선물상자를 선택했습니다.'
    );


  -- =====================================================
  -- 퀴즈
  -- =====================================================

  elsif target_event.event_type = 'quiz' then

    begin

      submitted_number :=
        trim(submitted_answer)::integer;

    exception when others then

      return jsonb_build_object(
        'success', false,
        'message',
        '퀴즈 정답을 선택해주세요.'
      );

    end;


    if submitted_number < 1
       or submitted_number > 4 then

      return jsonb_build_object(
        'success', false,
        'message',
        '보기 중 하나를 선택해주세요.'
      );

    end if;


    select q.correct_option
    into quiz_correct

    from public.event_quiz_bank q

    where q.id = secret_value::uuid;


    insert into public.event_entries (
      event_id,
      member_id,
      answer,
      is_correct,
      result_text,
      submitted_at
    )

    values (
      target_event_id,
      auth.uid(),
      submitted_number::text,

      submitted_number =
        quiz_correct,

      case

        when submitted_number =
          quiz_correct

        then '정답 제출 완료'

        else '답안 제출 완료'

      end,

      now()
    );


    -- 진행 중에는 정답 여부를 바로 공개하지 않음.
    return jsonb_build_object(
      'success', true,
      'message',
      '답안 제출이 완료되었습니다. 정답과 결과는 회차 종료 후 공개됩니다.'
    );


  -- =====================================================
  -- 선착순
  -- 이벤트 row를 FOR UPDATE로 잠근 상태이므로
  -- 동시에 눌러도 먼저 DB에 들어온 요청 1명만 당첨
  -- =====================================================

  elsif target_event.event_type = 'first_come' then


    if exists (

      select 1

      from public.event_winners

      where event_id =
        target_event_id

    ) then

      return jsonb_build_object(
        'success', false,
        'message',
        '선착순 당첨자가 이미 결정되었습니다.'
      );

    end if;


    insert into public.event_entries (
      event_id,
      member_id,
      answer,
      is_correct,
      result_text,
      submitted_at
    )

    values (
      target_event_id,
      auth.uid(),
      null,
      true,
      '선착순 1위',
      now()
    );


    insert into public.event_winners (
      event_id,
      member_id,
      rank
    )

    values (
      target_event_id,
      auth.uid(),
      1
    )

    on conflict (event_id)
    do nothing;


    update public.events

    set
      status = 'completed',
      completed_at = now()

    where id = target_event_id;


    return jsonb_build_object(
      'success', true,
      'winner', true,
      'message',
      '축하합니다! 가장 먼저 참여하여 선착순 당첨자로 선정되었습니다.'
    );


  -- =====================================================
  -- 룰렛
  -- =====================================================

  elsif target_event.event_type = 'roulette' then

    insert into public.event_entries (
      event_id,
      member_id,
      answer,
      is_correct,
      result_text,
      submitted_at
    )

    values (
      target_event_id,
      auth.uid(),
      'roulette',
      null,
      '룰렛 참여 완료',
      now()
    );


    return jsonb_build_object(
      'success', true,
      'message',
      '룰렛 참여가 완료되었습니다. 회차 종료 후 참여자 중 1명이 무작위로 선정됩니다.'
    );


  -- =====================================================
  -- 자동 추첨
  -- =====================================================

  elsif target_event.event_type = 'draw' then

    insert into public.event_entries (
      event_id,
      member_id,
      answer,
      is_correct,
      result_text,
      submitted_at
    )

    values (
      target_event_id,
      auth.uid(),
      null,
      null,
      '자동 추첨 응모 완료',
      now()
    );


    return jsonb_build_object(
      'success', true,
      'message',
      '응모가 완료되었습니다. 회차 종료 후 참여자 중 1명이 무작위로 선정됩니다.'
    );


  -- =====================================================
  -- 출석
  -- =====================================================

  elsif target_event.event_type = 'attendance' then

    insert into public.event_entries (
      event_id,
      member_id,
      answer,
      is_correct,
      result_text,
      submitted_at
    )

    values (
      target_event_id,
      auth.uid(),
      null,
      null,
      '출석 완료',
      now()
    );


    insert into public.attendance_records (
      event_id,
      member_id,
      attendance_date
    )

    values (
      target_event_id,
      auth.uid(),
      (now() at time zone 'Asia/Seoul')::date
    )

    on conflict do nothing;


    return jsonb_build_object(
      'success', true,
      'message',
      '출석이 완료되었습니다.'
    );


  else

    return jsonb_build_object(
      'success', false,
      'message',
      '지원하지 않는 이벤트입니다.'
    );

  end if;

end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_private_chat_read(target_chat_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1
    from public.private_chats pc
    where pc.id = target_chat_id
      and (
        pc.member_id = auth.uid()
        or pc.operator_id = auth.uid()
      )
  ) then
    raise exception '접근할 수 없는 상담방입니다.';
  end if;

  update public.private_messages
  set is_read = true
  where chat_id = target_chat_id
    and sender_id <> auth.uid()
    and is_read = false
    and is_deleted = false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.run_auto_event_engine()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare

  korea_today date;

  target record;

begin

  korea_today :=
    (now() at time zone 'Asia/Seoul')::date;


  -- 오늘 이벤트 생성 + 게임 설정
  perform public.create_daily_auto_events(
    korea_today
  );


  -- 기존 오늘 이벤트에도 설정이 빠져있으면 생성
  for target in

    select id

    from public.events

    where auto_event = true
      and schedule_date =
        korea_today

  loop

    perform public.setup_event_game(
      target.id
    );

  end loop;


  -- 시작 시간이 된 이벤트 활성화
  update public.events

  set status = 'active'

  where auto_event = true

    and status = 'scheduled'

    and starts_at <= now()

    and ends_at > now();


  -- 종료시간이 지난 이벤트 마감
  for target in

    select id

    from public.events

    where auto_event = true

      and status in (
        'scheduled',
        'active'
      )

      and ends_at <= now()

  loop

    perform public.finish_auto_event(
      target.id
    );

  end loop;

end;
$function$;

CREATE OR REPLACE FUNCTION public.set_group_chat_frozen(target_room_id uuid, frozen boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and approval_status = 'approved'
  ) then
    raise exception '관리자만 변경할 수 있습니다.';
  end if;

  insert into public.room_chat_settings(room_id, is_frozen, updated_at, updated_by)
  values(target_room_id, frozen, now(), auth.uid())
  on conflict (room_id) do update
  set is_frozen = excluded.is_frozen,
      updated_at = now(),
      updated_by = auth.uid();

  return frozen;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_my_avatar(new_avatar text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new_avatar not in (
    'vip_01',
    'vip_02',
    'vip_03',
    'vip_04',
    'vip_05',
    'vip_06'
  ) then
    raise exception 'Invalid avatar';
  end if;

  update public.profiles
  set avatar = new_avatar
  where id = auth.uid()
    and approval_status = 'approved';

  if not found then
    raise exception 'Approved profile not found';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.setup_event_game(target_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare

  target_type text;

  random_number integer;

  random_box integer;

  quiz_row record;

begin

  select event_type
  into target_type
  from public.events
  where id = target_event_id;


  if not found then
    return;
  end if;


  -- 이미 설정되어 있으면 절대 다시 만들지 않음.
  -- 즉 정답이 중간에 바뀌지 않음.
  if exists (
    select 1
    from public.event_game_secrets
    where event_id = target_event_id
  ) then
    return;
  end if;


  -- ==========================================
  -- 숫자 맞히기
  -- 서버에서 1~100 정답 생성
  -- ==========================================

  if target_type = 'number' then

    random_number :=
      floor(random() * 100 + 1)::integer;

    insert into public.event_game_secrets (
      event_id,
      secret_answer
    )
    values (
      target_event_id,
      random_number::text
    )

    on conflict (event_id)
    do nothing;


  -- ==========================================
  -- 랜덤 선물상자
  -- 1~4 중 당첨 상자 지정
  -- ==========================================

  elsif target_type = 'gift_box' then

    random_box :=
      floor(random() * 4 + 1)::integer;

    insert into public.event_game_secrets (
      event_id,
      secret_answer
    )
    values (
      target_event_id,
      random_box::text
    )

    on conflict (event_id)
    do nothing;


  -- ==========================================
  -- 퀴즈
  -- 문제은행에서 랜덤 문제 선택
  -- secret_answer에는 문제 ID 저장
  -- ==========================================

  elsif target_type = 'quiz' then

    select
      q.id,
      q.correct_option
    into quiz_row

    from public.event_quiz_bank q

    where q.active = true

    order by random()

    limit 1;


    if quiz_row.id is not null then

      insert into public.event_game_secrets (
        event_id,
        secret_answer
      )
      values (
        target_event_id,
        quiz_row.id::text
      )

      on conflict (event_id)
      do nothing;

    end if;


  -- ==========================================
  -- 나머지 게임
  -- 별도 정답은 필요 없지만
  -- 설정 완료 표시를 위해 row 생성
  -- ==========================================

  else

    insert into public.event_game_secrets (
      event_id,
      secret_answer
    )
    values (
      target_event_id,
      null
    )

    on conflict (event_id)
    do nothing;

  end if;

end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_approved_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.approval_status = 'approved' then

    insert into public.members (
      id,
      nickname,
      password_hash,
      role,
      status,
      approved_at
    )
    values (
      new.id,
      new.nickname,
      'SUPABASE_AUTH',
      'member',
      'approved',
      now()
    )
    on conflict (id) do update
    set
      nickname = excluded.nickname,
      status = 'approved',
      approved_at = coalesce(members.approved_at, now());

  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.touch_private_chat_on_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.private_chats
  set updated_at = now()
  where id = new.chat_id;

  return new;
end;
$function$;

alter table public."group_messages" enable row level security;

alter table public."members" enable row level security;

alter table public."private_chats" enable row level security;

alter table public."private_messages" enable row level security;

alter table public."profiles" enable row level security;

alter table public."push_subscriptions" enable row level security;

alter table public."room_chat_settings" enable row level security;

drop policy if exists "Approved members can read group messages" on public."group_messages";
create policy "Approved members can read group messages"
on public."group_messages" for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.approval_status = 'approved'
  )
);

drop policy if exists "Approved members can send group messages" on public."group_messages";
create policy "Approved members can send group messages" on public."group_messages" for INSERT to authenticated with check (((member_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.approval_status = 'approved'::text)))) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text) AND (p.approval_status = 'approved'::text)))) OR (((timezone('Asia/Seoul'::text, now()))::time without time zone >= '11:00:00'::time without time zone) AND ((timezone('Asia/Seoul'::text, now()))::time without time zone < '18:30:00'::time without time zone) AND (NOT COALESCE(( SELECT s.is_frozen
   FROM room_chat_settings s
  WHERE (s.room_id = group_messages.room_id)), false))))));

drop policy if exists "Approved members can view member nicknames" on public."members";
create policy "Approved members can view member nicknames"
on public."members" for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.approval_status = 'approved'
  )
);

drop policy if exists "Private chat participants can view chats" on public."private_chats";
create policy "Private chat participants can view chats" on public."private_chats" for SELECT to authenticated using (((member_id = auth.uid()) OR (operator_id = auth.uid())));

drop policy if exists "Private chat participants can read messages" on public."private_messages";
create policy "Private chat participants can read messages"
on public."private_messages" for select to authenticated
using (
  exists (
    select 1 from public.private_chats pc
    where pc.id = private_messages.chat_id
      and (pc.member_id = auth.uid() or pc.operator_id = auth.uid())
  )
);

drop policy if exists "Private chat participants can send messages" on public."private_messages";
create policy "Private chat participants can send messages" on public."private_messages" for INSERT to authenticated with check (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM private_chats pc
  WHERE ((pc.id = private_messages.chat_id) AND ((pc.member_id = auth.uid()) OR (pc.operator_id = auth.uid())))))));

drop policy if exists "Users can view own profile" on public."profiles";
create policy "Users can view own profile" on public."profiles" for SELECT to authenticated using ((auth.uid() = id));

drop policy if exists "Users can delete own push subscriptions" on public."push_subscriptions";
create policy "Users can delete own push subscriptions" on public."push_subscriptions" for DELETE to authenticated using ((auth.uid() = user_id));

drop policy if exists "Users can insert own push subscriptions" on public."push_subscriptions";
create policy "Users can insert own push subscriptions" on public."push_subscriptions" for INSERT to authenticated with check ((auth.uid() = user_id));

drop policy if exists "Users can update own push subscriptions" on public."push_subscriptions";
create policy "Users can update own push subscriptions" on public."push_subscriptions" for UPDATE to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

drop policy if exists "Users can view own push subscriptions" on public."push_subscriptions";
create policy "Users can view own push subscriptions" on public."push_subscriptions" for SELECT to authenticated using ((auth.uid() = user_id));

drop policy if exists "Authenticated can read room chat settings" on public."room_chat_settings";
create policy "Authenticated can read room chat settings" on public."room_chat_settings" for SELECT to authenticated using (true);

drop trigger if exists "trg_announce_event_winner_to_group" on public."event_winners";
create trigger "trg_announce_event_winner_to_group" AFTER INSERT on public."event_winners" for each ROW EXECUTE FUNCTION announce_event_winner_to_group();

drop trigger if exists "touch_private_chat_on_new_message" on public."private_messages";
create trigger "touch_private_chat_on_new_message" AFTER INSERT on public."private_messages" for each ROW EXECUTE FUNCTION touch_private_chat_on_message();

drop trigger if exists "sync_profile_approval" on public."profiles";
drop trigger if exists "sync_profile_approval_insert" on public."profiles";
drop trigger if exists "sync_profile_approval_update" on public."profiles";
create trigger "sync_profile_approval_insert" AFTER INSERT on public."profiles" for each ROW EXECUTE FUNCTION sync_approved_member();
create trigger "sync_profile_approval_update" AFTER UPDATE on public."profiles" for each ROW EXECUTE FUNCTION sync_approved_member();

CREATE INDEX IF NOT EXISTS attendance_event_member_idx ON public.attendance_records USING btree (event_id, member_id);

CREATE INDEX IF NOT EXISTS event_entries_event_idx ON public.event_entries USING btree (event_id);

CREATE INDEX IF NOT EXISTS event_entries_member_idx ON public.event_entries USING btree (member_id);

CREATE UNIQUE INDEX IF NOT EXISTS event_entries_one_member_one_event ON public.event_entries USING btree (event_id, member_id);

CREATE INDEX IF NOT EXISTS event_winners_event_idx ON public.event_winners USING btree (event_id);

CREATE UNIQUE INDEX IF NOT EXISTS event_winners_one_winner_per_event ON public.event_winners USING btree (event_id);

CREATE UNIQUE INDEX IF NOT EXISTS events_auto_schedule_unique ON public.events USING btree (schedule_date, round_number) WHERE (auto_event = true);

CREATE INDEX IF NOT EXISTS events_room_status_idx ON public.events USING btree (room_id, status);

CREATE INDEX IF NOT EXISTS group_messages_room_created_idx ON public.group_messages USING btree (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS member_notes_member_idx ON public.member_notes USING btree (member_id);

CREATE INDEX IF NOT EXISTS members_nickname_idx ON public.members USING btree (nickname);

CREATE INDEX IF NOT EXISTS moderation_logs_operator_idx ON public.moderation_logs USING btree (operator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS moderation_logs_target_idx ON public.moderation_logs USING btree (target_member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS private_chats_operator_idx ON public.private_chats USING btree (operator_id);

CREATE INDEX IF NOT EXISTS private_messages_chat_created_idx ON public.private_messages USING btree (chat_id, created_at);

CREATE INDEX IF NOT EXISTS private_messages_unread_idx ON public.private_messages USING btree (chat_id, is_read);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);

CREATE INDEX IF NOT EXISTS room_members_member_idx ON public.room_members USING btree (member_id);

CREATE INDEX IF NOT EXISTS room_restrictions_lookup_idx ON public.room_restrictions USING btree (room_id, member_id, restriction_type);


-- pg_cron: 현재 운영 DB에서 확인된 작업
-- pg_cron extension이 활성화된 프로젝트에서 실행.
do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    if not exists (select 1 from cron.job where jobname='vip-auto-event-engine') then
      perform cron.schedule(
        'vip-auto-event-engine',
        '* * * * *',
        'select public.run_auto_event_engine();'
      );
    end if;
  end if;
end $$;

-- ============================================================
-- AI PROCESS / AVATAR75 UPGRADE
-- ============================================================

-- ============================================================
-- AI PROCESS VIP V2 upgrade
-- - 75 avatar keys
-- - AI PROCESS sessions / logs
-- - public live progress list
-- - admin start / stop
-- - member 5-minute market tick synchronization
-- Run once in Supabase SQL Editor after 01_current_schema.sql.
-- ============================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.ai_process_sessions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'idle' check (status in ('idle','running','completed','stopped')),
  start_amount numeric(18,2) not null default 0,
  current_amount numeric(18,2) not null default 0,
  total_profit numeric(18,2) not null default 0,
  total_return numeric(12,6) not null default 0,
  duration_hours integer not null default 24 check (duration_hours between 1 and 720),
  started_at timestamptz,
  ends_at timestamptz,
  completed_at timestamptz,
  last_market_at timestamptz,
  last_asset_symbol text,
  last_asset_name text,
  last_asset_type text,
  last_market_pct numeric(12,6),
  last_delta numeric(18,2),
  updated_at timestamptz not null default now()
);

create index if not exists ai_process_sessions_status_idx
  on public.ai_process_sessions(status, updated_at desc);

create table if not exists public.ai_process_logs (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  market_at timestamptz not null,
  asset_symbol text,
  asset_name text,
  asset_type text,
  market_pct numeric(12,6) not null default 0,
  amount_before numeric(18,2) not null default 0,
  delta numeric(18,2) not null default 0,
  amount_after numeric(18,2) not null default 0,
  result_type text not null check (result_type in ('profit','loss','wait')),
  created_at timestamptz not null default now(),
  unique(user_id, market_at)
);

create index if not exists ai_process_logs_user_market_idx
  on public.ai_process_logs(user_id, market_at desc);

alter table public.ai_process_sessions enable row level security;
alter table public.ai_process_logs enable row level security;

-- Approved members can read live session summaries. Writes happen through RPC only.
drop policy if exists "approved members can read ai process sessions" on public.ai_process_sessions;
create policy "approved members can read ai process sessions"
on public.ai_process_sessions for select
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.approval_status = 'approved'
  )
);

-- Detailed logs are private to the member and admins.
drop policy if exists "member or admin can read ai process logs" on public.ai_process_logs;
create policy "member or admin can read ai process logs"
on public.ai_process_logs for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.role = 'admin'
      and me.approval_status = 'approved'
  )
);

grant select on public.ai_process_sessions to authenticated;
grant select on public.ai_process_logs to authenticated;

-- 24 compact profiles + six legacy keys.
create or replace function public.set_my_avatar(new_avatar text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new_avatar !~ '^(vip_0[1-6]|(dog|cat|redpanda|quokka|penguin|panda|hedgehog|squirrel|meerkat|beaver|rabbit|otter)-(gold|blue|black))$' then
    raise exception 'Invalid avatar';
  end if;

  update public.profiles
  set avatar = new_avatar
  where id = auth.uid()
    and approval_status = 'approved';

  if not found then
    raise exception 'Approved profile not found';
  end if;
end;
$$;

grant execute on function public.set_my_avatar(text) to authenticated;

-- Public live list. It exposes only the fields intended for the shared AI PROCESS panel.
create or replace function public.get_ai_process_public_sessions()
returns table(
  user_id uuid,
  nickname text,
  avatar text,
  status text,
  start_amount numeric,
  current_amount numeric,
  total_profit numeric,
  total_return numeric,
  duration_hours integer,
  started_at timestamptz,
  ends_at timestamptz,
  last_asset_symbol text,
  last_asset_name text,
  last_asset_type text,
  last_market_pct numeric,
  last_delta numeric,
  updated_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $$
  select
    s.user_id,
    p.nickname,
    p.avatar,
    s.status,
    s.start_amount,
    s.current_amount,
    s.total_profit,
    s.total_return,
    s.duration_hours,
    s.started_at,
    s.ends_at,
    s.last_asset_symbol,
    s.last_asset_name,
    s.last_asset_type,
    s.last_market_pct,
    s.last_delta,
    s.updated_at
  from public.ai_process_sessions s
  join public.profiles p on p.id = s.user_id
  where s.status = 'running'
    and p.approval_status = 'approved'
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.approval_status = 'approved'
    )
  order by s.updated_at desc, p.nickname asc;
$$;

grant execute on function public.get_ai_process_public_sessions() to authenticated;

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

  if process_duration_hours is null or process_duration_hours < 1 or process_duration_hours > 720 then
    raise exception '진행시간은 1시간~720시간이어야 합니다.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = target_user_id
      and p.approval_status = 'approved'
      and coalesce(p.role,'member') <> 'admin'
  ) then
    raise exception '승인된 회원을 찾을 수 없습니다.';
  end if;

  insert into public.ai_process_sessions(
    user_id,status,start_amount,current_amount,total_profit,total_return,duration_hours,
    started_at,ends_at,completed_at,last_market_at,last_asset_symbol,last_asset_name,
    last_asset_type,last_market_pct,last_delta,updated_at
  ) values (
    target_user_id,'running',starting_amount,starting_amount,0,0,process_duration_hours,
    now(),now() + make_interval(hours => process_duration_hours),null,null,null,null,null,null,null,now()
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

create or replace function public.admin_stop_ai_process(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.role = 'admin'
      and me.approval_status = 'approved'
  ) then
    raise exception '관리자만 AI PROCESS를 종료할 수 있습니다.';
  end if;

  update public.ai_process_sessions
  set status='stopped', completed_at=now(), updated_at=now()
  where user_id = target_user_id and status='running';
end;
$$;

grant execute on function public.admin_stop_ai_process(uuid) to authenticated;

-- One 5-minute result for the current signed-in member.
-- The server calculates delta from the stored current amount and the linked market percentage.
create or replace function public.record_ai_process_tick(
  market_at timestamptz,
  asset_symbol text,
  asset_name text,
  asset_type text,
  market_pct numeric
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  s public.ai_process_sessions%rowtype;
  v_before numeric;
  v_delta numeric;
  v_after numeric;
  v_result text;
begin
  select * into s
  from public.ai_process_sessions
  where user_id = auth.uid()
  for update;

  if not found or s.status <> 'running' then
    raise exception '진행 중인 AI PROCESS가 없습니다.';
  end if;

  if s.ends_at is not null and now() >= s.ends_at then
    update public.ai_process_sessions
    set status='completed', completed_at=now(), updated_at=now()
    where user_id=auth.uid();
    raise exception 'AI PROCESS 진행시간이 종료되었습니다.';
  end if;

  if s.last_market_at is not null and market_at <= s.last_market_at then
    return to_jsonb(s);
  end if;

  v_before := s.current_amount;
  v_delta := round(v_before * coalesce(market_pct,0) / 100.0, 2);
  v_after := greatest(0, v_before + v_delta);
  v_result := case when v_delta > 0 then 'profit' when v_delta < 0 then 'loss' else 'wait' end;

  update public.ai_process_sessions
  set current_amount=v_after,
      total_profit=v_after-start_amount,
      total_return=case when start_amount > 0 then ((v_after-start_amount)/start_amount)*100 else 0 end,
      last_market_at=market_at,
      last_asset_symbol=asset_symbol,
      last_asset_name=asset_name,
      last_asset_type=asset_type,
      last_market_pct=coalesce(market_pct,0),
      last_delta=v_delta,
      updated_at=now()
  where user_id=auth.uid()
  returning * into s;

  insert into public.ai_process_logs(
    user_id,market_at,asset_symbol,asset_name,asset_type,market_pct,
    amount_before,delta,amount_after,result_type
  ) values (
    auth.uid(),market_at,asset_symbol,asset_name,asset_type,coalesce(market_pct,0),
    v_before,v_delta,v_after,v_result
  )
  on conflict(user_id,market_at) do nothing;

  return to_jsonb(s);
end;
$$;

grant execute on function public.record_ai_process_tick(timestamptz,text,text,text,numeric) to authenticated;

-- Add session summary table to Realtime once.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='ai_process_sessions'
  ) then
    alter publication supabase_realtime add table public.ai_process_sessions;
  end if;
end $$;

commit;
grant execute on function public.set_my_avatar(text) to authenticated;

-- Admin member approval / member list helpers
create or replace function public.get_admin_all_profiles()
returns table(
  member_id uuid,
  nickname text,
  real_name text,
  avatar text,
  role text,
  approval_status text,
  created_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $$
  select p.id, p.nickname, p.real_name, p.avatar, p.role, p.approval_status, p.created_at
  from public.profiles p
  where exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'admin'
      and me.approval_status = 'approved'
  )
  order by
    case when p.approval_status = 'pending' then 0 when p.approval_status = 'approved' then 1 else 2 end,
    p.created_at desc;
$$;

grant execute on function public.get_admin_all_profiles() to authenticated;

create or replace function public.admin_set_profile_approval(target_member_id uuid, target_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_current_user_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;

  if target_status not in ('approved','rejected') then
    raise exception '지원하지 않는 승인 상태입니다.';
  end if;

  if target_member_id = auth.uid() then
    raise exception '관리자 본인의 상태는 변경할 수 없습니다.';
  end if;

  if exists (
    select 1 from public.profiles
    where id = target_member_id and role = 'admin'
  ) then
    raise exception '다른 관리자 계정은 변경할 수 없습니다.';
  end if;

  update public.profiles
  set approval_status = target_status
  where id = target_member_id;

  if not found then
    raise exception '회원을 찾을 수 없습니다.';
  end if;

  if target_status = 'rejected' then
    update public.members
    set status = 'left', left_at = now()
    where id = target_member_id;
  end if;

  insert into public.moderation_logs(target_member_id, operator_id, action, reason)
  values (
    target_member_id,
    auth.uid(),
    case when target_status = 'approved' then 'approve' else 'reject' end,
    '관리자 화면에서 처리'
  );
end;
$$;

grant execute on function public.admin_set_profile_approval(uuid,text) to authenticated;
