AI PROCESS V16 - AI 캐릭터 자기인식 수정 패치

1) Supabase SQL Editor에서 supabase/11_ai_character_30_initial_install.sql 전체 실행
2) GitHub에 app/api/ai-chat/route.js 덮어쓰기
3) Vercel 재배포

SQL은 기존 회원/채팅/AI PROCESS 데이터를 삭제하지 않습니다.
기존 시험용 유나/수아는 삭제하지 않고 비활성화합니다.
30명 캐릭터는 자기 이름/나이/직업/일상을 실제 자기 삶처럼 받아들이며,
정체 질문에서도 각 캐릭터의 세계관과 말투를 유지하도록 설정되어 있습니다.
