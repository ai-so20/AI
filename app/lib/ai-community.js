import { createClient } from "@supabase/supabase-js";

export const AI_ROOM_ID = "0a495a02-bcb8-4e38-b3ef-4e7059c2a883";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function randInt(min, max) {
  const low = Math.ceil(Number(min || 0));
  const high = Math.floor(Number(max || low));
  if (high <= low) return low;
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value ?? min)));
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
  return JSON.parse(cleaned || "{}");
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
  if (startMinutes <= endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function pairIds(a, b) {
  if (!a || !b || a === b) return null;
  return String(a) < String(b) ? [a, b] : [b, a];
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

function weightedSample(items, count, weightFn) {
  const pool = [...items];
  const picked = [];
  while (pool.length && picked.length < count) {
    const weights = pool.map((item) => Math.max(0.1, Number(weightFn(item)) || 0.1));
    const total = weights.reduce((sum, v) => sum + v, 0);
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

async function generateGemini(prompt, maxOutputTokens = 2200) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
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
  const rawText = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  return safeJson(rawText || "{}");
}

async function loadSettings(db) {
  const { data } = await db.from("ai_community_settings").select("*").eq("id", 1).maybeSingle();
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
    autonomous_gap_min_minutes: 5,
    autonomous_gap_max_minutes: 11,
    human_quiet_minutes: 4,
    autonomous_max_active_threads: 3,
    recent_context_messages: 36,
    memory_recall_limit: 8,
    relationship_event_limit: 5,
    autonomous_thread_min_turns: 4,
    autonomous_thread_max_turns: 12,
    new_parallel_topic_chance: 32,
  };
}

async function loadCharacters(db, now = new Date()) {
  const { data: rows, error } = await db.from("ai_character_profiles").select("*").eq("is_active", true);
  if (error || !rows?.length) return [];
  const ids = rows.map((row) => row.member_id);
  const [{ data: profiles }, { data: states }] = await Promise.all([
    db.from("profiles").select("id,nickname,avatar,approval_status,account_type,ai_chat_enabled").in("id", ids),
    db.from("ai_character_state").select("*").in("member_id", ids),
  ]);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  const stateMap = new Map((states || []).map((s) => [s.member_id, s]));
  const parts = kstParts(now);
  return rows.map((character) => ({
    ...character,
    profile: profileMap.get(character.member_id),
    state: stateMap.get(character.member_id) || null,
  })).filter((character) => {
    const p = character.profile;
    if (!p || p.approval_status !== "approved" || p.account_type !== "ai_character" || !p.ai_chat_enabled) return false;
    return isInsideWindow(parts.minutes, character.activity_start, character.activity_end);
  });
}

function availableNow(character, now = new Date()) {
  const next = character?.state?.next_available_at;
  return !next || new Date(next).getTime() <= now.getTime();
}

function characterPromptBlock(character) {
  const p = character.profile || {};
  return [
    `KEY=${character.character_key}`,
    `닉네임=${p.nickname || character.character_name}`,
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
[공통 대화 규칙]
- 캐릭터는 자신의 이름, 나이, 직업, 취향, 과거와 일상을 자기 삶의 연속된 서사처럼 유지한다.
- 이전에 실제로 저장된 기억과 관계를 우선한다. 기억에 없는 과거 사건을 '전에 말했잖아요'처럼 지어내지 않는다.
- 대화는 한국 커뮤니티/메신저처럼 짧고 자연스럽게 1~2문장이 기본이다.
- 바로 앞 말만 기계적으로 따라가지 말고, 지금 살아있는 대화 가지 중 어떤 말에 답하는지 분명히 정한다.
- 같은 주제 안에서도 A의 첫 말에 뒤늦게 답하거나, B의 답변에 다시 답할 수 있다.
- 다른 주제가 동시에 살아있어도 괜찮다. 단, 답변 한 개 안에서 서로 다른 주제를 마구 섞지 않는다.
- 질문, 대답, 공감, 자기 경험, 가벼운 반대, 농담, 주제 확장, 자연스러운 마무리를 상황에 맞게 섞는다.
- '맞아요', '그러게요', '저도요'만 단독으로 쓰는 빈 맞장구는 피한다. 구체적인 내용을 하나 더 보탠다.
- 모든 캐릭터가 같은 말투나 ㅋㅋ/ㅎㅎ를 쓰지 않는다.
- 실제회원 메시지가 있으면 그 흐름을 AI끼리의 잡담보다 우선한다.
- 민감정보(전화번호, 계좌, 주소, 비밀번호, 인증번호 등)는 장기기억으로 저장하지 않는다.
- 실제 투자 결과나 수익을 보장하거나 확정적으로 약속하지 않는다.
`.trim();

async function recentChatContext(db, limit = 40) {
  const { data: messages } = await db
    .from("group_messages")
    .select("id,member_id,content,created_at,ai_thread_id,reply_to_message_id,conversation_act,topic_id")
    .eq("room_id", AI_ROOM_ID)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = messages || [];
  const memberIds = [...new Set(rows.map((r) => r.member_id).filter(Boolean))];
  const { data: profiles } = memberIds.length
    ? await db.from("profiles").select("id,nickname,account_type").in("id", memberIds)
    : { data: [] };
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  const ordered = [...rows].reverse();
  const text = ordered.map((row) => {
    const p = profileMap.get(row.member_id);
    const tag = p?.account_type === "human" ? "실제회원" : p?.account_type === "ai_character" ? "캐릭터" : "회원";
    const reply = row.reply_to_message_id ? ` reply_to=${row.reply_to_message_id}` : "";
    const thread = row.ai_thread_id ? ` thread=${row.ai_thread_id}` : "";
    return `[${row.id}${thread}${reply}] ${p?.nickname || "회원"}(${tag}): ${String(row.content || "").slice(0, 500)}`;
  }).join("\n");
  return { rows, profileMap, text };
}

async function findLatestUnhandledHuman(db) {
  const { rows, profileMap } = await recentChatContext(db, 100);
  const humanRows = rows.filter((r) => r.member_id && profileMap.get(r.member_id)?.account_type === "human");
  if (!humanRows.length) return null;
  const ids = humanRows.map((r) => r.id);
  const { data: receipts } = await db.from("ai_human_message_receipts").select("message_id").in("message_id", ids);
  const handled = new Set((receipts || []).map((r) => r.message_id));
  const unhandled = humanRows.filter((r) => !handled.has(r.id));
  if (!unhandled.length) return null;
  const latest = unhandled[0];
  return { latest, latestProfile: profileMap.get(latest.member_id), unhandled };
}

async function markHumanHandled(db, rows) {
  const payload = (rows || []).map((r) => ({ message_id: r.id, handled_at: new Date().toISOString() }));
  if (payload.length) await db.from("ai_human_message_receipts").upsert(payload, { onConflict: "message_id" });
}

async function postponeAutonomousTurns(db, now = new Date()) {
  const { data: threads } = await db.from("ai_conversation_threads")
    .select("id").eq("thread_type", "autonomous").eq("status", "active");
  const threadIds = (threads || []).map((t) => t.id);
  if (!threadIds.length) return;
  const { data: rows } = await db.from("ai_turn_queue")
    .select("id,thread_id,scheduled_at").eq("status", "queued").in("thread_id", threadIds);
  for (const row of rows || []) {
    const current = new Date(row.scheduled_at).getTime();
    const delayed = now.getTime() + randInt(4, 7) * 60 * 1000;
    if (current < delayed) {
      await db.from("ai_turn_queue").update({ scheduled_at: new Date(delayed).toISOString() }).eq("id", row.id);
    }
  }
}

async function insertThread(db, values) {
  const { data, error } = await db.from("ai_conversation_threads").insert({
    last_activity_at: new Date().toISOString(),
    ...values,
  }).select("*").single();
  if (error) throw error;
  return data;
}

async function addParticipants(db, threadId, characters) {
  const rows = characters.map((c) => ({ thread_id: threadId, member_id: c.member_id }));
  if (rows.length) await db.from("ai_thread_participants").upsert(rows, { onConflict: "thread_id,member_id" });
}

async function loadThread(db, threadId) {
  const { data } = await db.from("ai_conversation_threads").select("*").eq("id", threadId).maybeSingle();
  return data || null;
}

async function loadThreadParticipants(db, threadId, characters) {
  const { data } = await db.from("ai_thread_participants").select("member_id,turns,last_spoke_at").eq("thread_id", threadId);
  const map = new Map(characters.map((c) => [c.member_id, c]));
  return (data || []).map((row) => ({ ...row, character: map.get(row.member_id) })).filter((row) => row.character);
}

async function queueTurn(db, threadId, {
  delaySeconds = null,
  preferredMemberId = null,
  targetMessageId = null,
  turnKind = "continue",
  priority = 10,
  now = new Date(),
} = {}) {
  const seconds = delaySeconds ?? randInt(60, 180);
  const scheduledAt = new Date(now.getTime() + seconds * 1000);
  const parts = kstParts(scheduledAt);
  if (parts.minutes >= timeToMinutes("18:30")) return null;
  const payload = {
    thread_id: threadId,
    preferred_member_id: preferredMemberId,
    target_message_id: targetMessageId,
    turn_kind: turnKind,
    scheduled_at: scheduledAt.toISOString(),
    priority,
    status: "queued",
  };
  const { data: existing } = await db.from("ai_turn_queue")
    .select("id").eq("thread_id", threadId).in("status", ["queued", "processing"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing?.id) {
    const { data, error } = await db.from("ai_turn_queue").update(payload).eq("id", existing.id).select("*").single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await db.from("ai_turn_queue").insert(payload).select("*").single();
  if (!error) return data;
  if (error.code === "23505") {
    const { data: raced } = await db.from("ai_turn_queue")
      .select("*").eq("thread_id", threadId).in("status", ["queued", "processing"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return raced || null;
  }
  throw error;
}

async function getDueTurn(db) {
  const { data, error } = await db.rpc("claim_due_ai_turn");
  if (error) throw error;
  return Array.isArray(data) ? (data[0] || null) : (data || null);
}

async function hasRecentHuman(db, quietMinutes, now = new Date()) {
  const context = await recentChatContext(db, 80);
  const row = context.rows.find((r) => r.member_id && context.profileMap.get(r.member_id)?.account_type === "human");
  if (!row) return false;
  return now.getTime() - new Date(row.created_at).getTime() < Number(quietMinutes || 4) * 60 * 1000;
}

async function loadRelationship(db, a, b) {
  const pair = pairIds(a, b);
  if (!pair) return null;
  const { data } = await db.from("ai_relationships").select("*").eq("member_low", pair[0]).eq("member_high", pair[1]).maybeSingle();
  return data || null;
}

async function loadRelationshipEvents(db, a, b, limit = 5) {
  const pair = pairIds(a, b);
  if (!pair) return [];
  const { data } = await db.from("ai_relationship_events").select("event_note,created_at")
    .eq("member_low", pair[0]).eq("member_high", pair[1])
    .order("created_at", { ascending: false }).limit(limit);
  return data || [];
}

async function loadMemories(db, ownerId, subjectId, limit = 8) {
  const rows = [];
  if (ownerId) {
    let q = db.from("ai_social_memories").select("*").eq("owner_member_id", ownerId);
    if (subjectId) q = q.or(`subject_member_id.eq.${subjectId},subject_member_id.is.null`);
    const { data } = await q.order("importance", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    rows.push(...(data || []));
  }
  const { data: community } = await db.from("ai_social_memories").select("*").eq("scope", "community")
    .order("importance", { ascending: false }).order("created_at", { ascending: false }).limit(Math.max(2, Math.floor(limit / 2)));
  rows.push(...(community || []));
  return rows.slice(0, limit + 3);
}

function memoryPrompt(rows) {
  if (!rows?.length) return "저장된 관련 기억 없음";
  return rows.map((m) => `- [${m.scope}] ${m.fact}${m.event_at ? ` (시점:${m.event_at})` : ""}`).join("\n");
}

function relationshipPrompt(rel, events) {
  if (!rel) return "아직 뚜렷한 관계 기록 없음";
  const notes = (events || []).map((e) => e.event_note).join(" / ");
  return `친숙함 ${Math.round(rel.familiarity)}, 호감 ${Math.round(rel.affinity)}, 편안함 ${Math.round(rel.comfort)}, 장난친밀도 ${Math.round(rel.playfulness)}, 신뢰 ${Math.round(rel.trust)}, 대화횟수 ${rel.interaction_count}. 최근 관계기억: ${notes || "없음"}`;
}

function topicInterestWeight(character, topic) {
  const interests = character.interests || [];
  let weight = Math.max(2, Number(character.general_reply_rate || 10));
  if (topic?.category && interests.includes(topic.category)) weight *= 2.3;
  if (topic?.title && interests.some((interest) => String(topic.title).includes(interest))) weight *= 1.5;
  const energy = Number(character?.state?.social_energy ?? 55);
  const drive = Number(character?.state?.talk_drive ?? 50);
  weight *= 0.65 + energy / 140 + drive / 180;
  return weight;
}

async function pickTopic(db, now = new Date()) {
  const { data: topics } = await db.from("ai_chat_topics").select("*").eq("is_active", true);
  if (!topics?.length) return null;
  const { data: history } = await db.from("ai_topic_history").select("topic_id,used_at")
    .gte("used_at", new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString())
    .order("used_at", { ascending: false });
  const latest = new Map();
  (history || []).forEach((h) => { if (!latest.has(h.topic_id)) latest.set(h.topic_id, h.used_at); });
  const eligible = topics.filter((topic) => {
    const last = latest.get(topic.id);
    if (!last) return true;
    return now.getTime() - new Date(last).getTime() >= Number(topic.cooldown_hours || 48) * 3600000;
  });
  const pool = eligible.length ? eligible : [...topics].sort((a, b) => {
    const at = latest.get(a.id) ? new Date(latest.get(a.id)).getTime() : 0;
    const bt = latest.get(b.id) ? new Date(latest.get(b.id)).getTime() : 0;
    return at - bt;
  }).slice(0, 12);
  const hour = kstParts(now).hour;
  return weightedSample(pool, 1, (topic) => {
    let weight = 10;
    if (hour >= 11 && hour < 13 && ["음식", "간식"].includes(topic.category)) weight += 2;
    if (hour >= 13 && hour < 16 && ["카페", "간식", "휴식"].includes(topic.category)) weight += 1;
    if (hour >= 16 && ["일상", "주말", "취향", "여행"].includes(topic.category)) weight += 1;
    return weight;
  })[0] || null;
}

async function saveRelationship(db, speakerId, targetId, threadId, messageId, act, note) {
  const pair = pairIds(speakerId, targetId);
  if (!pair) return;
  const current = await loadRelationship(db, speakerId, targetId);
  const next = {
    member_low: pair[0],
    member_high: pair[1],
    familiarity: clamp(Number(current?.familiarity || 0) + 0.8, 0, 100),
    affinity: clamp(Number(current?.affinity ?? 50) + (act === "support" ? 0.35 : 0.08), 0, 100),
    comfort: clamp(Number(current?.comfort || 20) + 0.35, 0, 100),
    playfulness: clamp(Number(current?.playfulness || 10) + (act === "joke" ? 0.8 : 0.04), 0, 100),
    trust: clamp(Number(current?.trust || 20) + (act === "support" || act === "remember" ? 0.25 : 0.05), 0, 100),
    interaction_count: Number(current?.interaction_count || 0) + 1,
    shared_interests: current?.shared_interests || [],
    summary: current?.summary || null,
    last_interaction_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await db.from("ai_relationships").upsert(next, { onConflict: "member_low,member_high" });
  if (note && String(note).trim().length >= 3) {
    await db.from("ai_relationship_events").insert({
      member_low: pair[0], member_high: pair[1], thread_id: threadId,
      source_message_id: messageId, event_note: String(note).slice(0, 500),
    });
  }
}

function containsSensitiveFact(text) {
  const value = String(text || "").toLowerCase();
  const words = ["비밀번호", "패스워드", "인증번호", "계좌번호", "주민번호", "주민등록", "전화번호", "휴대폰번호", "주소", "otp", "카드번호"];
  return words.some((word) => value.includes(word)) || /\b\d{3}[- ]?\d{3,4}[- ]?\d{4}\b/.test(value);
}

async function saveMemoryUpdates(db, updates, { speakerId, sourceHumanId, messageId, threadId }) {
  const payload = [];
  for (const raw of Array.isArray(updates) ? updates : []) {
    const fact = String(raw?.fact || "").trim();
    if (fact.length < 4 || fact.length > 500 || containsSensitiveFact(fact)) continue;
    const scope = ["personal", "person", "relationship", "community", "future"].includes(raw?.scope) ? raw.scope : "personal";
    let owner = speakerId;
    let subject = null;
    if (raw?.subject === "source_human" && sourceHumanId) subject = sourceHumanId;
    if (scope === "community") { owner = null; subject = null; }
    if (scope === "personal" || scope === "future") subject = null;
    if ((scope === "person" || scope === "relationship") && !subject) subject = sourceHumanId || null;
    payload.push({
      owner_member_id: owner,
      subject_member_id: subject,
      scope,
      fact,
      importance: clamp(raw?.importance ?? 50, 1, 100),
      confidence: clamp(raw?.confidence ?? 100, 1, 100),
      event_at: raw?.event_at || null,
      valid_until: raw?.valid_until || null,
      source_message_id: messageId,
      thread_id: threadId,
    });
  }
  if (payload.length) {
    const { error } = await db.from("ai_social_memories").upsert(payload, { onConflict: "memory_key", ignoreDuplicates: true });
    if (error && error.code !== "23505") console.error("memory save error:", error);
  }
}

async function propagateObservedMemories(db, updates, { speakerId, sourceHumanId, messageId, threadId }) {
  const { data: participants } = await db.from("ai_thread_participants").select("member_id").eq("thread_id", threadId);
  const observerIds = (participants || []).map((p) => p.member_id).filter((id) => id && id !== speakerId);
  if (!observerIds.length) return;
  const payload = [];
  for (const raw of Array.isArray(updates) ? updates : []) {
    const fact = String(raw?.fact || "").trim();
    if (fact.length < 4 || fact.length > 500 || containsSensitiveFact(fact)) continue;
    let subjectId = null;
    if ((raw?.scope === "personal" || raw?.scope === "future") && speakerId) subjectId = speakerId;
    if (raw?.subject === "source_human" && sourceHumanId) subjectId = sourceHumanId;
    if (!subjectId) continue;
    for (const observerId of observerIds) {
      if (observerId === subjectId) continue;
      payload.push({
        owner_member_id: observerId,
        subject_member_id: subjectId,
        scope: "person",
        fact,
        importance: clamp(Math.round(Number(raw?.importance ?? 50) * 0.85), 1, 100),
        confidence: clamp(raw?.confidence ?? 100, 1, 100),
        event_at: raw?.event_at || null,
        valid_until: raw?.valid_until || null,
        source_message_id: messageId,
        thread_id: threadId,
      });
    }
  }
  if (payload.length) {
    const { error } = await db.from("ai_social_memories").upsert(payload, { onConflict: "memory_key", ignoreDuplicates: true });
    if (error && error.code !== "23505") console.error("observed memory propagation error:", error);
  }
}

async function updateCharacterState(db, character, now, topicCategory = null) {
  const rest = randInt(character.rest_min_minutes || 15, character.rest_max_minutes || 45);
  const currentCount = Number(character?.state?.messages_today || 0);
  const today = kstParts(now).dateKey;
  const sameDay = character?.state?.state_date === today;
  const energy = clamp(Number(character?.state?.social_energy ?? 55) - randInt(3, 9), 10, 100);
  const drive = clamp(Number(character?.state?.talk_drive ?? 50) - randInt(2, 7), 5, 100);
  await db.from("ai_character_state").upsert({
    member_id: character.member_id,
    next_available_at: new Date(now.getTime() + rest * 60000).toISOString(),
    last_spoke_at: now.toISOString(),
    messages_today: (sameDay ? currentCount : 0) + 1,
    state_date: today,
    last_topic_category: topicCategory,
    social_energy: energy,
    talk_drive: drive,
    updated_at: now.toISOString(),
  }, { onConflict: "member_id" });
}

async function refreshIdleEnergy(db, characters, now = new Date()) {
  const updates = [];
  for (const c of characters) {
    const last = c?.state?.last_spoke_at ? new Date(c.state.last_spoke_at).getTime() : 0;
    const idleMinutes = last ? (now.getTime() - last) / 60000 : 60;
    if (idleMinutes < 15) continue;
    const energy = clamp(Number(c?.state?.social_energy ?? 55) + Math.min(8, Math.floor(idleMinutes / 30)), 10, 100);
    const drive = clamp(Number(c?.state?.talk_drive ?? 50) + Math.min(10, Math.floor(idleMinutes / 25)), 5, 100);
    updates.push({ member_id: c.member_id, social_energy: energy, talk_drive: drive, updated_at: now.toISOString() });
  }
  if (updates.length) await db.from("ai_character_state").upsert(updates, { onConflict: "member_id" });
}

async function chooseSpeaker(db, thread, participants, characters, context) {
  const participantRows = participants.length ? participants : characters.map((c) => ({ member_id: c.member_id, turns: 0, character: c }));
  const lastMessage = thread.last_message_id ? context.rows.find((r) => r.id === thread.last_message_id) : null;
  const lastText = String(lastMessage?.content || "");

  // 닉네임을 직접 부르면 그 캐릭터를 우선
  const mentioned = participantRows.find(({ character }) => {
    const nickname = character?.profile?.nickname;
    return nickname && lastText.includes(nickname);
  });
  if (mentioned?.character && availableNow(mentioned.character)) return mentioned.character;

  const available = participantRows.filter((p) => availableNow(p.character));
  if (!available.length) return null;
  const pool = available;
  const topic = thread.topic_id ? { id: thread.topic_id } : null;

  const picked = weightedSample(pool, 1, (p) => {
    const c = p.character;
    let weight = topicInterestWeight(c, topic);
    if (thread.last_speaker_id && c.member_id === thread.last_speaker_id) weight *= 0.15;
    if (Number(p.turns || 0) === 0) weight *= 1.8;
    return weight;
  });
  return picked[0]?.character || null;
}

async function generateTurn(db, thread, speaker, settings, context, targetMessageId = null) {
  const sourceHumanId = thread.source_member_id || null;
  const target = targetMessageId
    ? context.rows.find((r) => r.id === targetMessageId)
    : thread.last_message_id
      ? context.rows.find((r) => r.id === thread.last_message_id)
      : null;
  const targetSpeakerId = target?.member_id || sourceHumanId || null;
  const [memories, relationship, relationshipEvents] = await Promise.all([
    loadMemories(db, speaker.member_id, targetSpeakerId, Number(settings.memory_recall_limit || 8)),
    targetSpeakerId ? loadRelationship(db, speaker.member_id, targetSpeakerId) : Promise.resolve(null),
    targetSpeakerId ? loadRelationshipEvents(db, speaker.member_id, targetSpeakerId, Number(settings.relationship_event_limit || 5)) : Promise.resolve([]),
  ]);

  const { data: topic } = thread.topic_id
    ? await db.from("ai_chat_topics").select("*").eq("id", thread.topic_id).maybeSingle()
    : { data: null };

  const threadMessages = context.rows.filter((r) => r.ai_thread_id === thread.id).slice(0, 14);
  const threadGuidance = thread.thread_type === "welcome"
    ? "새로 들어온 실제회원에게 반갑게 인사하고, 환영문구만 반복하지 말고 편하게 어울릴 수 있는 한마디를 이어간다."
    : thread.thread_type === "celebration"
      ? "실제회원의 기쁜 소식에 반응한다. 축하만 복사하지 말고 앞사람의 말과 상황을 받아 기쁜 분위기를 이어간다."
      : thread.thread_type === "loss"
        ? "실제회원의 속상한 상황에 가볍게 비웃지 말고 공감/안정/짧은 경험으로 자연스럽게 반응한다."
        : thread.thread_type === "human_reply"
          ? "실제회원의 대화가 중심이다. 캐릭터끼리 자기 이야기만 하지 말고 회원의 말에서 나온 구체적인 내용에 연결한다."
          : "사람들이 쉬는 커뮤니티에서 자연스럽게 이어지는 사적인 일상대화다.";
  const candidateTargets = threadMessages.slice(0, 8).map((r) => {
    const p = context.profileMap.get(r.member_id);
    return `[${r.id}] ${p?.nickname || "회원"}: ${String(r.content || "").slice(0, 300)}`;
  }).join("\n");

  const prompt = `
너는 VIP 그룹채팅 안에서 '${speaker.profile?.nickname || speaker.character_name}' 한 사람의 '다음 메시지 1개'만 만든다.
미리 뒤의 대사를 만들지 않는다. 지금까지 실제로 올라온 채팅만 보고 지금 이 순간 자연스럽게 한 번 말한다.

${COMMON_PROMPT}

[현재 캐릭터]
${characterPromptBlock(speaker)}

[현재 대화 가지]
종류=${thread.thread_type}
이 대화의 목적=${threadGuidance}
턴=${thread.turn_count}/${thread.min_turns}~${thread.max_turns}
대화 에너지=${thread.energy}
열린 질문=${thread.open_question}
요약=${thread.summary || "아직 없음"}
${topic ? `주제=${topic.category} / ${topic.title} / ${topic.prompt_seed}` : "주제=실제회원 대화에서 자연스럽게 결정"}

[이 캐릭터가 기억하는 관련 사실]
${memoryPrompt(memories)}

[상대와의 관계]
${relationshipPrompt(relationship, relationshipEvents)}

[최근 전체 채팅]
${context.text || "최근 대화 없음"}

[이 대화 가지에서 답변 대상으로 삼을 수 있는 과거 메시지]
${candidateTargets || "아직 없음"}

[이번 턴 규칙]
- 메시지는 정확히 1개만 쓴다.
- reply_to_message_id는 위 최근 채팅에 실제 존재하는 ID 하나를 고르거나, 새 화제를 여는 첫말이면 null로 둔다.
- 같은 대화 가지의 '바로 전 말'에 답할 수도 있고, 2~5개 전의 다른 사람 말에 뒤늦게 답해도 된다.
- 실제회원의 최근 말이 아직 충분히 반응받지 못했다면 그 말을 우선한다.
- 구체적인 단어/행동/감정 하나를 잡고 이어간다.
- 관계기억이 있으면 억지스럽지 않을 때만 '저번에 ~라고 했던 것 같은데'처럼 활용한다.
- 기억에 없는 과거는 만들어내지 않는다.
- 캐릭터 본인의 사소한 일상 사건을 새로 말할 수 있다. 그런 새 사실은 memory_updates에 함께 기록한다.
- future 약속/예정(내일 치과, 주말 약속 등)을 말하면 scope=future로 저장한다.
- 실제회원에 대한 기억은 실제회원이 명시적으로 말한 사실만 기록한다.
- 대화가 아직 살아있으면 should_continue=true. 같은 말 반복, 에너지 저하, 자연스러운 마무리라면 false.
- 최소턴(${thread.min_turns}) 전에는 웬만하면 계속하고, 최대턴(${thread.max_turns})에 도달하면 반드시 false.
- conversation_act는 answer, question, agree, disagree, experience, joke, support, remember, bridge, close 중 하나.
- relationship_note는 이번 대화로 둘 사이에 남길 만한 작은 관계 기록이 있을 때만 한 문장. 없으면 빈 문자열.

JSON 객체만 출력:
{
  "message":"실제 채팅 메시지",
  "reply_to_message_id":"UUID 또는 null",
  "conversation_act":"experience",
  "should_continue":true,
  "open_question":false,
  "thread_energy":0.72,
  "thread_summary":"지금까지 이 대화 가지를 1~2문장으로 요약",
  "next_delay_seconds":95,
  "relationship_note":"",
  "memory_updates":[
    {"scope":"personal|person|relationship|community|future","subject":"speaker|source_human|null","fact":"기억할 사실","importance":50,"confidence":100,"event_at":null,"valid_until":null}
  ]
}
`.trim();

  const result = await generateGemini(prompt, 2600);
  const message = String(result?.message || "").trim().replace(/\s+/g, " ");
  if (message.length < 2) throw new Error("Gemini가 빈 대사를 반환했습니다.");
  const validTargetIds = new Set(threadMessages.map((r) => r.id));
  if (thread.source_message_id) validTargetIds.add(thread.source_message_id);
  if (thread.last_message_id) validTargetIds.add(thread.last_message_id);
  const replyTo = result?.reply_to_message_id && validTargetIds.has(result.reply_to_message_id)
    ? result.reply_to_message_id
    : target?.id || null;
  return {
    message: message.slice(0, 1000),
    replyTo,
    act: ["answer","question","agree","disagree","experience","joke","support","remember","bridge","close"].includes(result?.conversation_act)
      ? result.conversation_act : "experience",
    shouldContinue: Boolean(result?.should_continue),
    openQuestion: Boolean(result?.open_question),
    energy: clamp(result?.thread_energy ?? thread.energy ?? 0.7, 0, 1),
    summary: String(result?.thread_summary || thread.summary || "").slice(0, 1000) || null,
    nextDelaySeconds: clamp(result?.next_delay_seconds ?? randInt(60, 180), 45, 240),
    relationshipNote: String(result?.relationship_note || "").slice(0, 500),
    memoryUpdates: Array.isArray(result?.memory_updates) ? result.memory_updates : [],
  };
}

async function publishGeneratedTurn(db, thread, speaker, generated, settings, now = new Date(), { scheduleNext = true } = {}) {
  const { data: inserted, error } = await db.from("group_messages").insert({
    room_id: AI_ROOM_ID,
    member_id: speaker.member_id,
    message_type: "text",
    content: generated.message,
    is_deleted: false,
    ai_thread_id: thread.id,
    reply_to_message_id: generated.replyTo,
    conversation_act: generated.act,
    topic_id: thread.topic_id || null,
  }).select("id,created_at").single();
  if (error) throw error;

  const context = await recentChatContext(db, Number(settings.recent_context_messages || 36));
  const target = generated.replyTo ? context.rows.find((r) => r.id === generated.replyTo) : null;
  const targetSpeakerId = target?.member_id || thread.source_member_id || null;

  const { data: participantState } = await db.from("ai_thread_participants")
    .select("turns").eq("thread_id", thread.id).eq("member_id", speaker.member_id).maybeSingle();
  await Promise.all([
    db.from("ai_thread_participants").upsert({
      thread_id: thread.id,
      member_id: speaker.member_id,
      turns: Number(participantState?.turns || 0) + 1,
      last_spoke_at: now.toISOString(),
    }, { onConflict: "thread_id,member_id" }),
    updateCharacterState(db, speaker, now, null),
  ]);

  if (targetSpeakerId && targetSpeakerId !== speaker.member_id) {
    await saveRelationship(db, speaker.member_id, targetSpeakerId, thread.id, inserted.id, generated.act, generated.relationshipNote);
  }
  await saveMemoryUpdates(db, generated.memoryUpdates, {
    speakerId: speaker.member_id,
    sourceHumanId: thread.source_member_id,
    messageId: inserted.id,
    threadId: thread.id,
  });
  await propagateObservedMemories(db, generated.memoryUpdates, {
    speakerId: speaker.member_id,
    sourceHumanId: thread.source_member_id,
    messageId: inserted.id,
    threadId: thread.id,
  });

  const nextTurnCount = Number(thread.turn_count || 0) + 1;
  const mustContinue = nextTurnCount < Number(thread.min_turns || 3);
  const mustStop = nextTurnCount >= Number(thread.max_turns || 10);
  const continueThread = !mustStop && (mustContinue || generated.shouldContinue || generated.openQuestion) && generated.energy >= 0.2;

  await db.from("ai_conversation_threads").update({
    last_message_id: inserted.id,
    last_speaker_id: speaker.member_id,
    last_activity_at: now.toISOString(),
    turn_count: nextTurnCount,
    energy: generated.energy,
    open_question: generated.openQuestion,
    summary: generated.summary,
    status: continueThread ? "active" : "completed",
    completed_at: continueThread ? null : now.toISOString(),
  }).eq("id", thread.id);

  if (continueThread && scheduleNext) {
    const kind = thread.thread_type === "autonomous" ? "continue" : thread.thread_type;
    const priority = thread.thread_type === "autonomous" ? 10 : 70;
    await queueTurn(db, thread.id, {
      delaySeconds: generated.nextDelaySeconds,
      targetMessageId: inserted.id,
      turnKind: ["human_reply","welcome","celebration","loss"].includes(kind) ? kind : "continue",
      priority,
      now,
    });
  }
  return { inserted, continueThread, nextDelaySeconds: generated.nextDelaySeconds };
}

async function processTurn(db, turn, characters, settings, now = new Date()) {
  const thread = await loadThread(db, turn.thread_id);
  if (!thread || thread.status !== "active") {
    await db.from("ai_turn_queue").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", turn.id);
    return { action: "turn_cancelled" };
  }

  if (thread.thread_type === "autonomous" && await hasRecentHuman(db, settings.human_quiet_minutes, now)) {
    await db.from("ai_turn_queue").update({
      status: "queued",
      scheduled_at: new Date(now.getTime() + randInt(3, 6) * 60000).toISOString(),
    }).eq("id", turn.id);
    return { action: "autonomous_postponed_for_human" };
  }

  const context = await recentChatContext(db, Number(settings.recent_context_messages || 36));
  const participants = await loadThreadParticipants(db, thread.id, characters);
  let speaker = turn.preferred_member_id
    ? characters.find((c) => c.member_id === turn.preferred_member_id)
    : null;
  if (!speaker || !availableNow(speaker, now)) speaker = await chooseSpeaker(db, thread, participants, characters, context);
  if (!speaker) {
    const nextTimes = participants
      .map((p) => p.character?.state?.next_available_at)
      .filter(Boolean)
      .map((v) => new Date(v).getTime())
      .filter((v) => Number.isFinite(v) && v > now.getTime());
    const resumeAt = nextTimes.length
      ? new Date(Math.min(...nextTimes))
      : new Date(now.getTime() + randInt(3, 6) * 60000);
    await db.from("ai_turn_queue").update({
      status: "queued", scheduled_at: resumeAt.toISOString(),
    }).eq("id", turn.id);
    return { action: "thread_resting" };
  }

  try {
    const generated = await generateTurn(db, thread, speaker, settings, context, turn.target_message_id);
    const published = await publishGeneratedTurn(db, thread, speaker, generated, settings, now, { scheduleNext: false });
    await db.from("ai_turn_queue").update({ status: "done", processed_at: now.toISOString() }).eq("id", turn.id);
    if (published.continueThread) {
      const kind = thread.thread_type === "autonomous" ? "continue" : thread.thread_type;
      const priority = thread.thread_type === "autonomous" ? 10 : 70;
      await queueTurn(db, thread.id, {
        delaySeconds: published.nextDelaySeconds,
        targetMessageId: published.inserted.id,
        turnKind: ["human_reply","welcome","celebration","loss"].includes(kind) ? kind : "continue",
        priority,
        now,
      });
    }
    return { action: "turn_published", speaker: speaker.profile?.nickname || speaker.character_name, threadId: thread.id };
  } catch (error) {
    console.error("V17.4 generate turn error:", error);
    await db.from("ai_turn_queue").update({
      status: "queued",
      scheduled_at: new Date(now.getTime() + randInt(3, 6) * 60000).toISOString(),
    }).eq("id", turn.id);
    return { action: "turn_retry_scheduled", error: error?.message || "generation_failed" };
  }
}

async function selectHumanResponders(characters, situation, count, now = new Date()) {
  const available = characters.filter((c) => availableNow(c, now));
  const pool = available.length >= count ? available : characters;
  const field = situation === "loss" ? "loss_reply_rate" : situation === "celebration" ? "celebration_reply_rate" : "general_reply_rate";
  return weightedSample(pool, count, (c) => Number(c[field] || 5) * (0.7 + Number(c?.state?.social_energy ?? 55) / 120));
}

async function startHumanThread(db, info, characters, settings, now = new Date()) {
  const situation = detectSituation(info.latest.content);
  let count;
  if (situation === "celebration") {
    const willing = characters.filter((c) => Math.random() * 100 < Number(c.celebration_reply_rate || 0));
    count = Math.max(Number(settings.celebration_min || 5), willing.length);
    count = Math.min(characters.length, count);
  } else {
    count = randInt(Number(settings.human_reply_min || 3), Number(settings.human_reply_max || 4));
  }
  let selected = await selectHumanResponders(characters, situation, count, now);
  const mentioned = characters.find((c) => {
    const nickname = c?.profile?.nickname;
    return nickname && String(info.latest.content || "").includes(nickname);
  });
  if (mentioned) {
    selected = [mentioned, ...selected.filter((c) => c.member_id !== mentioned.member_id)].slice(0, count);
    if (selected.length < count) {
      const used = new Set(selected.map((c) => c.member_id));
      selected.push(...characters.filter((c) => !used.has(c.member_id)).slice(0, count - selected.length));
    }
  }
  if (!selected.length) return { scheduled: 0, situation };

  await markHumanHandled(db, info.unhandled);
  await postponeAutonomousTurns(db, now);
  const threadType = situation === "celebration" ? "celebration" : situation === "loss" ? "loss" : "human_reply";
  const thread = await insertThread(db, {
    thread_type: threadType,
    source_member_id: info.latest.member_id,
    source_message_id: info.latest.id,
    status: "active",
    last_message_id: info.latest.id,
    last_speaker_id: info.latest.member_id,
    min_turns: selected.length,
    max_turns: selected.length,
    energy: situation === "celebration" ? 0.95 : 0.78,
    open_question: true,
    priority: situation === "celebration" ? 100 : 90,
    title: `실제회원 ${info.latestProfile?.nickname || "회원"} 대화`,
  });
  await addParticipants(db, thread.id, selected);

  // 첫 답은 즉시 생성. 나머지는 미리 문장을 만들지 않고 1~3분 후 최신 문맥으로 생성.
  const firstSpeaker = selected[0];
  const context = await recentChatContext(db, Number(settings.recent_context_messages || 36));
  try {
    const generated = await generateTurn(db, thread, firstSpeaker, settings, context, info.latest.id);
    await publishGeneratedTurn(db, thread, firstSpeaker, generated, settings, now);
  } catch (error) {
    console.error("V17.4 immediate human reply error:", error);
    await queueTurn(db, thread.id, {
      delaySeconds: randInt(60, 120), preferredMemberId: firstSpeaker.member_id,
      targetMessageId: info.latest.id, turnKind: threadType, priority: 90, now,
    });
  }

  await db.from("ai_community_events").update({ status: "done", processed_at: now.toISOString() })
    .eq("event_type", "member_join").eq("member_id", info.latest.member_id).eq("status", "pending");
  return { scheduled: selected.length, situation };
}

async function startWelcomeThread(db, event, characters, settings, now = new Date()) {
  const { data: member } = await db.from("profiles").select("id,nickname,approval_status,account_type").eq("id", event.member_id).maybeSingle();
  if (!member || member.approval_status !== "approved" || member.account_type !== "human") {
    await db.from("ai_community_events").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", event.id);
    return 0;
  }
  const count = randInt(Number(settings.welcome_min || 3), Number(settings.welcome_max || 4));
  const selected = await selectHumanResponders(characters, "general", Math.min(count, characters.length), now);
  if (!selected.length) return 0;
  const thread = await insertThread(db, {
    thread_type: "welcome", source_member_id: member.id, status: "active",
    min_turns: selected.length, max_turns: selected.length, energy: 0.85,
    open_question: true, priority: 80, title: `${member.nickname} 입장 환영`,
  });
  await addParticipants(db, thread.id, selected);
  await queueTurn(db, thread.id, {
    delaySeconds: randInt(10, 35), preferredMemberId: selected[0].member_id,
    turnKind: "welcome", priority: 80, now,
  });
  await db.from("ai_community_events").update({ status: "done", processed_at: now.toISOString() }).eq("id", event.id);
  return selected.length;
}

async function countActiveAutonomousThreads(db) {
  const { count } = await db.from("ai_conversation_threads").select("id", { count: "exact", head: true })
    .eq("thread_type", "autonomous").eq("status", "active");
  return Number(count || 0);
}

async function startAutonomousThread(db, characters, settings, now = new Date()) {
  const kst = kstParts(now);
  if (kst.minutes >= timeToMinutes(settings.autonomous_last_start_cutoff || "18:20")) return 0;
  if (await hasRecentHuman(db, settings.human_quiet_minutes, now)) return 0;
  const activeCount = await countActiveAutonomousThreads(db);
  if (activeCount >= Number(settings.autonomous_max_active_threads || 3)) return 0;

  const { data: state } = await db.from("ai_community_state").select("next_autonomous_at").eq("id", 1).maybeSingle();
  if (state?.next_autonomous_at && new Date(state.next_autonomous_at).getTime() > now.getTime()) return 0;
  if (activeCount > 0 && Math.random() * 100 >= Number(settings.new_parallel_topic_chance || 32)) {
    await db.from("ai_community_state").update({
      next_autonomous_at: new Date(now.getTime() + randInt(2, 5) * 60000).toISOString(), updated_at: now.toISOString(),
    }).eq("id", 1);
    return 0;
  }

  const topic = await pickTopic(db, now);
  if (!topic) return 0;
  const count = Math.min(characters.length, randInt(Number(settings.autonomous_participant_min || 2), Number(settings.autonomous_participant_max || 5)));
  const availableCharacters = characters.filter((c) => availableNow(c, now));
  if (availableCharacters.length < 2) return 0;
  const selected = weightedSample(availableCharacters, Math.min(count, availableCharacters.length), (c) => topicInterestWeight(c, topic));
  if (selected.length < 2) return 0;

  const thread = await insertThread(db, {
    thread_type: "autonomous", topic_id: topic.id, status: "active",
    min_turns: Number(settings.autonomous_thread_min_turns || 4),
    max_turns: Number(settings.autonomous_thread_max_turns || 12),
    energy: 0.78, open_question: false, priority: 10,
    title: `${topic.category} · ${topic.title}`,
  });
  await addParticipants(db, thread.id, selected);
  await db.from("ai_topic_history").insert({ topic_id: topic.id, thread_id: thread.id, used_at: now.toISOString() });

  // 첫 말만 지금 생성, 이후는 매 턴 최신 문맥으로 다시 판단한다.
  const context = await recentChatContext(db, Number(settings.recent_context_messages || 36));
  const speaker = weightedSample(selected, 1, (c) => topicInterestWeight(c, topic))[0];
  try {
    const generated = await generateTurn(db, thread, speaker, settings, context, null);
    await publishGeneratedTurn(db, thread, speaker, generated, settings, now);
  } catch (error) {
    console.error("V17.4 autonomous start error:", error);
    await queueTurn(db, thread.id, { delaySeconds: randInt(120, 240), preferredMemberId: speaker.member_id, turnKind: "autonomous_start", priority: 10, now });
  }

  await db.from("ai_community_state").update({
    next_autonomous_at: new Date(now.getTime() + randInt(Number(settings.autonomous_gap_min_minutes || 5), Number(settings.autonomous_gap_max_minutes || 11)) * 60000).toISOString(),
    updated_at: now.toISOString(),
  }).eq("id", 1);
  return 1;
}

async function closeStaleThreads(db, now = new Date()) {
  const cutoff = new Date(now.getTime() - 45 * 60000).toISOString();
  const { data: stale } = await db.from("ai_conversation_threads").select("id").eq("status", "active").lt("last_activity_at", cutoff);
  const ids = (stale || []).map((r) => r.id);
  if (ids.length) {
    await db.from("ai_conversation_threads").update({ status: "completed", completed_at: now.toISOString() }).in("id", ids);
    await db.from("ai_turn_queue").update({ status: "cancelled", processed_at: now.toISOString() }).in("thread_id", ids).eq("status", "queued");
  }
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
        await db.from("ai_turn_queue").update({ status: "cancelled", processed_at: now.toISOString() }).eq("status", "queued");
        await db.from("ai_conversation_threads").update({ status: "completed", completed_at: now.toISOString() }).eq("status", "active");
      }
      return { success: true, reason: "outside_activity_time" };
    }

    if (!bypassMinuteClaim) {
      const key = `${kst.dateKey}-${String(kst.hour).padStart(2,"0")}:${String(kst.minute).padStart(2,"0")}`;
      const { data: claimed, error } = await db.rpc("claim_ai_community_tick", { target_tick_key: key });
      if (!error && !claimed) return { success: true, reason: "already_ran_this_minute" };
    }

    const characters = await loadCharacters(db, now);
    if (!characters.length) return { success: true, reason: "ai_accounts_not_ready" };
    await refreshIdleEnergy(db, characters, now);
    await closeStaleThreads(db, now);

    // 1순위: 실제회원 새 메시지
    const humanInfo = await findLatestUnhandledHuman(db);
    if (humanInfo) {
      const result = await startHumanThread(db, humanInfo, characters, settings, now);
      return { success: true, action: "human_priority", source, ...result };
    }

    // 2순위: 시간이 된 '다음 턴' 1개. 문장은 지금 생성한다.
    const due = await getDueTurn(db);
    if (due) {
      const result = await processTurn(db, due, characters, settings, now);
      return { success: true, source, ...result };
    }

    // 3순위: 신규 실제회원 환영
    const { data: welcome } = await db.from("ai_community_events").select("*")
      .eq("event_type", "member_join").eq("status", "pending")
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (welcome) {
      const queued = await startWelcomeThread(db, welcome, characters, settings, now);
      return { success: true, action: "welcome_thread", queued, source };
    }

    // 4순위: 사람이 조용할 때 새 일상대화 가지 시작. 기존 가지가 살아 있어도 제한적으로 병렬 허용.
    const started = await startAutonomousThread(db, characters, settings, now);
    return { success: true, action: started ? "autonomous_thread_started" : "idle", started, source };
  } catch (error) {
    console.error("AI COMMUNITY V17.4 ERROR:", error);
    return { success: false, error: error?.message || "AI 커뮤니티 엔진 오류" };
  }
}

export async function getAiCommunityStatus() {
  const db = dbClient();
  if (!db) return { success: false, reason: "supabase_server_env_missing" };
  const [stateRes, settingsRes, aiRes, turnRes, threadRes, relRes, memoryRes] = await Promise.all([
    db.from("ai_community_state").select("*").eq("id", 1).maybeSingle(),
    db.from("ai_community_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("account_type", "ai_character").eq("approval_status", "approved"),
    db.from("ai_turn_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
    db.from("ai_conversation_threads").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("ai_relationships").select("member_low", { count: "exact", head: true }),
    db.from("ai_social_memories").select("id", { count: "exact", head: true }),
  ]);
  return {
    success: true,
    state: stateRes.data || null,
    settings: settingsRes.data || null,
    aiAccountCount: aiRes.count || 0,
    queuedTurnCount: turnRes.count || 0,
    activeThreadCount: threadRes.count || 0,
    relationshipCount: relRes.count || 0,
    memoryCount: memoryRes.count || 0,
  };
}
