# AI PROCESS 유지보수 기준

이 문서는 P1~P5 구조 정리 이후의 현재 기준입니다.

## 현재 구조

### 화면
- `app/page.js`: 화면 상태, 사용자 액션, 화면 흐름을 조정합니다.
- `app/components/ai-process/`: AI PROCESS 화면 전용 컴포넌트입니다.
- `app/ai-process-p3.css`: P3 이후 AI PROCESS 전용 화면 스타일입니다.

### 데이터 / 계산
- `app/lib/ai-process-data.js`: PROCESS 목록 조회와 현재 선택 세션 결정.
- `app/lib/ai-process-service.js`: 관리자 RPC, PROCESS 로그/시장 데이터 I/O.
- `app/lib/ai-process-simulation.js`: 시장 응답과 로그를 화면용 시뮬레이션 데이터로 변환.
- `app/lib/ai-process-impact.js`: 종목별 수익·손실 영향 집계.
- `app/lib/ai-process-utils.js`: 금액/시간/수익률/차트 순수 유틸리티.
- `app/lib/ui-helpers.js`: 공용 UI 보조 함수.

## 핵심 운영 규칙

1. 3분 PROCESS 갱신 주기를 임의로 변경하지 않습니다.
2. Supabase RPC 이름/파라미터를 화면 컴포넌트에서 직접 바꾸지 않습니다.
3. 외부 I/O는 가능한 한 `ai-process-service.js` 또는 데이터 계층에 둡니다.
4. 금액/차트/로그 변환 같은 순수 계산은 React 상태 코드와 섞지 않습니다.
5. AI PROCESS 화면 변경은 `app/components/ai-process/`와 `app/ai-process-p3.css`를 우선 사용합니다.
6. `app/page.js`에 새 대형 JSX 블록이나 새 Supabase 쿼리를 직접 추가하지 않습니다.
7. DB 스키마/RPC 변경은 별도 마이그레이션으로 기록하고 기존 기능과 호환성을 확인합니다.

## 수정 전 확인

- 현재 `main`의 최신 커밋을 확인합니다.
- 수정 전 사람에게 읽히는 롤백 지점을 정합니다.
- UI 수정인지, 계산 수정인지, DB 수정인지 범위를 하나로 고정합니다.

## 수정 후 필수 검증

```bash
npm ci
npm test
npm run build
```

GitHub에서는 `.github/workflows/p4-quality-gate.yml`이 테스트와 빌드를 자동 검증합니다.

## 자동 테스트 범위

`tests/ai-process-core.test.mjs`에서 다음 핵심 계약을 검사합니다.
- 원화/수익률 포맷
- 차트 모델 생성
- 시장 JSON 파싱 오류
- PROCESS 로그 변환
- 시작금액/현재금액 기준 손익 및 수익률
- PROCESS 시작점 history 보존

## 현재 디자인 원칙

- 화이트 / 쿨그레이 / 딥네이비 / 블루 중심
- 수익은 초록, 손실은 빨강
- 회원 화면은 현재 평가금액과 누적 손익을 최우선 표시
- 관리자 화면은 진행 중 인원, 총 운용금액, 누적손익을 운영 핵심 지표로 표시
- 작은 카드와 중첩된 패널을 불필요하게 늘리지 않습니다.

## 롤백 기준

기능 이상이 발생하면 가장 최근의 검증 완료 커밋으로 되돌립니다. UI 문제만 발생한 경우 DB/RPC나 서비스 계층까지 함께 되돌리지 말고 디자인 변경 범위만 롤백합니다.

## 배포 확인 주의

GitHub Actions의 테스트/빌드 성공은 코드 검증입니다. Vercel 실제 운영 배포 완료 여부는 별도로 확인해야 합니다.
