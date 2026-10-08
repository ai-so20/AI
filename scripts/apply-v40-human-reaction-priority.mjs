import fs from 'node:fs';

const path = 'app/lib/ai-community.js';
let s = fs.readFileSync(path, 'utf8');

function mustReplace(oldText, newText, label) {
  if (!s.includes(oldText)) throw new Error(`V40 anchor not found: ${label}`);
  s = s.replace(oldText, newText);
}

mustReplace(
`function directNicknameCallReply(character, text) {
  const nickname = String(character?.profile?.nickname || character?.character_name || "").trim();
  if (!nickname) return null;
  const raw = String(text || "").trim();
  if (!raw.includes(nickname)) return null;
  const remainder = raw.replaceAll(nickname, "").replace(/[@?？！!~ㅎㅎㅋ\\s]/g, "").trim();
  if (remainder.length > 10) return null;
  const choices = ["네?", "넹?", "왜요?", "무슨 일이져?", "불렀나요?", "네 ㅋㅋ", "저요?", "여기 있어요ㅎㅎ"];
  return choices[randInt(0, choices.length - 1)];
}`,
`function directNicknameCallReply(character, text) {
  const nickname = String(character?.profile?.nickname || character?.character_name || "").trim();
  if (!nickname) return null;
  const raw = String(text || "").trim();
  if (!raw.includes(nickname)) return null;

  // 이름이 들어갔다고 전부 '호출'로 취급하지 않습니다.
  // '바람따라님 축하드려요', 'OO님 감사합니다'처럼 내용이 있는 직접 대화는
  // 호출 응답이 아니라 해당 내용에 맞는 문맥 응답으로 넘깁니다.
  const semantic = raw
    .replaceAll(nickname, "")
    .replace(/님/g, "")
    .replace(/[@?？！!~ㅎㅎㅋ\\s]/g, "")
    .trim();
  if (/(축하|감사|고마|당첨|잘됐|잘되|대박|좋네|좋아요|좋네요|수익|괜찮|멋지|부럽|화이팅|힘내|잘쓸|잘쓸게)/i.test(semantic)) return null;
  if (semantic.length > 10) return null;

  const choices = ["네?", "넹?", "왜요?", "무슨 일이져?", "불렀나요?", "네 ㅋㅋ", "저요?", "여기 있어요ㅎㅎ"];
  return choices[randInt(0, choices.length - 1)];
}`,
'direct nickname call classification'
);

mustReplace(
`  let count;
  if (situation === "celebration") {
    count = Math.min(characters.length, Math.max(Number(settings.celebration_min || 5), randInt(5, 7)));
  } else {
    count = randInt(Number(settings.human_reply_min || 2), Number(settings.human_reply_max || 3));
  }`,
`  // 실제회원 메시지는 항상 소수 인원이 집중해서 반응합니다.
  // 이벤트 시스템 당첨 축하는 별도 event_winner 흐름에서 처리하므로,
  // 회원 한마디에 5~7명이 몰려드는 현상을 만들지 않습니다.
  let count = randInt(Number(settings.human_reply_min || 2), Number(settings.human_reply_max || 3));
  count = Math.max(1, Math.min(3, count, characters.length));`,
'human responder count'
);

mustReplace(
`  if (directCallText && mentioned) {
    prepared = [{
      member_id: mentioned.member_id,
      message: styleLocalText(mentioned, directCallText),
      act: "answer",
      reply_to_message_id: info.latest.id,
    }];
  } else if (intent !== "other" || situation !== "general") {
    const effectiveIntent = situation === "celebration" ? "celebration" : situation === "loss" ? "loss" : intent;
    prepared = selected.map((c) => ({
      member_id: c.member_id,
      message: localReplyForHuman(c, effectiveIntent, info.latest.content),
      act: effectiveIntent === "loss" ? "support" : effectiveIntent === "celebration" ? "celebration" : "agree",
      reply_to_message_id: info.latest.id,
    }));
  } else {
    const context = await recentChatContext(db, 10);
    try {
      const batch = await generateHumanBatch(db, info.latest.content, selected, context, "human_batch");
      prepared = batch.replies.map((r) => ({ ...r, reply_to_message_id: info.latest.id }));
      provider = batch.provider;
    } catch (error) {
      await logEngineEvent(db, {
        level: "warning",
        category: error?.code || "AI_BATCH_FALLBACK_LOCAL",
        provider: error?.provider || null,
        message: error?.message || "배치 생성 실패, 로컬 반응으로 대체",
        meta: { source_message_id: info.latest.id },
      });
      prepared = selected.map((c, i) => ({
        member_id: c.member_id,
        message: styleLocalText(c, i === 0 ? "음 그건 저도 좀 궁금하네요" : pickOne(["저도 비슷하게 생각했어요", "이건 다른 분들 생각도 궁금하네요ㅎㅎ", "저는 일단 조금 더 봐야 알 것 같아요"])),
        act: "agree",
        reply_to_message_id: info.latest.id,
      }));
      provider = "local_fallback";
    }
  }`,
`  if (directCallText && mentioned) {
    prepared = [{
      member_id: mentioned.member_id,
      message: styleLocalText(mentioned, directCallText),
      act: "answer",
      reply_to_message_id: info.latest.id,
    }];
  } else {
    // V40: 실제회원 대화는 템플릿보다 문맥 이해를 우선합니다.
    // 인사/축하/감사/손실 표현도 최근 대화와 캐릭터 성향을 함께 읽고 답하게 합니다.
    const context = await recentChatContext(db, 14);
    try {
      const batch = await generateHumanBatch(db, info.latest.content, selected, context, "human_batch_v40");
      prepared = batch.replies.map((r) => ({ ...r, reply_to_message_id: info.latest.id }));
      provider = batch.provider;
    } catch (error) {
      await logEngineEvent(db, {
        level: "warning",
        category: error?.code || "AI_BATCH_FALLBACK_LOCAL",
        provider: error?.provider || null,
        message: error?.message || "회원 문맥 생성 실패, 로컬 반응으로 대체",
        meta: { source_message_id: info.latest.id },
      });
      const effectiveIntent = situation === "celebration" ? "celebration" : situation === "loss" ? "loss" : intent;
      prepared = selected.map((c, i) => ({
        member_id: c.member_id,
        message: localReplyForHuman(c, effectiveIntent === "other" ? "agree" : effectiveIntent, info.latest.content),
        act: effectiveIntent === "loss" ? "support" : effectiveIntent === "celebration" ? "celebration" : i === 0 ? "answer" : "agree",
        reply_to_message_id: info.latest.id,
      }));
      provider = "local_fallback";
    }
  }`,
'human response generation path'
);

mustReplace(
`- 첫 번째 답변은 실제회원의 핵심 말에 바로 반응한다. 회원이 "여러분?", "계세요?", "왜 답이 없어요"처럼 호출하면 호출 자체에 먼저 답한다.
- 두 번째/세 번째 답변은 회원에게 직접 답하거나 바로 앞 AI의 한 단어/의견을 받아 이어간다. 각자 새 주제를 꺼내지 않는다.`,
`- 첫 번째 답변은 실제회원이 방금 말한 구체적인 내용에 바로 반응한다. 회원이 "여러분?", "계세요?", "왜 답이 없어요"처럼 방 전체를 호출하면 호출 자체에 먼저 답한다.
- 회원이 특정 캐릭터의 닉네임을 언급했다면 단순히 이름이 나왔다는 이유로 "불렀나요?"라고 하지 않는다. 문장 전체 의미를 먼저 읽는다. 예: "바람따라님 축하드려요" → 바람따라는 "감사합니다ㅎㅎ", "헉 감사해요!"처럼 답한다.
- 회원이 축하/감사/질문/불만/경험을 말하면 그 행위에 직접 반응한다. 이름 호출 여부보다 문장의 의미가 우선이다.
- 두 번째/세 번째 답변은 회원에게 직접 답하거나 바로 앞 AI의 한 단어/의견을 받아 이어간다. 각자 새 주제를 꺼내지 않는다.
- 회원의 말이 아직 살아있는 동안 AI끼리 허브티, 날씨, 퇴근 같은 새 일상 주제로 넘어가지 않는다.`,
'human batch prompt priority'
);

mustReplace(
`- 이벤트/공지 직후에는 모든 사람이 반응하지 않는다. 선택된 응답자만 짧게 반응하고, 다음 대화에서는 기존 일상 주제로 돌아가도 된다.`,
`- 이벤트/공지 직후에도 현재 회원이 말을 걸었다면 회원 메시지가 우선이다. 선택된 2~3명만 회원의 말에 반응한다.
- 회원이 당첨자에게 축하를 보냈고 그 당첨자가 AI 캐릭터라면, 그 캐릭터의 첫 반응은 감사/놀람/상품에 대한 짧은 기쁨 중 하나여야 한다.`,
'event and human priority prompt'
);

fs.writeFileSync(path, s);
console.log('V40 human reaction priority patch applied');
