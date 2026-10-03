# AI PROCESS V13 — Mobile / Profile Fix

기준: V12_AI_PROCESS_LONGRUN_FULL

## 변경 범위
1. 모바일/태블릿 유저 화면이 화면 절반 정도만 차지하던 문제 수정
   - 999px 이하에서 app shell / body / dashboard를 가용 화면 너비 100%로 고정
   - 기존 `max-width: 500px` 제한을 모바일 구간에서 제거
2. 상단 `AI PROCESS VIP` 왼쪽의 중복 회원 프로필 이미지 제거
   - 우측 `내 정보` 프로필은 그대로 유지
3. 프로필 40종 선택 기능 보정
   - 프로필 선택창을 모든 화면 레이어보다 위에 표시
   - 터치/클릭 가능 상태 명시
   - `set_my_avatar()`가 `profile-01` ~ `profile-40`을 정상 허용하도록 SQL 최종 보정
4. 복원용 `00_ALL_IN_ONE_CURRENT_FIXED.sql` 마지막에도 40종 프로필 함수 최종 override 추가

## 변경하지 않은 부분
- AI PROCESS 1분 엔진 / 장기 로그 최적화
- 시장 데이터 구조
- 관리자 기능
- 이벤트 / 그룹채팅 / 1:1 문의 기능
- 현재 크림/골드/네이비 컬러 시스템

## DB 적용
기존 Supabase를 유지하는 경우 아래 파일을 SQL Editor에서 1회 실행:

`supabase/10_profile_picker_mobile_fix.sql`
