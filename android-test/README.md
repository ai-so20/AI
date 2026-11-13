# AI 프로세스 Android 실행 검증 전용

이 폴더는 운영 Next.js 앱을 수정하지 않고 **Android APK 설치·앱 실행 가능성**만 확인하기 위한 Capacitor 8 시험 프로젝트입니다.

## 앱 최초 진입 화면
https://ai-r6u0rn1ma-vipai.vercel.app/design-entry

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
