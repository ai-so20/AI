alter table public.ai_process_sessions
  drop constraint if exists ai_process_sessions_duration_hours_check;

alter table public.ai_process_sessions
  add constraint ai_process_sessions_duration_hours_check
  check (duration_hours >= 0 and duration_hours <= 720);
