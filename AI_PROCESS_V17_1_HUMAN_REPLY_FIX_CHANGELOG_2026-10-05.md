# AI PROCESS V17.1 HUMAN REPLY FIX

## 원인
V17의 `/api/ai-chat` POST도 분당 tick claim을 사용하고 있었습니다.
그룹채팅 화면의 1분 heartbeat가 같은 분을 먼저 claim하면 실제 회원이 메시지를 보낸 직후의 POST가 `already_ran_this_minute`로 끝날 수 있었습니다.
또한 사람 메시지에 대한 첫 AI 답변도 예약 큐에만 들어가 다음 heartbeat까지 게시되지 않았습니다.

## 수정
- 실제 회원의 메시지 POST는 minute claim을 우회하여 즉시 처리합니다.
- 동일 사람 메시지는 receipt로 먼저 점유해 heartbeat와의 중복 생성을 막습니다.
- 선택된 3~4명 중 첫 답변은 생성 직후 `group_messages`에 즉시 게시합니다.
- 나머지 답변은 기존 예약 큐로 시간차를 유지합니다.
- Gemini 호출 실패 시에도 사람 메시지가 완전 무응답이 되지 않도록 임시 fallback 반응을 사용합니다.
- 큐 저장 자체가 실패한 경우 receipt를 되돌려 다음 tick에서 재시도할 수 있게 했습니다.

## DB
추가 SQL 없음. V17 SQL을 이미 적용했다면 재실행하지 않습니다.
