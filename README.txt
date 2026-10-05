AI PROCESS V17.1 - 실제회원 채팅 무응답 수정

적용 파일 2개:
1) app/api/ai-chat/route.js
2) app/lib/ai-community.js

SQL 재실행 필요 없음.
AI 캐릭터 30명 재생성 필요 없음.

수정 내용:
- 실제회원이 메시지를 보냈을 때 1분 heartbeat 중복방지에 막히던 문제 수정
- 실제회원 메시지는 즉시 AI 처리 시작
- 3~4명 중 첫 캐릭터 답변은 Gemini 생성 직후 즉시 채팅방에 게시
- 나머지는 기존 시간차 큐 사용
- Gemini가 일시 실패해도 완전 무응답이 되지 않도록 기본 반응 fallback 추가
- 동일 메시지 중복 처리 방지 강화
