# AI PROCESS VIP · V3 통합 업그레이드

## 이번 버전 핵심

1. 로그인 직후 VIP 환영 모달 추가
   - 알림 설정 버튼
   - 그룹채팅 바로가기
   - 이벤트 확인하기
   - 기존 VIP 크림/골드 톤과 맞춘 신규 UI

2. 1:1 문의 화면 상단 VIP 안내 카드 추가
   - VIP 이벤트 안내
   - 그룹채팅 바로가기
   - 이벤트 확인하기
   - 알림 설정 확인
   - 실제 1:1 채팅 기능은 기존 그대로 유지

3. 프로필 24종 통합
   - 12종 동물 × 크림 / 블루
   - `public/avatars/24/`에 최적화 JPG 75개 포함
   - 기존 `vip_01~vip_06` 키도 호환 유지

4. AI PROCESS LIVE MEMBERS
   - 현재 AI PROCESS 진행 중인 회원을 모든 승인 회원이 확인
   - 닉네임 / 프로필 / 누적손익 / 수익률 / 최근 연동시장 / 업데이트 시간 표시
   - 본인 상세 그래프는 본인 화면에만 표시
   - 진행회원 요약은 Supabase Realtime으로 갱신

5. 관리자 AI PROCESS 시작/종료 UI
   - 회원 선택
   - 운용금액 지정
   - 진행시간 1~720시간(30일)
   - 진행 중 회원 즉시 종료 가능

## Supabase에서 반드시 먼저 실행

기존 DB에 아래 SQL을 1회 실행해야 합니다.

`supabase/03_ai_process_live_avatar24_upgrade.sql`

이 SQL은 다음을 추가합니다.

- `ai_process_sessions`
- `ai_process_logs`
- AI PROCESS 공개 진행현황 RPC
- 관리자 시작 / 종료 RPC
- 5분 결과 동기화 RPC
- 24종 프로필 키 허용
- `ai_process_sessions` Realtime publication 등록

SQL 실행 전에는 새 AI PROCESS 공개현황/관리자 시작 기능이 동작하지 않습니다.

## 현재 AI PROCESS 동작 방식

- 주식 4종 + 코인 4종 시장 데이터는 기존 `/api/market-sim` 5분 캐시 구조 유지
- 회원의 AI PROCESS가 `running` 상태일 때만 손익 결과를 계산
- 수익 결과는 같은 5분 구간의 상승 종목, 손실 결과는 하락 종목과 연결
- 결과는 Supabase `ai_process_sessions`에 동기화되어 다른 회원에게 진행 현황이 보임
- 개인 상세 그래프/히스토리는 현재 브라우저 로컬 기록을 계속 사용

### 주의

현재 버전의 5분 AI PROCESS 계산은 해당 회원이 로그인하여 사이트를 열어 둔 동안 클라이언트에서 갱신됩니다.
회원이 브라우저를 완전히 종료해도 서버에서 계속 자동 지급되는 구조는 아직 아닙니다.
24시간 완전 서버 자동 운용이 필요하면 다음 단계에서 pg_cron 또는 Vercel Cron 기반 엔진으로 이전해야 합니다.

## 환경변수

Vercel에 아래 값이 필요합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `GEMINI_API_KEY`
- `TWELVE_DATA_API_KEY`

