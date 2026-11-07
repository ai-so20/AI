# 독립 AI 프로젝트 — 일일 출석 기능 적용 전 검토서

**상태: 구현 초안 작성, DB 미적용, 실회원 출석 기능 미완료**

기준: 신규 `AI` Supabase `vyjtpushaumjedcfwxbn` 한정. 원본 `26` Supabase `amgeyannjsslzmoowcmd`는 읽기 참고만 했습니다. 기프티콘 재고·발송·당첨·상품지급센터 데이터는 작업에서 제외합니다.

## 현재 확인한 문제

- 신규 `AI` DB에는 `get_daily_attendance_status()`·`check_daily_attendance()` 함수가 없습니다.
- 기존 `attendance_records`는 `event_id` 외래키와 `(event_id,member_id,attendance_date)` 유니크 키가 있는 **이벤트 출석용** 테이블입니다. 조회 시 행 0건이었으며 독립 누적 출석에 재사용하지 않습니다.
- 원본 `26`의 출석 RPC 2개는 인자 없는 `jsonb` 반환으로 확인했습니다. 신규 디자인 페이지는 같은 필드 형태를 기대하므로 **독립 RPC를 추가하면 화면 재설계 없이 연결 가능**합니다.

## 준비한 SQL 초안 (GitHub 파일만, 자동 적용 아님)

`review-only/AI_DAILY_ATTENDANCE_DRAFT.sql`

1. `public.ai_daily_checkins`: 회원 ID, **Asia/Seoul 기준 출석 날짜**, 서버 기록 시간. `(member_id,attendance_date)` PK로 하루 중복 방지.
2. `public.ai_attendance_milestones`: 누적 30·60·90...회 도달 기록. 지급 테이블이 아니며 중복 마일스톤 기록도 PK로 방지. 재고·지급 데이터 및 가상 기프티콘 링크 생성 **없음**.
3. 두 테이블 모두 RLS **ON**, 본인 승인 회원만 SELECT, 클라이언트에 직접 INSERT/UPDATE/DELETE 권한 부여하지 않음.
4. `get_daily_attendance_status()`: 승인된 **member**가 본인 오늘 출석·누적 횟수·미지급 달성 기록 상태를 읽음. 데이터 쓰기 없음.
5. `check_daily_attendance()`: 승인된 **member**만 호출하여 서버 시간 기준 한 번 INSERT; 같은 날 중복 호출은 `ON CONFLICT DO NOTHING`. 30의 배수에 한해서 **달성 기록** 추가. 기프티콘 지급 호출 없음.
6. 함수는 `SECURITY DEFINER`여서 권한 검수가 특히 필요합니다. 함수 내부에서 `auth.uid()`, 승인 상태 `approved`, 역할 `member`를 검증합니다. `search_path=''`와 스키마 정규명을 사용하고 `PUBLIC` / `anon`의 EXECUTE를 철회하며 `authenticated`에게만 허용하는 초안입니다. 실제 권한·소유자·API 노출 검증은 아직 안 했습니다.
7. `reward_ready`는 **달성 기록이 존재함**만 의미합니다. `reward_result.success=false`, `reason=reward_deferred`를 제공하고 지급 완료로 반환하지 않습니다.

## 적용 전에 반드시 확인

| 항목 | 통과 조건 |
|---|---|
| 격리 환경 | 별도 테스트 Supabase, 백업 존재, 원본 `26`과 다른 프로젝트 |
| 무결성 | 기존 `events`, `attendance_records`, 재고/지급 테이블에 변경 없음 |
| 권한 | anon RPC 실패, 승인대기/관리자 RPC 실패, 회원 A는 B의 출석·달성 기록 SELECT 불가 |
| 중복 | 같은 회원 같은 KST 날짜 2회 요청 시 누적 정확히 +1 |
| 경쟁 상태 | 동시 요청 2건에서도 PK 충돌 처리로 1건만 INSERT |
| 일자 | KST 23:59 → 00:00 경계에서 서버 DB 날짜로 다음 날 처리 |
| 달성 기록 | 29→30에서 30 달성 기록 1건만 저장, 31회에도 30 달성 기록 유지 |
| 상품 지급 | 가라 기프티콘 재고, 지급 내역, 링크, 사용자 메시지 변화 모두 0 |
| 화면 | `/design-attendance` 실제 회원 조회/출석 버튼 테스트, 실패 시 0회·지급완료 표시 금지 |
| 보안 | 함수를 실행시키는 role, SECURITY DEFINER owner, RLS, table grants, Data API 노출 확인 |

## 실제 서비스 적용 전 추가 결정

- 기존 `AI` 회원이 **관리형 계정(`managed`)**일 경우 출석을 허용할지 정책 확인. 현재 초안은 계정 유형이 아닌 **승인 상태와 member 역할**로 검사합니다.
- 30회 달성 시 지급 대기 기록만 표시할지, 별도 수동 관리자 확인으로 전환할지 추후 정합니다. **기프티콘 재고를 다루지 않습니다.**
- 누적 출석을 원본 `26`에서 이관할지는 별도 이슈이며 이번 초안은 **신규 AI DB 0회부터 시작**합니다.

## 이후 실행 순서

1. 본 SQL과 권한 모델 검토
2. 테스트 전용 DB에서 마이그레이션 및 회원/권한/시간대/중복 E2E
3. 테스트 통과 후 사용자 지정 범위에 한해서 운영 DB 적용 여부 결정
4. 실제 서비스에서 출석 조회·체크 연결 확인
5. 추후 필요할 때 기프티콘 재고·지급을 독립 기능으로 개발

**현재 GitHub 파일은 SQL 에디터에 자동 등록되지 않는 `review-only/` 위치에 저장돼 있습니다. 해당 파일이 존재한다는 사실만으로 운영 기능이 활성화되는 것은 아닙니다.**
