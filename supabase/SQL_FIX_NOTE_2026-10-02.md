# SQL FIX 2026-10-02

기존 `01_current_schema.sql` 내 복원 문자열 일부가 SQL 문법으로 잘못 저장되어 있던 문제를 수정했습니다.

수정 내용:
- CREATE TABLE 21곳의 literal `\\n` 제거
- 손상된 RLS 정책 3곳 복구
- profiles 승인 동기화 INSERT/UPDATE 트리거 분리
- Auth 가입 시 profiles 자동 생성 트리거 추가
- 현재 프론트가 사용하는 고정 그룹방 및 room_chat_settings 기본 행 추가

새 Supabase에 처음 설치할 경우 `00_ALL_IN_ONE_CURRENT_FIXED.sql` 하나를 실행하면 됩니다.
이미 일부 SQL을 실행한 프로젝트라면 실행 중 오류가 나오면 오류 메시지를 기준으로 기존 객체와 병합해야 합니다.
