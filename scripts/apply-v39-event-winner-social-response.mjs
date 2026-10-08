import fs from 'node:fs';

const path = 'app/lib/ai-community.js';
let s = fs.readFileSync(path, 'utf8');

const oldDirect = `function directNicknameCallReply(character, text) {\n  const nickname = String(character?.profile?.nickname || character?.character_name || \"\").trim();\n  if (!nickname) return null;\n  const raw = String(text || \"\").trim();\n  if (!raw.includes(nickname)) return null;\n  const remainder = raw.replaceAll(nickname, \"\").replace(/[@?？！!~ㅎㅎㅋ\\s]/g, \"\").trim();\n  if (remainder.length > 10) return null;\n  const choices = [\"네?\", \"넹?\", \"왜요?\", \"무슨 일이져?\", \"불렀나요?\", \"네 ㅋㅋ\", \"저요?\", \"여기 있어요ㅎㅎ\"];\n  return choices[randInt(0, choices.length - 1)];\n}\n\nfunction directNicknameCallPlan() {\n  const roll = Math.random();\n  if (roll < 0.55) return { mode: \"quick\", delaySeconds: 5, silenceMinutes: 0 };\n  if (roll < 0.85) return { mode: \"delayed\", delaySeconds: randInt(60, 180), silenceMinutes: 0 };\n  return { mode: \"ignore\", delaySeconds: null, silenceMinutes: randInt(10, 20) };\n}`;

const newDirect = `function isDirectCongratulation(text, nickname) {\n  const raw = String(text || \"\").trim();\n  if (!nickname || !raw.includes(nickname)) return false;\n  return /(축하|당첨|잘됐|잘 됐|대박|좋은 소식|좋겠)/.test(raw);\n}\n\nfunction directNicknameCallReply(character, text) {\n  const nickname = String(character?.profile?.nickname || character?.character_name || \"\").trim();\n  if (!nickname) return null;\n  const raw = String(text || \"\").trim();\n  if (!raw.includes(nickname)) return null;\n\n  // \"OO님 축하드려요\"는 호출이 아니라 축하 인사다. 당첨자는 감사 반응을 해야 한다.\n  if (isDirectCongratulation(raw, nickname)) {\n    const thanks = [\n      \"감사합니다~\",\n      \"헉 감사합니다ㅎㅎ\",\n      \"감사해요!!\",\n      \"감사합니당~!\",\n      \"헉 당첨됐네요ㅋㅋ 감사해요\",\n      \"와 감사합니다ㅎㅎ 잘 쓸게요\",\n      \"감사해요 ㅎㅎ 기분 좋네요\",\n    ];\n    return thanks[randInt(0, thanks.length - 1)];\n  }\n\n  const remainder = raw.replaceAll(nickname, \"\").replace(/[@?？！!~ㅎㅎㅋ\\s]/g, \"\").trim();\n  if (remainder.length > 10) return null;\n  const choices = [\"네?\", \"넹?\", \"왜요?\", \"무슨 일이져?\", \"불렀나요?\", \"네 ㅋㅋ\", \"저요?\", \"여기 있어요ㅎㅎ\"];\n  return choices[randInt(0, choices.length - 1)];\n}\n\nfunction directNicknameCallPlan(forceResponse = false) {\n  const roll = Math.random();\n  if (forceResponse) {\n    if (roll < 0.72) return { mode: \"quick\", delaySeconds: randInt(5, 18), silenceMinutes: 0 };\n    return { mode: \"delayed\", delaySeconds: randInt(30, 90), silenceMinutes: 0 };\n  }\n  if (roll < 0.55) return { mode: \"quick\", delaySeconds: 5, silenceMinutes: 0 };\n  if (roll < 0.85) return { mode: \"delayed\", delaySeconds: randInt(60, 180), silenceMinutes: 0 };\n  return { mode: \"ignore\", delaySeconds: null, silenceMinutes: randInt(10, 20) };\n}`;

if (!s.includes(oldDirect)) throw new Error('direct nickname anchor not found');
s = s.replace(oldDirect, newDirect);

const oldPlan = `  const directCallText = mentioned ? directNicknameCallReply(mentioned, info.latest.content) : null;\n  const directCallPlan = directCallText && mentioned ? directNicknameCallPlan() : null;`;
const newPlan = `  const directCallText = mentioned ? directNicknameCallReply(mentioned, info.latest.content) : null;\n  const directCongrats = mentioned ? isDirectCongratulation(info.latest.content, mentioned?.profile?.nickname || mentioned?.character_name) : false;\n  const directCallPlan = directCallText && mentioned ? directNicknameCallPlan(directCongrats) : null;`;
if (!s.includes(oldPlan)) throw new Error('direct plan anchor not found');
s = s.replace(oldPlan, newPlan);

const oldLocalEvent = `function localEventMessages(selected, event, winner = null) {\n  if (winner) {\n    return selected.map((c) => ({\n      member_id: c.member_id,\n      message: styleLocalText(\n        c,\n        c.member_id === winner.id\n          ? pickOne([\"헉 제가요? 감사합니다ㅎㅎ\", \"와 저 당첨된 거예요?ㅋㅋ 감사합니다!\", \"헉 대박 감사합니다\"])\n          : pickOne(LOCAL_REACTIONS.celebration)\n      ),\n      act: \"celebration\",\n    }));\n  }\n  const label = event?.title || \"이벤트\";\n  return selected.map((c, i) => ({\n    member_id: c.member_id,\n    message: styleLocalText(c, i === 0 ? \`\${label} 저도 참여했어요ㅎㅎ\` : pickOne([\"오 저도 넣었어요ㅋㅋ\", \"저도 참여 완료!\", \"이번엔 좀 기대되네요ㅎㅎ\"])),\n    act: \"agree\",\n  }));\n}`;

const newLocalEvent = `function localEventMessages(selected, event, winner = null) {\n  if (winner) {\n    const winnerCharacter = selected.find((c) => c.member_id === winner.id) || null;\n    const others = selected.filter((c) => c.member_id !== winner.id);\n    // 당첨 발표 직후에는 먼저 1~2명이 축하하고, AI 당첨자는 곧바로 감사 인사를 하게 한다.\n    const split = Math.min(others.length, randInt(1, 2));\n    const ordered = winnerCharacter\n      ? [...others.slice(0, split), winnerCharacter, ...others.slice(split)]\n      : others;\n    const prize = String(event?.prize || \"\").trim();\n    const winnerThanks = [\n      \"감사합니다~\",\n      \"헉 제가 당첨됐네요ㅎㅎ 감사합니다!\",\n      \"감사해요!!\",\n      \"와 진짜요? 감사합니다ㅋㅋ\",\n      \"감사합니당~!\",\n      \"헉 대박ㅋㅋ 감사해요\",\n      prize && prize !== \"VIP EVENT 당첨\" ? \`\${prize} 잘 쓸게요ㅎㅎ 감사합니다\` : \"잘 쓸게요ㅎㅎ 감사합니다\",\n    ].filter(Boolean);\n    const congrats = [\n      \"와 축하해요!\",\n      \"오 대박 축하드려요ㅎㅎ\",\n      \"헉 축하해요ㅋㅋ\",\n      \"와 부럽네요 축하드려요!\",\n      \"오 당첨되셨네요 축하드려요~\",\n      \"대박ㅋㅋ 축하해요\",\n      \"축하드려요!!\",\n    ];\n    return ordered.map((c) => ({\n      member_id: c.member_id,\n      message: styleLocalText(c, c.member_id === winner.id ? pickOne(winnerThanks) : pickOne(congrats)),\n      act: \"celebration\",\n    }));\n  }\n  const label = event?.title || \"이벤트\";\n  return selected.map((c, i) => ({\n    member_id: c.member_id,\n    message: styleLocalText(c, i === 0 ? \`\${label} 저도 참여했어요ㅎㅎ\` : pickOne([\"오 저도 넣었어요ㅋㅋ\", \"저도 참여 완료!\", \"이번엔 좀 기대되네요ㅎㅎ\"])),\n    act: \"agree\",\n  }));\n}`;
if (!s.includes(oldLocalEvent)) throw new Error('localEventMessages anchor not found');
s = s.replace(oldLocalEvent, newLocalEvent);

s = s.replace(
  '.select("id,title,event_type,status,starts_at,ends_at")',
  '.select("id,title,event_type,status,starts_at,ends_at,prize")'
);

const oldWinnerSelect = `    let selected = await selectHumanResponders(others, \"celebration\", Math.min(baseCount, others.length), now);\n    const winnerCharacter = characters.find((c) => c.member_id === winner.id);\n    if (winnerCharacter && selected.length < 6) selected = [...selected, winnerCharacter];`;
const newWinnerSelect = `    let selected = await selectHumanResponders(others, \"celebration\", Math.min(baseCount, others.length), now);\n    const winnerCharacter = characters.find((c) => c.member_id === winner.id);\n    if (winnerCharacter && !selected.some((c) => c.member_id === winner.id)) selected = [...selected, winnerCharacter];`;
if (!s.includes(oldWinnerSelect)) throw new Error('winner selection anchor not found');
s = s.replace(oldWinnerSelect, newWinnerSelect);

// 이벤트 축하/참여 흐름은 일반 잡담보다 반응 간격을 짧게 한다.
s = s.replace(
  '      delaySeconds: nextAiTurnDelaySeconds(),\n      preferredMemberId: remaining[0].member_id,',
  '      delaySeconds: thread.thread_type === "event_winner" ? randInt(6, 18) : thread.thread_type === "event_start" ? randInt(10, 30) : nextAiTurnDelaySeconds(),\n      preferredMemberId: remaining[0].member_id,'
);
s = s.replace(
  '        scheduled_at: new Date(now.getTime() + nextAiTurnDelaySeconds() * 1000).toISOString(),',
  '        scheduled_at: new Date(now.getTime() + (thread.thread_type === "event_winner" ? randInt(6, 18) : thread.thread_type === "event_start" ? randInt(10, 30) : nextAiTurnDelaySeconds()) * 1000).toISOString(),'
);

fs.writeFileSync(path, s);
console.log('V39 event winner social response patch applied');
