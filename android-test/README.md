# AI 프로세스 Android 실행 검증 전용

이 폴더는 운영 Next.js 앱을 수정하지 않고 **Android APK 설치·앱 실행 가능성**만 확인하기 위한 Capacitor 8 시험 프로젝트입니다.

## 앱 최초 진입 화면
https://ai-lirj0va6x-vipai.vercel.app/design-entry

**비로그인 상태**에서는 `회원 로그인` 화면으로 시작합니다. 승인된 기존 회원의 닉네임/비밀번호로 로그인하면 `/design-home`으로 이동합니다. 이미 로그인 세션이 유지 중이라면 자동으로 홈으로 이동할 수 있습니다. 로그인, 승인, 로그인 이후 메뉴별 기능은 실제 회원 계정으로 추가 검증해야 합니다.

별도 Vercel 프리뷰 서버를 사용하며, 기존 회원 사이트와 Supabase 소스는 변경하지 않습니다.
설치 파일의 앱 이름은 `AI 프로세스 테스트`, 패키지 이름은 `com.vipai.aiprocess.smoketest`입니다.

## 지금 확인할 것
1. GitHub Actions에서 디버그 APK가 빌드되는지
2. Android 에뮬레이터에 APK가 설치되고 앱 프로세스가 실행되는지
3. 비로그인 앱 초기화 후 첫 화면이 `회원 로그인` 페이지인지 확인
4. 실제 스마트폰에서 로그인/메뉴/출석/이벤트/AI PROCESS/상품 지급/뒤로가기/복귀를 별도 검증

## 주의
- `server.url`로 온라인 홈페이지를 로드하는 **프로토타입**입니다. Capacitor 공식 문서상 `server.url`은 실시간 개발/테스트 전용이며 정식 배포 용도는 아닙니다.
- 오프라인에서는 앱 전체가 정상 작동하지 않습니다. 인터넷과 Vercel 서버가 필요합니다.
- 앱 안에 Next.js 서버/API를 넣거나 사이트를 네이티브로 변환한 것이 아닙니다.
- 테스트 빌드는 Android 디버그 서명 사용. 앱스토어 배포/보안 검증에 쓰지 마세요.
- 기본 Capacitor 아이콘은 테스트 임시 아이콘입니다.
- 기존 웹사이트는 이 폴더에서 변경하지 않습니다.

## 로컬 빌드 (Android SDK / Java 21 / Node 22+ 필요)
```sh
cd android-test
npm install
npx cap add android
npx cap sync android
cd android
./gradlew :app:assembleDebug
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## 안전한 되돌리기
이 테스트는 `test/android-capacitor-20261113` 브랜치에만 존재합니다.
기존 UI 복원 브랜치: `restore/ui-before-app-20261111` (`b44fe06`).
main 및 Vercel production 환경은 건드리지 않습니다.


## 앱 안정화 (Android test hardening)

이 브랜치는 기존 APK의 **로그인부터 시작** 구조를 유지하면서 네이티브 기능을 보완합니다.

- 뒤로 가기: 웹 히스토리 우선, 루트에서 2회 누르면 종료
- 키보드: Android adjustResize, 열린 키보드 먼저 닫기
- 로그인 유지: WebView localStorage/쿠키를 삭제하지 않음. 기존 Supabase 인증 유효성/승인 검사는 웹에서 그대로 수행
- 화면 이동: 같은 출처 Next.js 경로를 WebView에서 유지, 다른 도메인은 기존 Capacitor 외부 처리
- 네트워크 오류: APK 안에 포함된 \`www/offline.html\`로 전환; '다시 연결하기'로 회원 로그인 주소 재시도
- 서버 연동: 기존 Vercel/Supabase 유지, API/회원 정보 복제하지 않음

중요: **실제 웹 UI/JS 번들은 아직 서버에서 받습니다.** 앱 내부에 내장된 것은 네이티브 실행 구조와 오프라인 오류 화면입니다. 현재 서버 의존적인 Next.js 웹 UI와 API를 통째로 정적 내장하려면 별도 모바일 프런트 빌드 및 API 경로 분리 작업이 필요합니다. 이번 버전을 전체 오프라인 앱이라고 소개하지 마세요.

테스트 코드는 \`node --test tests/native-hardening.test.mjs\`로 실행되며,
Android Java 소스는 매 빌드마다 \`node scripts/prepare-android.mjs\`로 생성된 네이티브 프로젝트에 적용됩니다.

## 앱 전용 로그아웃 검증
이 빌드는 앱 전용 Vercel 미리보기 `https://ai-lirj0va6x-vipai.vercel.app/design-entry`를 불러옵니다. 해당 미리보기의 홈 상단에 `로그아웃` 버튼이 추가되어 있습니다. 기존 앱의 프리뷰 도메인과 달라 **업데이트 후 기존 로그인 세션이 유지되지 않을 수 있습니다**. 새 로그인을 진행해 확인하세요.
로그아웃을 누르면 Supabase `auth.signOut()` 성공 후 회원 데이터를 화면에서 초기화하고 로그인 화면으로 돌아갑니다. 앱에서 다른 회원 정보를 표시하는지 반드시 다시 실행해 검수하세요.
