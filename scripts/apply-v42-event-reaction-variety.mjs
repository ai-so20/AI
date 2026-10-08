import fs from 'node:fs';

const path = 'app/lib/ai-community.js';
let s = fs.readFileSync(path, 'utf8');

function replaceFunction(source, name, replacement) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function not found: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) throw new Error(`function end not found: ${name}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const localEventMessages = `function localEventMessages(selected, event, winner = null) {
  const eventType = String(event?.event_type || event?.type || "").toLowerCase();
  const title = String(event?.title || "");

  if (winner) {
    const winnerCharacter = selected.find((c) => c.member_id === winner.id) || null;
    const others = selected.filter((c) => c.member_id !== winner.id);
    const winnerName = String(winner?.nickname || "당첨자").trim();

    const congrats = [
      "와 " + winnerName + "님 축하드려요ㅎㅎ",
      "오 " + winnerName + "님 당첨이네요ㅋㅋ 축하해요",
      "헉 진짜 되셨네요 축하드려요!",
      "오오 축하해요ㅎㅎ 오늘 운 좋으시네요",
      "대박ㅋㅋ 축하드려요",
      "와 부럽네요ㅎㅎ 축하해요!",
      "오 이번엔 " + winnerName + "님이네요 축하드립니다~",
      "축하해요ㅋㅋ 선물 잘 쓰세요",
      "와 이건 진짜 기분 좋겠네요ㅎㅎ 축하드려요",
      "오 축하드려요! 저도 다음엔 노려봐야겠네요ㅋㅋ",
      "헉 당첨 축하해요ㅎㅎ",
      "이야 축하드립니다ㅋㅋ",
    ];

    const thanks = [
      "헉 제가 됐네요ㅋㅋ 감사합니다!",
      "와 진짜요? 감사합니다ㅎㅎ",
      "감사해요!! 잘 쓸게요ㅎㅎ",
      "헉 당첨됐네요~ 감사합니다",
      "오 감사합니다ㅋㅋ 기분 좋네요",
      "감사합니당~! 생각도 못했네요ㅋㅋ",
      "와 감사합니다ㅎㅎ 이번엔 운이 좋았네요",
      "헉 감사합니다! 저도 놀랐어요ㅋㅋ",
    ];

    const split = Math.min(others.length, randInt(1, 2));
    const before = others.slice(0, split).map((c) => ({
      member_id: c.member_id,
      message: styleLocalText(c, pickOne(congrats)),
      act: "celebrate",
    }));
    const self = winnerCharacter ? [{
      member_id: winnerCharacter.member_id,
      message: styleLocalText(winnerCharacter, pickOne(thanks)),
      act: "answer",
    }] : [];
    const after = others.slice(split).map((c) => ({
      member_id: c.member_id,
      message: styleLocalText(c, pickOne(congrats)),
      act: "celebrate",
    }));
    return [...before, ...self, ...after];
  }

  const common = [
    "오 이번 것도 해볼게요ㅋㅋ",
    "저도 슬쩍 참여했어요ㅎㅎ",
    "이번엔 운 좀 따라줬으면 좋겠네요ㅋㅋ",
    "저 방금 넣었어요",
    "오 재밌어 보이네요ㅎㅎ",
    "이번 것도 한번 가봅니다ㅋㅋ",
    "저도 참여 완료ㅎㅎ",
    "이번엔 뭐 나올지 궁금하네요",
    "저도 방금 했어요ㅋㅋ",
    "이번엔 느낌이 좀 좋은데요ㅎㅎ",
  ];

  let pool = common;
  if (eventType.includes("gift") || title.includes("선물상자")) {
    pool = [
      "선물상자 뭐 나올지 궁금하네요ㅋㅋ",
      "저도 하나 골랐어요ㅎㅎ",
      "이번엔 좋은 거 나왔으면ㅋㅋ",
      "오 선물상자 또 떴네요 저도 해볼게요",
      "저 방금 하나 골랐어요ㅋㅋ",
      "이번 건 괜히 기대되네요ㅎㅎ",
      "저도 참여했어요 이번엔 운 좀 따라주길ㅋㅋ",
      "선물상자 은근 고르는 맛 있네요ㅎㅎ",
    ];
  } else if (eventType.includes("quiz") || title.includes("퀴즈")) {
    pool = [
      "이번 문제 은근 헷갈리네요ㅋㅋ",
      "저 답 넣었어요ㅎㅎ",
      "이건 좀 고민되는데요ㅋㅋ",
      "저도 하나 골라봤어요",
      "이번 문제는 자신 없네요ㅎㅎ",
      "오 이건 알 것 같기도 한데ㅋㅋ",
      "저도 참여 완료요ㅎㅎ",
    ];
  } else if (eventType.includes("roulette") || title.includes("룰렛")) {
    pool = [
      "저도 돌려봤어요ㅋㅋ",
      "이번엔 어디 걸리려나ㅎㅎ",
      "룰렛은 괜히 두근거리네요ㅋㅋ",
      "저도 한번 가봅니다",
      "이번엔 느낌 좋네요ㅎㅎ",
    ];
  } else if (eventType.includes("number") || title.includes("숫자")) {
    pool = [
      "저도 숫자 하나 찍었어요ㅋㅋ",
      "이번엔 감으로 골랐어요ㅎㅎ",
      "숫자 고르는 게 더 어렵네요ㅋㅋ",
      "저도 하나 넣었습니다",
      "이번엔 제 숫자 맞았으면ㅎㅎ",
    ];
  } else if (eventType.includes("attendance") || title.includes("출석")) {
    pool = [
      "저도 출석 완료ㅎㅎ",
      "출석 체크했어요ㅋㅋ",
      "오늘 것도 챙겼습니다ㅎㅎ",
      "저도 방금 참여했어요",
      "출석은 놓치면 아쉽죠ㅋㅋ",
    ];
  } else if (eventType.includes("first") || title.includes("선착순")) {
    pool = [
      "저도 얼른 들어갔어요ㅋㅋ",
      "이번엔 타이밍 맞았네요ㅎㅎ",
      "선착순이라 바로 눌렀어요ㅋㅋ",
      "저도 참여했어요 이번엔 빠르게ㅎㅎ",
      "오 이건 속도가 중요하네요ㅋㅋ",
    ];
  }

  const used = new Set();
  return selected.map((c) => {
    let message = pickOne(pool);
    for (let i = 0; i < 6 && used.has(message); i += 1) message = pickOne(pool);
    used.add(message);
    return { member_id: c.member_id, message: styleLocalText(c, message), act: "agree" };
  });
}`;

s = replaceFunction(s, 'localEventMessages', localEventMessages);

const oldSelect = 'const selected = weightedSample(participantCharacters, Math.min(participantCharacters.length, randInt(1, 2)), (c) => Number(c.general_reply_rate || 10) + 5);';
const newSelect = `const reactionRoll = Math.random();\n    const reactionCount = reactionRoll < 0.30 ? 0 : reactionRoll < 0.85 ? 1 : 2;\n    if (reactionCount === 0) {\n      await db.from("ai_community_events").update({ status: "done", processed_at: now.toISOString() }).eq("id", communityEvent.id);\n      return { started: 0, type: "event_start", skipped: true, apiCalls: 0 };\n    }\n    const selected = weightedSample(participantCharacters, Math.min(participantCharacters.length, reactionCount), (c) => Number(c.general_reply_rate || 10) + 5);`;
if (!s.includes(oldSelect)) throw new Error('event_start selection anchor not found');
s = s.replace(oldSelect, newSelect);

fs.writeFileSync(path, s);
console.log('V42 patch applied');
