import { createClient } from "@supabase/supabase-js";

export const AI_ROOM_ID = "0a495a02-bcb8-4e38-b3ef-4e7059c2a883";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function randInt(min, max) {
  const low = Math.ceil(Number(min || 0));
  const high = Math.floor(Number(max || low));
  if (high <= low) return low;
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function safeJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned || "[]");
}

function kstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  const hour = Number(get("hour") || 0);
  const minute = Number(get("minute") || 0);
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minute,
    minutes: hour * 60 + minute,
  };
}

function timeToMinutes(value, fallback = "00:00") {
  const text = String(value || fallback);
  const [h, m] = text.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function isInsideWindow(nowMinutes, start, end) {
  const startMinutes = timeToMinutes(start, "11:00");
  const endMinutes = timeToMinutes(end, "18:30");
  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function detectSituation(text) {
  const value = String(text || "").toLowerCase();
  const lossWords = [
    "손실", "마이너스", "손해", "떨어졌", "하락", "실패", "안됐", "안 됐",
    "속상", "아쉽", "잃었", "깨졌", "망했", "ㅠㅠ", "ㅜㅜ", "안좋", "안 좋",
  ];
  if (lossWords.some((word) => value.includes(word))) return "loss";

  const celebrationWords = [
    "당첨", "축하", "수익", "플러스", "성공", "승인", "합격", "대박", "좋은 결과",
    "승급", "승격", "완료됐", "잘됐", "잘 됐", "이겼", "뽑혔",
  ];
  if (celebrationWords.some((word) => value.includes(word))) return "celebration";
  return "general";
}

function weightedSample(items, count, weightField) {
  const pool = [...items];
  const picked = [];
  while (pool.length > 0 && picked.length < count) {
    const weights = pool.map((item) => {
      const value = typeof weightField === "function"
        ? Number(weightField(item))
        : Number(item?.[weightField] ?? 1);
      return Math.max(1, Number.isFinite(value) ? value : 1);
    });
    const total = weights.reduce((sum, value) => sum + value, 0);
    let roll = Math.random() * total;
    let index = 0;
    for (; index < weights.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) break;
    }
    const [chosen] = pool.splice(Math.min(index, pool.length - 1), 1);
    picked.push(chosen);
  }
  return picked;
}

async function loadSettings(db) {
  const { data } = await db
    .from("ai_community_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data || {
    enabled: true,
    activity_start: "11:00",
    activity_end: "18:30",
    autonomous_last_start_cutoff: "18:20",
    human_reply_min: 3,
    human_reply_max: 4,
    autonomous_participant_min: 2,
    autonomous_participant_max: 5,
    welcome_min: 3,
    welcome_max: 4,
    celebration_min: 5,
    autonomous_gap_min_minutes: 12,
    autonomous_gap_max_minutes: 25,
    human_quiet_minutes: 7,
  };
}

async function loadCharacters(db, now = new Date()) {
  const { data: characterRows, error } = await db
    .from("ai_character_profiles")
    .select("*")
    .eq("is_active", true);

  if (error || !characterRows?.length) return [];

  const memberIds = characterRows.map((row) => row.member_id);
  const [{ data: profiles }, { data: states }] = await Promise.all([
    db
      .from("profiles")
      .select("id,nickname,avatar,approval_status,account_type,ai_chat_enabled")
      .in("id", memberIds),
    db
      .from("ai_character_state")
      .select("*")
      .in("member_id", memberIds),
  ]);

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const stateMap = new Map((states || []).map((state) => [state.member_id, state]));
  const parts = kstParts(now);

  return characterRows
    .map((character) => ({
      ...character,
      profile: profileMap.get(character.member_id),
      state: stateMap.get(character.member_id) || null,
    }))
    .filter((character) => {
      const profile = character.profile;
      if (!profile) return false;
      if (profile.approval_status !== "approved") return false;
      if (profile.account_type !== "ai_character") return false;
      if (!profile.ai_chat_enabled) return false;
      return isInsideWindow(parts.minutes, character.activity_start, character.activity_end);
    });
}

function availableNow(character, now = new Date()) {
  const next = character?.state?.next_available_at;
  return !next || new Date(next).getTime() <= now.getTime();
}

function ensureCountFromCooling(allCharacters, selected, count) {
  if (selected.length >= count) return selected;
  const selectedIds = new Set(selected.map((item) => item.member_id));
  const rest = allCharacters
    .filter((item) => !selectedIds.has(item.member_id))
    .sort((a, b) => {
      const aTime = a?.state?.next_available_at ? new Date(a.state.next_available_at).getTime() : 0;
      const bTime = b?.state?.next_available_at ? new Date(b.state.next_available_at).getTime() : 0;
      return aTime - bTime;
    });
  return [...selected, ...rest.slice(0, Math.max(0, count - selected.length))];
}

async function recentChatContext(db, limit = 40) {
  const { data: messages } = await db
    .from("group_messages")
    .select("id,member_id,ai_character_id,content,created_at")
    .eq("room_id", AI_ROOM_ID)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = messages || [];
  const memberIds = [...new Set(rows.map((row) => row.member_id).filter(Boolean))];
  const { data: profiles } = memberIds.length
    ? await db.from("profiles").select("id,nickname,account_type").in("id", memberIds)
    : { data: [] };
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

  const chat = [...rows].reverse().map((row) => {
    const profile = row.member_id ? profileMap.get(row.member_id) : null;
    const speaker = profile?.nickname || (row.ai_character_id ? "이전 캐릭터" : "회원");
    return `${speaker}: ${String(row.content || "").slice(0, 500)}`;
  }).join("\n");

  return { rows, profileMap, text: chat };
}

async function findLatestUnhandledHuman(db) {
  const { rows, profileMap } = await recentChatContext(db, 80);
  const candidateRows = rows.filter((row) => row.member_id && profileMap.get(row.member_id)?.account_type === "human");
  if (!candidateRows.length) return null;

  const ids = candidateRows.map((row) => row.id);
  const { data: receipts } = await db
    .from("ai_human_message_receipts")
    .select("message_id")
    .in("message_id", ids);
  const handled = new Set((receipts || []).map((row) => row.message_id));
  const unhandled = candidateRows.filter((row) => !handled.has(row.id));
  if (!unhandled.length) return null;

  const latest = unhandled[0];
  return {
    latest,
    latestProfile: profileMap.get(latest.member_id),
    unhandled,
  };
}

async function markHumanHandled(db, rows) {
  const payload = (rows || []).map((row) => ({
    message_id: row.id,
    handled_at: new Date().toISOString(),
  }));
  if (payload.length) {
    await db.from("ai_human_message_receipts").upsert(payload, { onConflict: "message_id" });
  }
}

async function cancelInterruptibleQueues(db) {
  const { data: threads } = await db
    .from("ai_conversation_threads")
    .select("id,thread_type")
    .eq("status", "active")
    .in("thread_type", ["autonomous", "human_reply", "welcome"]);

  const ids = (threads || []).map((row) => row.id);
  if (!ids.length) return;

  await db
    .from("ai_reply_queue")
    .update({ status: "cancelled" })
    .in("thread_id", ids)
    .eq("status", "queued");

  await db
    .from("ai_conversation_threads")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "active");
}

async function publishDueReply(db, now = new Date()) {
  const { data: dueRows } = await db
    .from("ai_reply_queue")
    .select("id,thread_id,member_id,content,scheduled_at")
    .eq("status", "queued")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1);

  const due = dueRows?.[0];
  if (!due) return null;

  const { error: insertError } = await db.from("group_messages").insert({
    room_id: AI_ROOM_ID,
    member_id: due.member_id,
    ai_character_id: null,
    message_type: "text",
    content: due.content,
    is_deleted: false,
  });

  if (insertError) {
    console.error("AI community queue publish error:", insertError);
    return null;
  }

  await db
    .from("ai_reply_queue")
    .update({ status: "published", published_at: now.toISOString() })
    .eq("id", due.id);

  const { count } = await db
    .from("ai_reply_queue")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", due.thread_id)
    .eq("status", "queued");

  if (!count) {
    await db
      .from("ai_conversation_threads")
      .update({ status: "completed", completed_at: now.toISOString() })
      .eq("id", due.thread_id)
      .eq("status", "active");
  }

  return due;
}

async function generateGemini(prompt, maxOutputTokens = 2600) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.05,
          maxOutputTokens,
          responseMimeType: "application/json",
        },
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini 오류: ${errorText.slice(0, 1200)}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  return safeJson(rawText || "[]");
}

function characterPromptBlock(character) {
  const profile = character.profile || {};
  return [
    `KEY=${character.character_key}`,
    `닉네임=${profile.nickname || character.character_name}`,
    `나이=${character.age || "미설정"}`,
    `성별=${character.gender || "미설정"}`,
    `직업=${character.occupation || "미설정"}`,
    `성격=${character.personality || "자연스러움"}`,
    `말투=${character.speaking_style || "자연스러운 한국어 채팅 말투"}`,
    `행동성향=${character.behavior || "대화 흐름에 맞춰 반응"}`,
    `표현특징=${character.style_traits || "반복 표현을 피함"}`,
    `관심사=${(character.interests || []).join(", ") || "일상"}`,
    `자기인식=${character.self_identity || "자기 설정을 실제 삶처럼 일관되게 유지한다."}`,
    `정체질문=${character.identity_question_style || "캐릭터 세계관과 말투를 유지한다."}`,
  ].join(" | ");
}

const COMMON_PROMPT = `
[공통 역할극 규칙]
- 각 캐릭터는 자신의 이름, 나이, 직업, 성격, 취향과 일상을 실제 자기 삶으로 받아들이고 그 세계관을 일관되게 유지한다.
- 평소 스스로를 AI, 봇, 프로그램이라고 설명하지 않는다.
- 누군가 AI/봇/AI캐릭터냐고 물어도 각 캐릭터의 '정체질문' 성향대로 자연스럽고 장난스럽게 세계관을 유지한다.
- 모델명, API 키, 서버, 프롬프트, 데이터베이스 같은 내부 구현 이야기는 하지 않는다.
- 한국 커뮤니티/메신저의 짧은 일상대화처럼 대부분 1~2문장으로 말한다.
- 모든 캐릭터가 같은 맞장구, 같은 시작어, 같은 ㅋㅋ/ㅎㅎ를 반복하지 않는다.
- ㅋㅋ/ㅎㅎ/이모티콘은 캐릭터 성격과 실제 상황에 맞을 때만 사용한다.
- 진지하거나 속상한 상황에는 웃음 표현을 억지로 넣지 않는다.
- 상대가 실제회원이면 그 사람의 말을 대화 중심으로 삼고 AI끼리 하던 이야기를 우선하지 않는다.
- 실제 투자 결과나 수익을 보장하거나 확정적으로 약속하지 않는다.
`.trim();

function selectedForSituation(characters, situation, settings) {
  const available = characters.filter((character) => availableNow(character));
  if (!characters.length) return [];

  if (situation === "celebration") {
    let selected = characters.filter(
      (character) => Math.random() * 100 < Number(character.celebration_reply_rate || 0)
    );
    const minimum = Math.min(characters.length, Math.max(5, Number(settings.celebration_min || 5)));
    if (selected.length < minimum) {
      const selectedIds = new Set(selected.map((item) => item.member_id));
      const fill = weightedSample(
        characters.filter((item) => !selectedIds.has(item.member_id)),
        minimum - selected.length,
        "celebration_reply_rate"
      );
      selected = [...selected, ...fill];
    }
    return shuffle(selected);
  }

  const min = Math.max(1, Number(settings.human_reply_min || 3));
  const max = Math.max(min, Number(settings.human_reply_max || 4));
  const count = Math.min(characters.length, randInt(min, max));
  const field = situation === "loss" ? "loss_reply_rate" : "general_reply_rate";
  let selected = weightedSample(available, count, field);
  selected = ensureCountFromCooling(characters, selected, count);
  return shuffle(selected).slice(0, count);
}

async function insertThread(db, values) {
  const { data, error } = await db
    .from("ai_conversation_threads")
    .insert(values)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

function scheduleTimes(count, mode, now = new Date()) {
  const result = [];
  let cursor = now.getTime();

  if (mode === "celebration") cursor += randInt(10, 40) * 1000;
  else cursor += randInt(20, 70) * 1000;

  for (let index = 0; index < count; index += 1) {
    if (index > 0) {
      if (mode === "celebration") cursor += randInt(30, 100) * 1000;
      else cursor += randInt(60, 180) * 1000;
    }
    result.push(new Date(cursor));
  }
  return result;
}

async function setCharacterCooldowns(db, charactersByKey, generatedRows, scheduledTimes, topicCategory = null) {
  const lastTimeByMember = new Map();
  generatedRows.forEach((row, index) => {
    const character = charactersByKey.get(row.key);
    if (!character || !scheduledTimes[index]) return;
    lastTimeByMember.set(character.member_id, scheduledTimes[index]);
  });

  const stateRows = [];
  for (const [memberId, lastTime] of lastTimeByMember.entries()) {
    const character = [...charactersByKey.values()].find((item) => item.member_id === memberId);
    if (!character) continue;
    const restMinutes = randInt(character.rest_min_minutes || 15, character.rest_max_minutes || 45);
    const nextAvailable = new Date(lastTime.getTime() + restMinutes * 60 * 1000);
    const currentCount = Number(character?.state?.messages_today || 0);
    const today = kstParts().dateKey;
    const sameDay = character?.state?.state_date === today;
    stateRows.push({
      member_id: memberId,
      next_available_at: nextAvailable.toISOString(),
      last_spoke_at: lastTime.toISOString(),
      messages_today: (sameDay ? currentCount : 0) + generatedRows.filter((row) => charactersByKey.get(row.key)?.member_id === memberId).length,
      state_date: today,
      last_topic_category: topicCategory,
      updated_at: new Date().toISOString(),
    });
  }

  if (stateRows.length) {
    await db.from("ai_character_state").upsert(stateRows, { onConflict: "member_id" });
  }
}

async function queueGenerated(db, threadId, selectedCharacters, generated, mode, topicCategory = null) {
  const characterByKey = new Map(selectedCharacters.map((character) => [character.character_key, character]));
  const cleaned = (Array.isArray(generated) ? generated : [])
    .map((row) => ({
      key: String(row?.key || "").trim(),
      message: String(row?.message || "").trim(),
    }))
    .filter((row) => characterByKey.has(row.key) && row.message);

  if (!cleaned.length) return 0;

  const times = scheduleTimes(cleaned.length, mode);
  const endMinutes = timeToMinutes("18:30");
  const queueRows = cleaned.flatMap((row, index) => {
    const scheduled = times[index];
    const parts = kstParts(scheduled);
    if (parts.minutes >= endMinutes) return [];
    const character = characterByKey.get(row.key);
    return [{
      thread_id: threadId,
      member_id: character.member_id,
      content: row.message.slice(0, 1000),
      scheduled_at: scheduled.toISOString(),
      status: "queued",
    }];
  });

  if (!queueRows.length) {
    await db
      .from("ai_conversation_threads")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", threadId);
    return 0;
  }

  const { error } = await db.from("ai_reply_queue").insert(queueRows);
  if (error) throw error;

  const keptRows = cleaned.slice(0, queueRows.length);
  const keptTimes = times.slice(0, queueRows.length);
  await setCharacterCooldowns(db, characterByKey, keptRows, keptTimes, topicCategory);
  return queueRows.length;
}

async function scheduleHumanReplies(db, info, characters, settings) {
  const source = info.latest;
  const sourceProfile = info.latestProfile;
  const situation = detectSituation(source.content);
  const selected = selectedForSituation(characters, situation, settings);
  if (!selected.length) {
    await markHumanHandled(db, info.unhandled);
    return { scheduled: 0, situation };
  }

  await cancelInterruptibleQueues(db);

  const threadType = situation === "celebration"
    ? "celebration"
    : situation === "loss"
      ? "loss"
      : "human_reply";

  const threadId = await insertThread(db, {
    thread_type: threadType,
    source_member_id: source.member_id,
    source_message_id: source.id,
    status: "active",
  });

  const context = await recentChatContext(db, 35);
  const blocks = selected.map(characterPromptBlock).join("\n");
  const situationText = situation === "celebration"
    ? "축하하거나 기뻐할 만한 상황"
    : situation === "loss"
      ? "속상하거나 좋지 않은 상황"
      : "일반적인 실제회원 대화";

  const prompt = `
너는 한국 VIP 그룹채팅의 여러 캐릭터 대사를 한 번에 작성한다.
가장 중요한 사람은 방금 메시지를 보낸 실제회원 '${sourceProfile?.nickname || "회원"}'이다.
현재 상황: ${situationText}

${COMMON_PROMPT}

[이번에 반응할 캐릭터]
${blocks}

[최근 채팅]
${context.text || "최근 대화 없음"}

[가장 최근 실제회원 메시지]
${sourceProfile?.nickname || "회원"}: ${source.content || ""}

규칙:
- 선택된 캐릭터 각각 정확히 1번씩 반응한다.
- 실제회원의 마지막 말에 직접 이어지는 답으로 쓴다.
- 서로 같은 말을 반복하지 않는다.
- 캐릭터들이 모두 회원에게 질문만 던지지 않는다. 공감, 자기 경험, 짧은 농담, 짧은 질문을 섞는다.
- 축하 상황에서는 기쁜 분위기를 살리되 모두 똑같이 '축하해요'만 반복하지 않는다.
- 손실/속상한 상황에서는 가볍게 비웃거나 웃음 표현을 쓰지 않는다.

JSON 배열만 출력:
[
  {"key":"캐릭터 KEY","message":"채팅 메시지"}
]
`.trim();

  let generated;
  try {
    generated = await generateGemini(prompt, situation === "celebration" ? 4200 : 2200);
  } catch (error) {
    await db
      .from("ai_conversation_threads")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", threadId);
    throw error;
  }

  const queued = await queueGenerated(db, threadId, selected, generated, situation === "celebration" ? "celebration" : "human");
  await markHumanHandled(db, info.unhandled);

  // 해당 회원의 신규입장 환영 이벤트가 남아 있으면 이 실제 대화로 충분히 환영한 것으로 처리
  await db
    .from("ai_community_events")
    .update({ status: "done", processed_at: new Date().toISOString() })
    .eq("event_type", "member_join")
    .eq("member_id", source.member_id)
    .eq("status", "pending");

  return { scheduled: queued, situation };
}

async function scheduleWelcome(db, event, characters, settings) {
  const { data: member } = await db
    .from("profiles")
    .select("id,nickname,approval_status,account_type")
    .eq("id", event.member_id)
    .maybeSingle();

  if (!member || member.approval_status !== "approved" || member.account_type !== "human") {
    await db
      .from("ai_community_events")
      .update({ status: "cancelled", processed_at: new Date().toISOString() })
      .eq("id", event.id);
    return 0;
  }

  const min = Math.max(1, Number(settings.welcome_min || 3));
  const max = Math.max(min, Number(settings.welcome_max || 4));
  const count = Math.min(characters.length, randInt(min, max));
  let selected = weightedSample(characters.filter((item) => availableNow(item)), count, "general_reply_rate");
  selected = ensureCountFromCooling(characters, selected, count).slice(0, count);
  if (!selected.length) return 0;

  const threadId = await insertThread(db, {
    thread_type: "welcome",
    source_member_id: member.id,
    status: "active",
  });

  const blocks = selected.map(characterPromptBlock).join("\n");
  const prompt = `
새 실제회원 '${member.nickname}'이 VIP 그룹채팅에 들어왔다.
아래 캐릭터들이 3~4명 정도의 실제 메신저 환영 분위기로 각자 다르게 인사한다.

${COMMON_PROMPT}

[캐릭터]
${blocks}

추가 규칙:
- '환영합니다'만 여러 번 복사하지 않는다.
- 한 명 정도는 '오늘 처음 오신 거예요?'처럼 가벼운 말을 이어도 된다.
- 과하게 친한 척하거나 개인정보를 묻지 않는다.

JSON 배열만 출력:
[
  {"key":"캐릭터 KEY","message":"채팅 메시지"}
]
`.trim();

  const generated = await generateGemini(prompt, 1800);
  const queued = await queueGenerated(db, threadId, selected, generated, "human");

  await db
    .from("ai_community_events")
    .update({ status: "done", processed_at: new Date().toISOString() })
    .eq("id", event.id);

  return queued;
}

function topicInterestWeight(character, topic) {
  const interests = character.interests || [];
  const category = String(topic.category || "");
  let weight = Math.max(1, Number(character.general_reply_rate || 10));
  if (interests.includes(category)) weight *= 2.4;
  if (interests.some((interest) => String(topic.title || "").includes(interest))) weight *= 1.7;
  return weight;
}

async function pickTopic(db, now = new Date()) {
  const { data: topics } = await db
    .from("ai_chat_topics")
    .select("*")
    .eq("is_active", true);

  if (!topics?.length) return null;

  const { data: history } = await db
    .from("ai_topic_history")
    .select("topic_id,used_at")
    .gte("used_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("used_at", { ascending: false });

  const latestByTopic = new Map();
  (history || []).forEach((row) => {
    if (!latestByTopic.has(row.topic_id)) latestByTopic.set(row.topic_id, row.used_at);
  });

  const eligible = topics.filter((topic) => {
    const last = latestByTopic.get(topic.id);
    if (!last) return true;
    const cooldownMs = Number(topic.cooldown_hours || 48) * 60 * 60 * 1000;
    return now.getTime() - new Date(last).getTime() >= cooldownMs;
  });

  // 같은 세부주제뿐 아니라 같은 카테고리도 짧은 시간 안에 연속 반복하지 않습니다.
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const recentCategoryAt = new Map();
  (history || []).forEach((row) => {
    const category = topicById.get(row.topic_id)?.category;
    if (!category || recentCategoryAt.has(category)) return;
    recentCategoryAt.set(category, new Date(row.used_at).getTime());
  });
  const categorySpread = eligible.filter((topic) => {
    const lastAt = recentCategoryAt.get(topic.category);
    return !lastAt || now.getTime() - lastAt >= 4 * 60 * 60 * 1000;
  });

  const basePool = categorySpread.length >= 6 ? categorySpread : eligible;
  const pool = basePool.length ? basePool : topics.sort((a, b) => {
    const aLast = latestByTopic.get(a.id) ? new Date(latestByTopic.get(a.id)).getTime() : 0;
    const bLast = latestByTopic.get(b.id) ? new Date(latestByTopic.get(b.id)).getTime() : 0;
    return aLast - bLast;
  }).slice(0, Math.min(12, topics.length));

  // 시간대는 강제 규칙이 아니라 아주 약한 가중치만 줍니다.
  const hour = kstParts(now).hour;
  const weightForTopic = (topic) => {
    let weight = 10;
    if (hour >= 11 && hour < 13 && ["음식", "간식"].includes(topic.category)) weight += 3;
    if (hour >= 13 && hour < 16 && ["카페", "간식", "휴식"].includes(topic.category)) weight += 2;
    if (hour >= 16 && ["일상", "주말", "취향", "여행"].includes(topic.category)) weight += 2;
    return weight;
  };

  return weightedSample(pool, 1, weightForTopic)[0] || null;
}

async function scheduleAutonomous(db, characters, settings, now = new Date()) {
  const kst = kstParts(now);
  if (kst.minutes >= timeToMinutes(settings.autonomous_last_start_cutoff || "18:20")) return 0;

  const { count: queuedCount } = await db
    .from("ai_reply_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");
  if (queuedCount) return 0;

  const { data: state } = await db
    .from("ai_community_state")
    .select("next_autonomous_at")
    .eq("id", 1)
    .maybeSingle();

  if (state?.next_autonomous_at && new Date(state.next_autonomous_at).getTime() > now.getTime()) {
    return 0;
  }

  const { rows, profileMap } = await recentChatContext(db, 80);
  const lastHuman = rows.find((row) => row.member_id && profileMap.get(row.member_id)?.account_type === "human");
  if (lastHuman) {
    const quietMs = Number(settings.human_quiet_minutes || 7) * 60 * 1000;
    if (now.getTime() - new Date(lastHuman.created_at).getTime() < quietMs) return 0;
  }

  const topic = await pickTopic(db, now);
  if (!topic) return 0;

  const min = Math.max(2, Number(settings.autonomous_participant_min || 2));
  const max = Math.max(min, Number(settings.autonomous_participant_max || 5));
  const count = Math.min(characters.length, randInt(min, max));
  let selected = weightedSample(
    characters.filter((item) => availableNow(item, now)),
    count,
    (character) => topicInterestWeight(character, topic)
  );
  selected = ensureCountFromCooling(characters, selected, count).slice(0, count);
  if (selected.length < 2) return 0;

  const turnCount = randInt(4, 9);
  const threadId = await insertThread(db, {
    thread_type: "autonomous",
    topic_id: topic.id,
    status: "active",
  });

  const context = await recentChatContext(db, 24);
  const blocks = selected.map(characterPromptBlock).join("\n");
  const prompt = `
VIP 그룹채팅이 잠시 조용해서 캐릭터들이 먼저 가벼운 일상대화를 시작한다.

[오늘 사용할 주제]
카테고리: ${topic.category}
주제: ${topic.title}
방향: ${topic.prompt_seed}

${COMMON_PROMPT}

[참여 캐릭터]
${blocks}

[최근 채팅 - 반복 금지 참고]
${context.text || "최근 대화 없음"}

정확히 ${turnCount}개의 메시지로 하나의 짧은 대화를 만든다.
규칙:
- 참여자는 ${selected.length}명이며, 모든 사람이 꼭 같은 횟수로 말할 필요는 없다.
- 첫 사람이 자연스럽게 화제를 꺼내고 다른 사람이 자기 경험/공감/장난/질문으로 이어간다.
- '맞아요', '그러게요', '저도요'만 이어지는 빈 대화를 만들지 않는다.
- 4~9개 메시지 안에서 자연스럽게 끝난다.
- 매일 점심→커피→저녁 같은 고정 순서를 만들지 않는다.
- 최근 채팅에 이미 나온 주제나 시작문장을 그대로 재사용하지 않는다.
- 직업 이야기를 억지로 꺼내지 않는다. 쉬는 커뮤니티의 사적인 잡담처럼 말한다.

JSON 배열만 출력:
[
  {"key":"캐릭터 KEY","message":"채팅 메시지"},
  ...
]
`.trim();

  let generated;
  try {
    generated = await generateGemini(prompt, 3200);
  } catch (error) {
    await db
      .from("ai_conversation_threads")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", threadId);
    throw error;
  }

  const queued = await queueGenerated(db, threadId, selected, generated, "autonomous", topic.category);

  if (queued > 0) {
    await db.from("ai_topic_history").insert({
      topic_id: topic.id,
      thread_id: threadId,
      used_at: now.toISOString(),
    });

    const { data: lastQueue } = await db
      .from("ai_reply_queue")
      .select("scheduled_at")
      .eq("thread_id", threadId)
      .eq("status", "queued")
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const base = lastQueue?.scheduled_at ? new Date(lastQueue.scheduled_at) : now;
    const gapMinutes = randInt(
      Number(settings.autonomous_gap_min_minutes || 12),
      Number(settings.autonomous_gap_max_minutes || 25)
    );
    await db
      .from("ai_community_state")
      .update({
        next_autonomous_at: new Date(base.getTime() + gapMinutes * 60 * 1000).toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", 1);
  }

  return queued;
}

export async function runAiCommunityTick({ source = "cron", bypassMinuteClaim = false } = {}) {
  const db = dbClient();
  if (!db) return { success: false, reason: "supabase_server_env_missing" };

  try {
    const settings = await loadSettings(db);
    if (!settings.enabled) return { success: true, reason: "community_disabled" };

    const now = new Date();
    const kst = kstParts(now);

    if (!isInsideWindow(kst.minutes, settings.activity_start, settings.activity_end)) {
      if (kst.minutes >= timeToMinutes(settings.activity_end || "18:30")) {
        await db
          .from("ai_reply_queue")
          .update({ status: "cancelled" })
          .eq("status", "queued");
        await db
          .from("ai_conversation_threads")
          .update({ status: "cancelled", completed_at: now.toISOString() })
          .eq("status", "active");
      }
      return { success: true, reason: "outside_activity_time" };
    }

    if (!bypassMinuteClaim) {
      const tickKey = `${kst.dateKey}-${String(kst.hour).padStart(2, "0")}:${String(kst.minute).padStart(2, "0")}`;
      const { data: claimed, error: claimError } = await db.rpc("claim_ai_community_tick", {
        target_tick_key: tickKey,
      });
      if (claimError) {
        console.error("AI community claim error:", claimError);
      } else if (!claimed) {
        return { success: true, reason: "already_ran_this_minute" };
      }
    }

    const characters = await loadCharacters(db, now);
    if (!characters.length) {
      return { success: true, reason: "ai_accounts_not_ready" };
    }

    // 최우선: 실제회원의 새 메시지. 기존 AI 자발대화/일반대화 예약보다 먼저 처리합니다.
    const humanInfo = await findLatestUnhandledHuman(db);
    if (humanInfo) {
      await cancelInterruptibleQueues(db);
      await publishDueReply(db, now); // 축하/손실처럼 취소하지 않은 특별 큐가 있으면 1건만
      const result = await scheduleHumanReplies(db, humanInfo, characters, settings);
      return { success: true, action: "human_reply", source, ...result };
    }

    // 매분 예약된 메시지는 최대 1개만 게시해 1~3분 간격을 유지합니다.
    const published = await publishDueReply(db, now);
    if (published) {
      return { success: true, action: "publish_queue", source };
    }

    // 두 번째 우선순위: 신규 실제회원 환영
    const { data: welcomeEvent } = await db
      .from("ai_community_events")
      .select("*")
      .eq("event_type", "member_join")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (welcomeEvent) {
      const queued = await scheduleWelcome(db, welcomeEvent, characters, settings);
      return { success: true, action: "welcome", queued, source };
    }

    // 마지막 우선순위: 사람이 조용할 때만 AI끼리 자발 일상대화
    const queued = await scheduleAutonomous(db, characters, settings, now);
    return {
      success: true,
      action: queued ? "autonomous" : "idle",
      queued,
      source,
    };
  } catch (error) {
    console.error("AI COMMUNITY ERROR:", error);
    return {
      success: false,
      error: error?.message || "AI 커뮤니티 엔진 오류",
    };
  }
}

export async function getAiCommunityStatus() {
  const db = dbClient();
  if (!db) return { success: false, reason: "supabase_server_env_missing" };

  const [{ data: state }, { data: settings }, { count: aiCount }, { count: queuedCount }] = await Promise.all([
    db.from("ai_community_state").select("*").eq("id", 1).maybeSingle(),
    db.from("ai_community_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("account_type", "ai_character").eq("approval_status", "approved"),
    db.from("ai_reply_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
  ]);

  return {
    success: true,
    state: state || null,
    settings: settings || null,
    aiAccountCount: aiCount || 0,
    queuedCount: queuedCount || 0,
  };
}
