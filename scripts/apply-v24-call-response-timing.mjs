import fs from "node:fs";

const path = "app/lib/ai-community.js";
let src = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (!src.includes(search)) throw new Error(`${label} not found`);
  src = src.replace(search, replacement);
}

replaceOnce(
`function directNicknameCallReply(character, text) {
  const nickname = String(character?.profile?.nickname || character?.character_name || "").trim();
  if (!nickname) return null;
  const raw = String(text || "").trim();
  if (!raw.includes(nickname)) return null;
  const remainder = raw.replaceAll(nickname, "").replace(/[@?？！!~ㅎㅎㅋ\\s]/g, "").trim();
  if (remainder.length > 10) return null;
  const choices = ["네?", "넹?", "왜요?", "무슨 일이져?", "불렀나요?", "네 ㅋㅋ", "저요?", "여기 있어요ㅎㅎ"];
  return choices[randInt(0, choices.length - 1)];
}
`,
`function directNicknameCallReply(character, text) {
  const nickname = String(character?.profile?.nickname || character?.character_name || "").trim();
  if (!nickname) return null;
  const raw = String(text || "").trim();
  if (!raw.includes(nickname)) return null;
  const remainder = raw.replaceAll(nickname, "").replace(/[@?？！!~ㅎㅎㅋ\\s]/g, "").trim();
  if (remainder.length > 10) return null;
  const choices = ["네?", "넹?", "왜요?", "무슨 일이져?", "불렀나요?", "네 ㅋㅋ", "저요?", "여기 있어요ㅎㅎ"];
  return choices[randInt(0, choices.length - 1)];
}

function directNicknameCallPlan() {
  const roll = Math.random();
  if (roll < 0.55) return { mode: "quick", delaySeconds: 5, silenceMinutes: 0 };
  if (roll < 0.85) return { mode: "delayed", delaySeconds: randInt(60, 180), silenceMinutes: 0 };
  return { mode: "ignore", delaySeconds: null, silenceMinutes: randInt(10, 20) };
}
`,
"direct call plan helper"
);

replaceOnce(
`- 누군가 캐릭터 닉네임을 직접 부르면 그 캐릭터가 먼저 '네?', '왜요?', '불렀나요?' 같은 짧은 존재 반응을 할 수 있다.\n`,
`- 누군가 캐릭터 닉네임을 직접 부르면 그 캐릭터가 먼저 '네?', '왜요?', '불렀나요?' 같은 짧은 존재 반응을 할 수 있다.\n- 닉네임으로 불린 캐릭터는 답변 예정 시각 전까지 다른 대화에 끼어들지 않는다. 늦게 답할 예정인데 그 사이 다른 채팅을 치는 행동은 금지한다.\n- 호출을 무시한 경우에도 실제로는 그 호출을 못 본 것처럼 한동안 조용히 있다가 충분한 시간이 지난 뒤 일반 대화에 다시 등장할 수 있다.\n`,
"common mention silence rules"
);

replaceOnce(
`  const directCallText = mentioned ? directNicknameCallReply(mentioned, info.latest.content) : null;
  if (directCallText) selected = [mentioned];

  await markHumanHandled(db, [info.latest]);
  await postponeAutonomousTurns(db, now);
`,
`  const directCallText = mentioned ? directNicknameCallReply(mentioned, info.latest.content) : null;
  const directCallPlan = directCallText && mentioned ? directNicknameCallPlan() : null;
  if (directCallText) selected = [mentioned];

  if (directCallPlan?.mode === "ignore" && mentioned) {
    await markHumanHandled(db, [info.latest]);
    await postponeAutonomousTurns(db, now);
    await db.from("ai_character_state").upsert({
      member_id: mentioned.member_id,
      next_available_at: new Date(now.getTime() + directCallPlan.silenceMinutes * 60 * 1000).toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "member_id" });
    return { scheduled: 0, situation, provider: "local", ignored: true, silenceMinutes: directCallPlan.silenceMinutes };
  }

  await markHumanHandled(db, [info.latest]);
  await postponeAutonomousTurns(db, now);

  if (directCallPlan && mentioned) {
    await db.from("ai_character_state").upsert({
      member_id: mentioned.member_id,
      next_available_at: new Date(now.getTime() + directCallPlan.delaySeconds * 1000).toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "member_id" });
  }
`,
"mention plan in human thread"
);

replaceOnce(
`  await publishPreparedNow(db, thread, characters, settings, prepared, now, provider);
  return { scheduled: prepared.length, situation, provider, apiCalls: provider.startsWith("local") ? 0 : 1 };
}

async function startWelcomeThread`,
`  if (directCallPlan && mentioned && prepared.length) {
    await queueTurn(db, thread.id, {
      delaySeconds: directCallPlan.delaySeconds,
      preferredMemberId: mentioned.member_id,
      targetMessageId: info.latest.id,
      turnKind: "human_reply",
      priority: 95,
      preparedPayload: prepared,
      preparedProvider: provider,
      generationMode: "local",
      now,
    });
    return {
      scheduled: prepared.length,
      situation,
      provider,
      apiCalls: 0,
      callMode: directCallPlan.mode,
      delaySeconds: directCallPlan.delaySeconds,
    };
  }

  await publishPreparedNow(db, thread, characters, settings, prepared, now, provider);
  return { scheduled: prepared.length, situation, provider, apiCalls: provider.startsWith("local") ? 0 : 1 };
}

async function startWelcomeThread`,
"queue direct nickname reply"
);

fs.writeFileSync(path, src);
console.log("V24 nickname call timing patch applied");
