import fs from "node:fs";

const path = "app/lib/ai-community.js";
let src = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (!src.includes(search)) throw new Error(`${label} not found`);
  src = src.replace(search, replacement);
}

// 1) 실제회원 일반 메시지에는 2~3명만 반응. 캐릭터별 general_reply_rate 가중치는 기존 선택기에 그대로 유지.
replaceOnce(
  '    human_reply_min: 3,\n    human_reply_max: 4,',
  '    human_reply_min: 2,\n    human_reply_max: 3,',
  'default human reply range'
);
replaceOnce(
  '    count = randInt(Number(settings.human_reply_min || 3), Number(settings.human_reply_max || 4));',
  '    count = randInt(Number(settings.human_reply_min || 2), Number(settings.human_reply_max || 3));',
  'runtime human reply range'
);

// 2) 로컬 자율대화 템플릿을 설명문형에서 실제 메신저형으로 교체.
const openerStart = src.indexOf('const LOCAL_OPENERS = [');
const replyBEndMarker = '];\n\nconst LOCAL_BRIDGES = [';
const replyBEnd = src.indexOf(replyBEndMarker, openerStart);
if (openerStart < 0 || replyBEnd < 0) throw new Error('local opener/reply block not found');
const newLocalBlock = `const LOCAL_OPENERS = [
  (t) => \`요즘 ${'${t}'} 어때요?\`,
  (t) => \`${'${t}'} 얘기 나오니까 갑자기 생각났네요ㅋㅋ\`,
  (t) => \`저 ${'${t}'} 은근 좋아해요\`,
  (t) => \`${'${t}'} 요즘도 많이 하시나요?\`,
  (t) => \`아 ${'${t}'} ㅋㅋ 이건 좀 할 말 있는데\`,
  (t) => \`${'${t}'}는 진짜 취향 타는 듯요\`,
  (t) => \`저는 ${'${t}'} 쪽은 잘 모르는데 궁금하긴 해요\`,
  (t) => \`${'${t}'} 얘기 오랜만이네요\`,
  (t) => \`갑자기 ${'${t}'} 생각나네요ㅎㅎ\`,
  (t) => \`${'${t}'} 해보신 분 있어요?\`,
  (t) => \`전 ${'${t}'}는 가끔 하는 정도예요\`,
  (t) => \`${'${t}'}는 전 좀 호불호 있어요ㅋㅋ\`,
  (t) => \`오 ${'${t}'} 얘기네요\`,
  (t) => \`${'${t}'} 좋아하는 분 많던데\`,
  (t) => \`저는 ${'${t}'}보다 비슷한 다른 쪽이 더 좋더라고요\`,
  (t) => \`${'${t}'}는 생각날 때만 찾게 돼요\`,
  (t) => \`아 ${'${t}'} 그거 괜찮죠\`,
  (t) => \`${'${t}'}는 저도 좀 궁금했어요\`,
  (t) => \`전 ${'${t}'} 별생각 없었는데 요즘 좀 달라졌어요\`,
  (t) => \`${'${t}'} 얘기하니까 하나 떠오르네요\`,
];

const LOCAL_REPLY_A = [
  "맞아요", "그러게요", "전 좀 달라요", "저도요ㅋㅋ", "그건 인정", "아 그럴 수 있죠",
  "전 오히려 반대예요", "저는 그냥 그때그때 달라요", "오 그건 몰랐네요", "저도 비슷해요",
  "그건 좀 공감돼요", "저는 아직 잘 모르겠어요", "저도 한 번 해보고 싶네요", "전 그냥 편한 게 최고",
  "아 그 느낌 알아요", "저는 그쪽이 더 낫더라고요", "그건 사람마다 다를 듯요", "저도 가끔 그래요",
];

const LOCAL_REPLY_B = [
  "ㅋㅋ", "ㅎㅎ", "오", "헉", "진짜요?", "아 맞아요", "그쵸", "저도요", "오히려 좋아요", "그건 좀 웃기네요ㅋㅋ",
  "아 그건 인정이에요", "전 괜찮던데요", "저는 별로였어요", "그럴 수도 있겠네요", "은근 그렇더라고요",
]`;
src = src.slice(0, openerStart) + newLocalBlock + src.slice(replyBEnd);

// 3) 사람답게라는 추상 지시 대신 행동 규칙 + 좋은/나쁜 예시를 human batch 프롬프트에 주입.
const oldRules = `규칙:
- 캐릭터마다 답변 1개씩.
- 각 답변 10~90자, 최대 2문장.
- 첫 번째 답변은 실제회원의 말에 직접 답한다.
- 이후 답변은 앞사람 말을 똑같이 반복하지 않는다.
- 질문은 전체 답변 중 최대 1개만 허용.
- 모르는 실제 장소/사실을 지어내지 않는다.
- ㅋㅋ/ㅎㅎ/느낌표는 캐릭터 말투와 상황에 맞을 때만.
- 설명회/토론처럼 길게 말하지 않는다.
- 카카오톡 오픈채팅방처럼 기본은 자연스러운 존댓말을 쓴다.
- 친한 친구끼리 쓰는 완전한 반말은 금지한다. 짧은 구어체는 가능하지만 말끝은 대체로 존댓말을 유지한다.
- 최근 대화에서 이미 나온 시작 표현, 마무리 표현, 비슷한 문장 골격을 되풀이하지 않는다.
- \"아 맞다\"로 습관적으로 시작하거나 \"이 얘기는 여기까지\"처럼 대화를 선언적으로 끝내지 않는다.
- JSON 외 문장 금지.`;
const newRules = `규칙:
- 캐릭터마다 답변 1개씩. 서로 독립된 발표문을 쓰지 말고, 같은 방에서 방금 나온 말을 실제로 듣고 반응한다.
- 짧은 답을 적극 허용한다. 2~12자짜리 리액션도 자연스러우면 사용한다. 대부분 5~45자, 필요한 경우만 90자 이내, 최대 2문장.
- 첫 번째 답변은 실제회원의 핵심 말에 바로 반응한다. 회원이 \"여러분?\", \"있어요?\", \"왜 답이 없어요\"처럼 호출하면 반드시 호출 자체에 먼저 답한다.
- 두 번째/세 번째 답변은 회원에게 직접 답하거나 바로 앞 사람의 반응을 받아 이어간다. 각자 새 주제를 꺼내지 않는다.
- 같은 의견을 세 사람이 완성문장으로 반복하지 않는다. 한 명이 충분히 말했으면 다음 사람은 \"맞아요\", \"저도요ㅋㅋ\", \"그건 인정\"처럼 짧게 끝내도 된다.
- 질문은 전체 답변 중 최대 1개. 매번 공감→설명→질문 패턴으로 끝내지 않는다.
- '그런 것 같아요/좋을 것 같아요/괜히 궁금해지네요/도움이 될 거예요/천천히 둘러보세요' 같은 무난한 AI 상투문장을 습관적으로 쓰지 않는다.
- 사용자의 말을 길게 바꿔 말하거나 요약한 뒤 답하지 않는다. 바로 반응한다.
- 의견 차이가 있으면 가볍게 반대해도 된다. 모든 캐릭터가 항상 친절하게 동의할 필요는 없다.
- 맞춤법을 일부러 틀리지는 않지만, 실제 메신저처럼 생략/짧은 감탄/ㅋㅋ/ㅎㅎ/말줄임은 허용한다.
- 모르는 실제 장소/사실을 지어내지 않는다.
- 기본은 존댓말이지만 짧은 구어체 리액션은 허용한다. 과도한 상담원/안내문 말투는 금지한다.
- 최근 대화에서 이미 나온 시작 표현, 마무리 표현, 문장 골격을 되풀이하지 않는다.

좋은 예:
회원: 대화가 안 이어지는데
A: 그러게요 지금 좀 다들 각자 말하는 느낌인데 ㅋㅋ
B: 저도 그 생각했어요
회원: 여러분?
A: 네 ㅋㅋ 보고 있어요
B: 왜요 무슨 얘기 하려고요?

좋은 예:
회원: 오늘 너무 피곤하네요
A: 저도 오늘 유난히 늘어지네요
B: 전 벌써 집 가고 싶어요ㅋㅋ
C: ㅋㅋㅋ 저도요

나쁜 예:
A: 피곤하셨군요. 충분한 휴식을 취하시는 것이 좋을 것 같아요.
B: 저도 공감합니다. 오늘 하루도 고생 많으셨습니다.
C: 따뜻한 차 한 잔과 함께 천천히 쉬어보시는 건 어떨까요?

- JSON 외 문장 금지.`;
replaceOnce(oldRules, newRules, 'human batch rules');

// 4) 출력 정리에서도 아주 짧은 반응을 제거하지 않도록 유지(2자 이상). 최대 길이는 낮춰 장문 억제.
replaceOnce(
  '    const message = trimChatMessage(String(r?.message || ""), 110);',
  '    const message = trimChatMessage(String(r?.message || ""), 90);',
  'human batch trim limit'
);

// 5) 공통 프롬프트에 대화 연속성 핵심을 더 강하게 고정.
const commonNeedle = '- 실제회원 메시지가 있으면 그 흐름을 AI끼리의 잡담보다 우선한다.\n';
const commonInsert = `- 실제회원 메시지가 있으면 그 흐름을 AI끼리의 잡담보다 우선한다.\n- 실제회원이 들어오면 진행 중이던 AI 자율대화의 주제 확장을 멈추고 회원의 마지막 말이 현재 대화의 중심이 된다.\n- 한 사람이 방금 충분히 답했으면 다음 캐릭터는 설명을 덧붙이기보다 짧게 받거나 침묵하는 쪽을 우선한다.\n- \"여러분?\", \"계세요?\", \"왜 아무도 답 안 해요\" 같은 방 전체 호출은 새 주제로 해석하지 말고 즉시 존재 반응을 한다.\n`;
replaceOnce(commonNeedle, commonInsert, 'common human priority rules');

fs.writeFileSync(path, src);
console.log("V21 human conversation patch applied");
