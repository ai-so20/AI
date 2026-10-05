-- V17.3 적용 직후, V17.2에서 이미 예약돼 있던 대사를 깨끗하게 지우고 새 테스트를 시작할 때 1회만 실행
update public.ai_reply_queue
set status = 'cancelled'
where status = 'queued';

update public.ai_conversation_threads
set status = 'cancelled', completed_at = now()
where status = 'active';

update public.ai_community_state
set next_autonomous_at = now() + interval '4 minutes',
    updated_at = now()
where id = 1;
