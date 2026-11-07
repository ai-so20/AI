# AI 이벤트 조회·참여 권한 점검 (2026-11-08)

**점검 범위:** AI 프로젝트 `ai-so20/AI`, Supabase `vyjtpushaumjedcfwxbn` 및 원본 26의 함수 정의.  
**DB·환경변수·회원·이벤트·경품 데이터 변경:** 없음. 권한 테스트를 위한 익명 REST 호출·이벤트 참가·당첨 처리도 실행하지 않음.  
**기프티콘 재고 관리:** 사용자 요청에 따라 후순위. 다만 테스트용 링크의 접근 제한은 재고 개발과 별도의 보안 문제.

## 1. 확인된 권한 상태

Supabase의 `pg_class.relrowsecurity`와 `has_table_privilege`를 **읽기 전용**으로 검사했습니다.

| AI 테이블 | RLS | anon SELECT | anon INSERT/UPDATE/DELETE |
|---|---|---|---|
| `events` | OFF | 허용 | 모두 허용 |
| `event_entries` | OFF | 허용 | 모두 허용 |
| `event_winners` | OFF | 허용 | 모두 허용 |
| `event_game_secrets` | OFF | 허용 | 모두 허용 |
| `event_quiz_bank` | OFF | 허용 | 모두 허용 |
| `event_prize_catalog` | OFF | 허용 | 모두 허용 |
| `event_gift_inventory` | OFF | 허용 | 모두 허용 |
| `event_reward_deliveries` | OFF | 허용 | 모두 허용 |

위 8개 테이블은 `authenticated` 역할에도 같은 직접 CRUD 권한이 부여돼 있음을 확인했습니다. 반면 `group_messages`는 RLS ON이며 승인된 회원에 대한 조회·전송 정책 2개가 있습니다.

**영향:** 공개된 Data API가 이 테이블을 노출한다면 익명 역할로 이벤트 정답, 회원 답안, 당첨 및 테스트용 상품 URL을 조회하거나 데이터를 변경할 수 있는 권한 구조입니다. 외부 HTTP로 실제 접근 성공/변경 가능성을 검증하지 않았으므로 **취약한 권한 설정 확인**, **실제 악용·유출 확정 아님**을 구분해야 합니다.

## 2. 함수 호출 권한

| 함수 | anon EXECUTE | 내부 인증검사 확인 |
|---|---|---|
| `get_auto_events()` | 허용 | 없음 |
| `join_auto_event(uuid,text)` | 허용 | `auth.uid()` 및 `approval_status='approved'` 검사 (단, role=member 검사는 없음) |
| `get_admin_event_operations()` | 허용 | `is_current_user_admin()`로 제한 |
| `setup_event_game(uuid)` | 허용 | 없음 |
| `finish_auto_event(uuid)` | 허용 | 없음 |
| `run_auto_event_engine()` | 허용 | 없음 |

`setup_event_game`, `finish_auto_event`, `run_auto_event_engine`은 **SECURITY DEFINER** 함수이고, 익명 역할에 실행 권한이 부여되어 있으며, 정의 본문에 별도 인증 검사가 없습니다. 특히 `finish_auto_event`는 이벤트 상태와 당첨자 정보를 변경하고 `run_auto_event_engine`은 이벤트 생성·시작·종료를 처리합니다.

등록된 `vip-auto-event-engine` Cron은 매분 `run_auto_event_engine()`을 실행하도록 활성화돼 있습니다. **해당 Cron은 변경하지 않았습니다.** 함수 권한을 무작정 삭제하면 자동 이벤트 또는 관리자 기능이 중단될 수 있으므로 테스트 환경에서 Cron 실행자·함수 소유자·내부 호출 권한을 검증해야 합니다.

## 3. 이벤트 정답 공개 시점

원본과 AI의 `get_auto_events`는 `revealed_answer`는 완료 이후만 공개하지만 `my_result_text`는 진행 중에도 반환합니다.

AI의 퀴즈 `join_auto_event`는 정답 선택 시 `event_entries.result_text='정답 제출 완료'`를 저장합니다. 그러므로 **진행 중 정답 여부를 `get_auto_events` 응답으로 추정할 수 있습니다.** 이를 막기 위해:
- 클라이언트 `app/design-event/page.js`에서 **완료 이후에만 결과 문구와 당첨 표시**를 내보내도록 보완함.
- 그러나 클라이언트 표시만 숨겨서는 RPC 데이터 노출을 막을 수 없음. 별도 승인된 DB 함수 수정에서 `get_auto_events`의 `my_result_text`를 완료 이후로 제한하고 진행 중 결과값을 중립화해야 함.

원본 26의 함수도 유사한 결과 처리이므로 **원본 26은 수정하지 않고**, 신규 AI에 필요한 변경을 분리 검토합니다.

## 4. 준비한 대응 초안

`review-only/AI_EVENT_ACCESS_HARDENING_DRAFT.sql`

- 이벤트 관련 8개 테이블 RLS ON + 공개 직접 CRUD 권한 철회.
- 기존 AI 관리자 화면에서 직접 읽는 `event_prize_catalog`는 **승인된 관리자 본인**에게만 SELECT 정책 제공.
- 내부 `setup_event_game` / `finish_auto_event` / `run_auto_event_engine` 함수의 공개 EXECUTE 철회.
- 일반 회원용 `get_auto_events` / `join_auto_event`, 관리자 전용 `get_admin_event_operations`은 일단 authenticated EXECUTE로 제한. **단, RPC 본문의 역할·승인 검증 강화는 추가로 필요**하므로 이 SQL만으로 보안 완결이 아님.
- Cron, 이벤트 데이터, 상품 링크, 당첨 내역 자체에는 쓰지 않음.

이 파일은 **운영 마이그레이션 경로가 아닌 review-only 폴더**에 있습니다. SQL이 저장됐다고 Supabase 권한이 수정되는 것은 아닙니다.

## 5. 실행 전 검증 순서

1. 신규 AI 데이터·스키마 백업. 원본 26과 분리된 테스트 DB 확보.
2. 현재 event 관련 RPC 호출자 전체/서비스 역할/함수 소유자/데이터 API 노출 스키마 확인.
3. 테스트 DB에서 RLS·테이블 GRANT·RPC EXECUTE 제한안을 적용.
4. anon: 정답·상품 URL·참가자 데이터 CRUD 및 내부 엔진 RPC 거부.
5. 미승인 계정/관리자/승인 회원: `get_auto_events`, `join_auto_event`의 서버측 역할·승인 확인.
6. 승인 회원: 진행 중 퀴즈 정답·정답 여부 비공개, 종료 후 허용된 정보만 열람, 중복 참가 차단.
7. 관리자: 기존 `event_prize_catalog` 조회와 이벤트 운영 메뉴 정상 작동.
8. Cron: 1분 자동 생성·시작·종료 정상 작동, 수동 익명 호출은 거부.
9. 출석/상품 재고/당첨/회원 데이터 영향 없음 확인.
10. 통과한 정책만 사용자에게 승인된 범위로 운영 DB 적용 여부 결정.

**현재 판정:** GitHub UI 코드 개선 및 보안 적용안 준비. 실제 접근 제한은 **미적용**. 운영 데이터/SQL/RLS/환경변수 변경은 수행하지 않았음.
