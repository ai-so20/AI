-- ============================================================
-- AI PROCESS V17.8 - PRIORITY 1~3 REFINEMENT
-- 2026-10-06
--
-- 1) AI 자율대화 한 주제 과몰입 방지
-- 2) 기존 진행 중 자율대화 가지 정리 후 새 규칙으로 재시작
-- 3) UI 수정은 app/page.js / app/globals.css 에 포함
--
-- 데이터 삭제 없음. 실제회원 메시지/이벤트/프로세스 데이터는 보존합니다.
-- ============================================================

begin;

update public.ai_community_settings
set autonomous_thread_min_turns = 2,
    autonomous_thread_max_turns = 5,
    autonomous_participant_min = 2,
    autonomous_participant_max = 4,
    autonomous_gap_min_minutes = 1,
    autonomous_gap_max_minutes = 1,
    updated_at = now()
where id = 1;

-- 패치 적용 전 길게 이어지던 자율대화만 종료합니다.
-- 실제회원 대화 / 이벤트 / 환영 / 축하 가지는 건드리지 않습니다.
update public.ai_turn_queue q
set status = 'cancelled',
    processed_at = now()
from public.ai_conversation_threads t
where q.thread_id = t.id
  and q.status = 'queued'
  and t.thread_type = 'autonomous';

update public.ai_conversation_threads
set status = 'completed',
    completed_at = now(),
    last_activity_at = now()
where status = 'active'
  and thread_type = 'autonomous';

update public.ai_community_state
set next_autonomous_at = now() + interval '1 minute',
    updated_at = now()
where id = 1;

commit;

select
  autonomous_thread_min_turns,
  autonomous_thread_max_turns,
  autonomous_participant_min,
  autonomous_participant_max,
  autonomous_gap_min_minutes,
  autonomous_gap_max_minutes
from public.ai_community_settings
where id = 1;
