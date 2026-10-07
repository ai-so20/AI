import fs from "node:fs";

const path = "app/lib/ai-community.js";
let src = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (!src.includes(search)) throw new Error(`${label} not found`);
  src = src.replace(search, replacement);
}

// 1) 닉네임을 직접 부른 짧은 호출에는 그 캐릭터가 바로 자연스럽게 응답.
const helperAnchor = `function detectSituation(text) {`;
const helper = `function directNicknameCallReply(character, text) {
  const nickname = String(character?.profile?.nickname || character?.character_name || "").trim();
  if (!nickname) return null;
  const raw = String(text || "").trim();
  if (!raw.includes(nickname)) return null;
  const remainder = raw.replaceAll(nickname, "").replace(/[@?？！!~ㅎㅎㅋ\\s]/g, "").trim();
  if (remainder.length > 10) return null;
  const choices = ["네?", "넹?", "왜요?", "무슨 일이져?", "불렀나요?", "네 ㅋㅋ", "저요?", "여기 있어요ㅎㅎ"];
  return choices[randInt(0, choices.length - 1)];
}

`;
replaceOnce(helperAnchor, helper + helperAnchor, "nickname helper anchor");

const mentionBlock = `  if (mentioned) selected = [mentioned, ...selected.filter((c) => c.member_id !== mentioned.member_id)].slice(0, count);
  if (!selected.length) return { scheduled: 0, situation };
`;
const mentionReplacement = `  if (mentioned) selected = [mentioned, ...selected.filter((c) => c.member_id !== mentioned.member_id)].slice(0, count);
  if (!selected.length) return { scheduled: 0, situation };

  const directCallText = mentioned ? directNicknameCallReply(mentioned, info.latest.content) : null;
  if (directCallText) selected = [mentioned];
`;
replaceOnce(mentionBlock, mentionReplacement, "mention selection block");

const intentBlock = `  const intent = simpleHumanIntent(info.latest.content);
  let prepared = [];
  let provider = "local";

  if (intent !== "other" || situation !== "general") {
`;
const intentReplacement = `  const intent = simpleHumanIntent(info.latest.content);
  let prepared = [];
  let provider = "local";

  if (directCallText && mentioned) {
    prepared = [{
      member_id: mentioned.member_id,
      message: styleLocalText(mentioned, directCallText),
      act: "answer",
      reply_to_message_id: info.latest.id,
    }];
  } else if (intent !== "other" || situation !== "general") {
`;
replaceOnce(intentBlock, intentReplacement, "direct call preparation");

// 2) 자율대화는 2~3명으로 시작하되 같은 사람이 다시 말하고, 중간에 새 사람이 합류할 수 있게 캐스트를 회전.
const autonomousBlock = `  const targetCount = Math.min(availableCharacters.length, randInt(2, 4));
  const selected = weightedSample(availableCharacters, targetCount, (c) => topicInterestWeight(c, topic));
  if (selected.length < 2) return 0;

  const localScene = await localAutonomousMessages(db, selected, topic, now);
  const prepared = localScene.messages;
`;
const autonomousReplacement = `  const targetCount = Math.min(availableCharacters.length, randInt(2, 3));
  const selected = weightedSample(availableCharacters, targetCount, (c) => topicInterestWeight(c, topic));
  if (selected.length < 2) return 0;

  const participantRoster = [...selected];
  const outsiders = availableCharacters.filter((c) => !selected.some((s) => s.member_id === c.member_id));
  if (outsiders.length && Math.random() < 0.7) {
    const newcomer = weightedSample(outsiders, 1, (c) => topicInterestWeight(c, topic))[0];
    if (newcomer) participantRoster.push(newcomer);
  }

  const turnTarget = randInt(4, 8);
  const conversationCast = [];
  let lastId = null;
  for (let i = 0; i < turnTarget; i += 1) {
    let pool = participantRoster;
    if (i < 2) pool = selected;
    const candidates = pool.filter((c) => c.member_id !== lastId);
    const chosen = weightedSample(candidates.length ? candidates : pool, 1, (c) => {
      const base = topicInterestWeight(c, topic);
      const previousTurns = conversationCast.filter((x) => x.member_id === c.member_id).length;
      const repeatBias = previousTurns === 0 ? 1.35 : previousTurns === 1 ? 1.05 : 0.55;
      return base * repeatBias;
    })[0];
    if (!chosen) break;
    conversationCast.push(chosen);
    lastId = chosen.member_id;
  }

  const localScene = await localAutonomousMessages(db, conversationCast, topic, now);
  const prepared = localScene.messages;
`;
replaceOnce(autonomousBlock, autonomousReplacement, "autonomous rotating cast");

replaceOnce(
  `  await addParticipants(db, thread.id, selected);\n  await db.from("ai_topic_history").insert({ topic_id: topic.id, thread_id: thread.id, used_at: now.toISOString() });`,
  `  await addParticipants(db, thread.id, participantRoster);\n  await db.from("ai_topic_history").insert({ topic_id: topic.id, thread_id: thread.id, used_at: now.toISOString() });`,
  "autonomous participant roster"
);

// 3) 한 대화가 끝나면 바로 새 주제를 뱉지 않고 5~10분 자연스러운 공백.
src = src.replaceAll(
  `new Date(now.getTime() + 60 * 1000).toISOString()`,
  `new Date(now.getTime() + randInt(5, 10) * 60 * 1000).toISOString()`
);

// 4) 공통 규칙에도 참여자 순환을 명시.
const commonNeedle = `- 사람 단톡은 모든 메시지를 설명으로 완결하지 않는다. 짧은 감탄, 맞장구, 한마디 경험, 가벼운 반대가 섞여야 한다.\n`;
const commonInsert = `- 사람 단톡은 모든 메시지를 설명으로 완결하지 않는다. 짧은 감탄, 맞장구, 한마디 경험, 가벼운 반대가 섞여야 한다.\n- 한 주제에서 한 캐릭터가 한 번만 말하고 사라지지 않는다. 몇 명이 대화를 이어가다가 누군가는 조용해지고, 다른 캐릭터가 중간에 합류하며, 먼저 말했던 캐릭터가 다시 끼어들 수 있다.\n- 같은 캐릭터가 한 주제에서 2~4번 등장해도 자연스럽다. 단, 모든 캐릭터가 순번처럼 돌아가며 한마디씩 하는 구조는 피한다.\n- 누군가 캐릭터 닉네임을 직접 부르면 그 캐릭터가 먼저 '네?', '왜요?', '불렀나요?' 같은 짧은 존재 반응을 할 수 있다.\n`;
replaceOnce(commonNeedle, commonInsert, "room flow prompt rules");

fs.writeFileSync(path, src);
console.log("V23 room flow patch applied");
