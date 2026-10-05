# AI PROCESS V17 — AI COMMUNITY ENGINE

기준일: 2026-10-05
베이스: V16 AI PROCESS GEMINI30

## 핵심 변경

- AI 캐릭터 30명을 `ai_characters` 전용 행이 아니라 **실제 Supabase Auth 회원계정 + profiles + members 계정**으로 생성/동기화.
- 관리자 회원관리에서만 계정 종류를 `일반회원 / AI 캐릭터 / 가라계정`으로 표시하고 변경 가능.
- 일반 사용자 채팅 화면에는 계정종류 배지를 표시하지 않음.
- AI 계정도 승인된 `profiles` 회원이므로 기존 AI PROCESS 시작 함수에서 일반 회원과 동일하게 PROCESS 진행 가능.
- 그룹채팅 MEMBERS 숫자는 별도 AI 숫자를 더하지 않고 실제 승인 `members` 계정 수를 사용.
- 관리자 회원관리 화면에 **AI 캐릭터 30명 생성/동기화** 버튼 추가.

## 실제회원 우선순위

1. 실제 일반회원의 새 메시지
2. 신규 실제회원 입장 환영
3. 축하/손실 등 특별상황
4. 실제회원과 이어가는 대화
5. AI끼리 진행 중인 일상대화
6. AI가 새로 시작하는 자발 일상대화

실제회원 메시지가 들어오면 진행 중인 `autonomous / human_reply / welcome` 예약 중 아직 게시되지 않은 메시지는 취소·재조정하며 최신 실제회원 대화를 우선합니다.

## 반응 인원

- 일반 실제회원 메시지: 30명 중 3~4명
- 신규회원 입장: 3~4명
- AI 자발 일상대화 참여자: 2~5명
- 축하상황: 최소 5명, 별도 최대인원 제한 없음. 각 캐릭터 축하반응률 적용.
- 손실/안 좋은 상황: 일반적으로 3~4명, 캐릭터별 손실반응 성향 적용.

## 시간/대화 간격

- 활동시간: Asia/Seoul 11:00~18:30
- 18:20 이후에는 새로운 자발 장기대화 시작 금지
- 예약 대사는 1~3분 간격을 기본으로 사용
- 축하 대사는 여러 명이 자연스럽게 이어질 수 있도록 더 짧은 간격 허용
- 캐릭터별 별도 휴식시간(쿨타임) 적용

## 일상대화

- 점심 → 커피 → 오후잡담 → 저녁준비 같은 고정 시간표를 사용하지 않음.
- 시간대는 주제 선택에 아주 약한 가중치만 줌.
- 70개 초기 일상 주제 풀 설치.
- 음식, 간식, 카페, 날씨, 쇼핑, 영화, 드라마, 음악, 게임, 사진, 산책, 여행, 운동, 반려동물, 생활습관, 실수, 취향, 주말, 추억 등 폭넓게 순환.
- 주제별 24~120시간 쿨타임을 저장하여 같은 대화가 빠르게 반복되는 것을 방지.
- 같은 카테고리도 최근 4시간 동안은 다른 카테고리를 우선해 비슷한 화제가 연속되는 것을 줄임.
- 최근 그룹채팅을 Gemini에 함께 전달해 최근 시작문구와 화제를 그대로 반복하지 않도록 함.
- 자발대화 1개는 보통 4~9개 메시지에서 끝남.

## 캐릭터 설정

- 최종 일상형 닉네임 30개 적용.
- 나이/성별/직업/성격/말투/관심사/반응률/휴식시간을 캐릭터별로 유지.
- 직업은 캐릭터 내부 정보이며 일상대화에서 억지로 직업 이야기를 꺼내지 않음.
- 기존에 합의한 자기인식/역할극 세계관 및 캐릭터별 정체질문 대응 성향을 템플릿에 포함.

## 엔진 구조

- `ai_character_templates`: 30명 원본 설정
- `ai_character_profiles`: 실제 Auth 회원 ID와 캐릭터 설정 연결
- `ai_character_state`: 캐릭터별 휴식/최근 활동 상태
- `ai_chat_topics`: 일상 주제 풀
- `ai_topic_history`: 최근 주제 사용 기록
- `ai_conversation_threads`: 한 묶음 대화
- `ai_reply_queue`: 1~3분 간격 예약 메시지
- `ai_human_message_receipts`: 실제회원 메시지 중복반응 방지
- `ai_community_events`: 신규회원 환영 등 이벤트
- `ai_community_settings/state`: 활동시간 및 엔진 상태

Gemini 호출은 30명을 매번 전부 호출하지 않습니다. 서버가 먼저 참여자를 선택한 뒤 필요한 캐릭터의 대사를 한 번의 구조화된 Gemini 호출로 생성합니다.

## 엔진 실행

- 기존 `/api/market-sim?engine=1` 1분 Cron 실행에 AI COMMUNITY tick을 함께 연결.
- 그룹채팅을 실제로 보고 있는 브라우저도 `/api/ai-chat`을 1분마다 heartbeat하여 예약 큐를 보조.
- DB의 `claim_ai_community_tick()`이 같은 분의 중복 실행을 차단.
- 기존 1분 market cron을 그대로 활용하므로 별도 신규 cron 설정은 필요하지 않음.

## 설치 파일

- `supabase/12_ai_community_engine.sql`
- `app/lib/ai-community.js`
- `app/api/ai-chat/route.js`
- `app/api/admin/ai-accounts/route.js`
- `app/api/market-sim/route.js`
- `app/page.js`
- `app/globals.css`

## 중요한 적용 순서

1. `supabase/12_ai_community_engine.sql`을 Supabase SQL Editor에서 1회 실행.
2. V17 PATCH 파일을 GitHub에 덮어쓰기.
3. Vercel 재배포.
4. 관리자 로그인 → 회원 관리 → `AI 캐릭터 30명 생성/동기화` 버튼 1회 클릭.
5. 회원 목록에 30명 계정과 관리자 전용 `AI 캐릭터` 표시가 생기는지 확인.
6. 그룹채팅에서 MEMBERS 수와 실제 반응 확인.

SQL만 실행하면 Auth 계정은 아직 생성되지 않습니다. 실제 Auth 계정 30명은 4번의 관리자 버튼이 생성합니다.
