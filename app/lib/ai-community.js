import { createClient } from "@supabase/supabase-js";

export const AI_ROOM_ID = "0a495a02-bcb8-4e38-b3ef-4e7059c2a883";
const CLOUDFLARE_MODEL = process.env.CLOUDFLARE_MODEL || "@cf/openai/gpt-oss-20b";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const FIXED_AI_TURN_DELAY_SECONDS = 60;

class AIProviderError extends Error {
  constructor(provider, status, code, message, details = null) {
    super(message);
    this.name = "AIProviderError";
    this.provider = provider;
    this.status = Number(status || 0);
    this.code = code || "AI_PROVIDER_ERROR";
    this.details = details;
  }
}

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
  const raw = String(text || "").trim();
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try { return JSON.parse(cleaned || "{}"); } catch {}
  // 일부 무료 모델은 JSON 앞뒤에 한두 문장을 붙일 수 있습니다.
  // 가장 바깥 JSON 객체만 한 번 더 복구합니다.
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
  throw new Error("invalid_json");
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

async function logEngineEvent(db, { level = "error", category, provider = null, message, meta = null }) {
  try {
    await db.from("ai_engine_logs").insert({
      level,
      category,
      provider,
      message: String(message || "").slice(0, 1600),
      meta: meta || null,
    });
  } catch (error) {
    console.error("ai_engine_logs write failed:", error?.message || error);
  }
}

function providerConfig() {
  const cloudflareReady = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  const groqReady = Boolean(process.env.GROQ_API_KEY);
  const requested = String(process.env.AI_PRIMARY_PROVIDER || "").toLowerCase();
  const primary = requested === "cloudflare" || requested === "groq"
    ? requested
    : groqReady ? "groq" : "cloudflare";
  const order = primary === "groq" ? ["groq", "cloudflare"] : ["cloudflare", "groq"];
  return order.filter((provider) => provider === "groq" ? groqReady : cloudflareReady);
}

async function providerPaused(db, provider, now = new Date()) {
  try {
    const { data } = await db.from("ai_provider_health")
      .select("status,paused_until")
      .eq("provider", provider)
      .maybeSingle();
    if (!data?.paused_until) return false;
    return new Date(data.paused_until).getTime() > now.getTime();
  } catch {
    return false;
  }
}

async function markProviderSuccess(db, provider) {
  try {
    await db.from("ai_provider_health").upsert({
      provider,
      status: "healthy",
      paused_until: null,
      last_error_code: null,
      last_error_message: null,
      last_success_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider" });
  } catch {}
}

function classifyProviderError(provider, status, errorText) {
  const text = String(errorText || "");
  if (status === 401 || status === 403) {
    return new AIProviderError(provider, status, "AI_PROVIDER_AUTH_DENIED", `${provider} 인증/권한 오류 (${status})`, text.slice(0, 1200));
  }
  if (status === 429) {
    return new AIProviderError(provider, status, "AI_PROVIDER_RATE_LIMIT", `${provider} 무료 한도 또는 호출 제한에 도달했습니다.`, text.slice(0, 1200));
  }
  if (status >= 500) {
    return new AIProviderError(provider, status, "AI_PROVIDER_SERVER_ERROR", `${provider} 서버 오류 (${status})`, text.slice(0, 1200));
  }
  return new AIProviderError(provider, status, "AI_PROVIDER_HTTP_ERROR", `${provider} API 오류 (${status || "unknown"})`, text.slice(0, 1200));
}

async function markProviderFailure(db, error) {
  const provider = error?.provider || "unknown";
  const code = error?.code || "AI_PROVIDER_ERROR";
  const now = new Date();
  let pauseMinutes = 5;
  if (code === "AI_PROVIDER_AUTH_DENIED") pauseMinutes = 24 * 60;
  else if (code === "AI_PROVIDER_RATE_LIMIT") pauseMinutes = 15;
  else if (["AI_PROVIDER_BAD_JSON","AI_PROVIDER_BAD_RESPONSE","AI_PROVIDER_EMPTY_RESPONSE","AI_PROVIDER_EMPTY_MESSAGE"].includes(code)) pauseMinutes = 1;

  try {
    const { data: current } = await db.from("ai_provider_health")
      .select("error_count")
      .eq("provider", provider)
      .maybeSingle();
    await db.from("ai_provider_health").upsert({
      provider,
      status: code === "AI_PROVIDER_AUTH_DENIED" ? "blocked" : "paused",
      paused_until: new Date(now.getTime() + pauseMinutes * 60000).toISOString(),
      last_error_code: code,
      last_error_message: String(error?.message || code).slice(0, 1200),
      last_error_at: now.toISOString(),
      error_count: Number(current?.error_count || 0) + 1,
      updated_at: now.toISOString(),
    }, { onConflict: "provider" });
  } catch {}

  await logEngineEvent(db, {
    level: "error",
    category: code,
    provider,
    message: error?.message || code,
    meta: { status: error?.status || null, details: error?.details || null, pause_minutes: pauseMinutes },
  });
}

async function callCloudflare(prompt, maxOutputTokens) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) throw new AIProviderError("cloudflare", 0, "AI_PROVIDER_NOT_CONFIGURED", "Cloudflare 환경변수가 설정되지 않았습니다.");

  let response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CLOUDFLARE_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          max_tokens: Math.min(Number(maxOutputTokens || 450), 700),
          response_format: { type: "json_object" },
          reasoning_effort: "low",
        }),
        cache: "no-store",
      }
    );
  } catch (error) {
    throw new AIProviderError("cloudflare", 0, "AI_PROVIDER_NETWORK_ERROR", `Cloudflare 네트워크 오류: ${error?.message || "network error"}`);
  }

  const text = await response.text();
  if (!response.ok) throw classifyProviderError("cloudflare", response.status, text);
  let data;
  try { data = JSON.parse(text); }
  catch { throw new AIProviderError("cloudflare", response.status, "AI_PROVIDER_BAD_RESPONSE", "Cloudflare 응답 JSON을 읽을 수 없습니다.", text.slice(0, 1200)); }
  const root = data?.result || data;
  const content = root?.choices?.[0]?.message?.content ?? root?.response ?? data?.response;
  if (!content) throw new AIProviderError("cloudflare", response.status, "AI_PROVIDER_EMPTY_RESPONSE", "Cloudflare가 빈 응답을 반환했습니다.");
  try {
    return {
      payload: typeof content === "string" ? safeJson(content) : content,
      usage: root?.usage || data?.usage || null,
    };
  }
  catch { throw new AIProviderError("cloudflare", response.status, "AI_PROVIDER_BAD_JSON", "Cloudflare가 올바른 JSON 대사를 반환하지 않았습니다.", String(content).slice(0, 1200)); }
}

async function callGroq(prompt, maxOutputTokens) {
  const token = process.env.GROQ_API_KEY;
  if (!token) throw new AIProviderError("groq", 0, "AI_PROVIDER_NOT_CONFIGURED", "Groq 환경변수가 설정되지 않았습니다.");

  let response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_completion_tokens: maxOutputTokens,
        response_format: { type: "json_object" },
        reasoning_effort: "low",
        reasoning_format: "hidden",
      }),
      cache: "no-store",
    });
  } catch (error) {
    throw new AIProviderError("groq", 0, "AI_PROVIDER_NETWORK_ERROR", `Groq 네트워크 오류: ${error?.message || "network error"}`);
  }

  const text = await response.text();
  if (!response.ok) throw classifyProviderError("groq", response.status, text);
  let data;
  try { data = JSON.parse(text); }
  catch { throw new AIProviderError("groq", response.status, "AI_PROVIDER_BAD_RESPONSE", "Groq 응답 JSON을 읽을 수 없습니다.", text.slice(0, 1200)); }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new AIProviderError("groq", response.status, "AI_PROVIDER_EMPTY_RESPONSE", "Groq가 빈 응답을 반환했습니다.");
  try {
    return { payload: safeJson(content), usage: data?.usage || null };
  }
  catch { throw new AIProviderError("groq", response.status, "AI_PROVIDER_BAD_JSON", "Groq가 올바른 JSON 대사를 반환하지 않았습니다.", String(content).slice(0, 1200)); }
}

async function recordProviderUsage(db, provider, usage, purpose = "chat") {
  try {
    const promptTokens = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0) || 0;
    const completionTokens = Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0) || 0;
    const totalTokens = Number(usage?.total_tokens ?? (promptTokens + completionTokens)) || 0;
    await db.from("ai_provider_usage").insert({
      provider,
      purpose,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      created_at: new Date().toISOString(),
    });
  } catch {}
}

async function generateAI(db, prompt, maxOutputTokens = 450, purpose = "chat") {
  const configured = providerConfig();
  if (!configured.length) {
    throw new AIProviderError("none", 0, "AI_PROVIDER_NOT_CONFIGURED", "Cloudflare 또는 Groq API 환경변수가 필요합니다.");
  }

  const failures = [];
  for (const provider of configured) {
    if (await providerPaused(db, provider)) continue;
    try {
      const called = provider === "groq"
        ? await callGroq(prompt, maxOutputTokens)
        : await callCloudflare(prompt, maxOutputTokens);
      await markProviderSuccess(db, provider);
      await recordProviderUsage(db, provider, called?.usage || null, purpose);
      const result = called?.payload;
      if (failures.length) {
        await logEngineEvent(db, {
          level: "warning",
          category: "AI_PROVIDER_FAILOVER_SUCCESS",
          provider,
          message: `${provider}로 자동 전환하여 생성에 성공했습니다.`,
          meta: { failed_providers: failures.map((e) => e.provider) },
        });
      }
      return { result, provider };
    } catch (error) {
      const normalized = error instanceof AIProviderError
        ? error
        : new AIProviderError(provider, 0, "AI_PROVIDER_UNKNOWN_ERROR", error?.message || "알 수 없는 AI 공급자 오류");
      failures.push(normalized);
      await markProviderFailure(db, normalized);
    }
  }

  const last = failures[failures.length - 1];
  if (last) {
    throw new AIProviderError(
      "all",
      last.status,
      "AI_ALL_PROVIDERS_UNAVAILABLE",
      `사용 가능한 AI 공급자가 없습니다. (${failures.map((e) => `${e.provider}:${e.code}`).join(", ")})`,
      failures.map((e) => ({ provider: e.provider, code: e.code, status: e.status }))
    );
  }
  throw new AIProviderError("all", 503, "AI_ALL_PROVIDERS_PAUSED", "현재 모든 AI 공급자가 일시 중지 상태입니다.");
}

async function hasUsableProvider(db, now = new Date()) {
  const configured = providerConfig();
  if (!configured.length) return { ok: false, reason: "provider_not_configured" };
  for (const provider of configured) {
    if (!(await providerPaused(db, provider, now))) return { ok: true, provider };
  }
  return { ok: false, reason: "all_providers_paused" };
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
    autonomous_gap_min_minutes: 1,
    autonomous_gap_max_minutes: 1,
    human_quiet_minutes: 4,
    autonomous_max_active_threads: 3,
    recent_context_messages: 10,
    memory_recall_limit: 2,
    relationship_event_limit: 2,
    autonomous_thread_min_turns: 2,
    autonomous_thread_max_turns: 5,
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
[공통 대화 규칙 - 실제 한국 단체채팅처럼]
- 캐릭터는 자신의 이름, 나이, 직업, 취향, 과거와 일상을 자기 삶의 연속된 서사처럼 유지한다.
- 이전에 실제로 저장된 기억과 관계를 우선한다. 기억에 없는 과거 사건을 '전에 말했잖아요'처럼 지어내지 않는다.
- 문어체 답변이 아니라 실제 한국 메신저 말투를 쓴다. 기본은 짧은 1문장, 필요할 때만 2문장이다.
- 자율대화는 토론이나 정보글이 아니다. 한 사람이 한 번에 길게 설명하거나 팁을 연달아 쏟아내지 않는다.
- 자율대화 메시지는 보통 15~70자 정도로 짧게 쓴다. 정말 필요한 경우에도 120자를 넘기지 않는다.
- 한 주제는 보통 2~5개 메시지 안에서 충분하다. 같은 소재를 세부 팁·수치·방법으로 계속 파고들지 않는다.
- 앞의 2명이 이미 설명이나 팁을 말했다면 다음 사람은 비슷한 설명을 반복하지 말고 짧게 반응하거나 자연스럽게 화제를 옮긴다.
- 완성된 설명문을 매번 만들지 않는다. 상황에 따라 '오', '헉', 'ㅋㅋ', '그러게요', '아 그건 인정' 같은 짧은 반응도 가능하다.
- 단, 여러 캐릭터가 연속해서 의미 없는 맞장구만 반복하지 않는다.
- 말끝, 띄어쓰기, ㅋㅋ/ㅎㅎ, 느낌표, 이모티콘, 문장 길이는 캐릭터마다 다르게 유지한다.
- 모든 턴에서 질문하지 않는다. 질문은 정말 상대 답이 궁금하거나 대화를 자연스럽게 이어야 할 때만 한다.
- 최근 대화에서 질문이 이미 2번 이상 이어졌다면 이번 메시지는 질문으로 끝내지 않는다.
- '저도 예전에 ~했는데요' 같은 개인 경험을 매번 만들어내지 않는다. 경험담은 흐름에 꼭 맞을 때만 가끔 쓴다.
- 실제회원이 질문했다면 먼저 그 질문에 직접 답한다. 관련 없는 자기 식사시간, 자기 계획 같은 이야기로 질문을 피하지 않는다.
- 모르는 장소/가게/사실을 아는 척 지어내지 않는다. 확실하지 않으면 범위를 좁혀 묻거나 일반적인 선택지를 말한다.
- 바로 앞 말만 기계적으로 따라가지 말고, 지금 살아있는 대화 가지 중 어떤 말에 답하는지 분명히 정한다.
- 같은 주제 안에서도 A의 첫 말에 뒤늦게 답하거나, B의 답변에 다시 답할 수 있다.
- 다른 주제가 동시에 살아있어도 괜찮다. 단, 아무 연결 없이 갑자기 전혀 다른 말로 튀지 않는다.
- 질문, 대답, 공감, 자기 경험, 가벼운 반대, 농담, 짧은 리액션, 주제 확장, 자연스러운 마무리를 섞는다.
- 대화가 끝날 때 굳이 '그럼 이만'처럼 마무리하지 않아도 된다. 사람 단톡처럼 자연스럽게 멈출 수 있다.
- 모든 캐릭터가 같은 말투나 ㅋㅋ/ㅎㅎ를 쓰지 않는다.
- 실제회원 메시지가 있으면 그 흐름을 AI끼리의 잡담보다 우선한다.
- 이벤트 참여 중에는 자신이 실제로 제출한 선택만 말할 수 있고, 서버 정답이나 당첨 결과를 미리 아는 척하지 않는다.
- 당첨 발표 뒤에는 똑같은 '축하합니다'만 복사하지 말고 짧은 감탄, 농담, 부러움, 축하를 각자 다르게 표현한다.
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
  const latest = unhandled[unhandled.length - 1];
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
  preparedPayload = null,
  preparedProvider = null,
  generationMode = null,
  now = new Date(),
} = {}) {
  const seconds = delaySeconds ?? FIXED_AI_TURN_DELAY_SECONDS;
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
    prepared_payload: preparedPayload,
    prepared_provider: preparedProvider,
    generation_mode: generationMode,
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


async function loadEventContext(db, eventId, speakerId = null) {
  if (!eventId) return null;
  const { data: event } = await db.from("events")
    .select("id,title,description,event_type,status,starts_at,ends_at,round_number")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  let quiz = null;
  if (event.event_type === "quiz") {
    const { data: secret } = await db.from("event_game_secrets")
      .select("secret_answer").eq("event_id", eventId).maybeSingle();
    if (secret?.secret_answer) {
      const { data } = await db.from("event_quiz_bank")
        .select("id,question,option_1,option_2,option_3,option_4,quiz_type,category,difficulty")
        .eq("id", secret.secret_answer)
        .maybeSingle();
      quiz = data || null;
    }
  }

  let myEntry = null;
  if (speakerId) {
    const { data } = await db.from("event_entries")
      .select("answer,result_text,submitted_at")
      .eq("event_id", eventId)
      .eq("member_id", speakerId)
      .maybeSingle();
    myEntry = data || null;
  }

  const { data: winnerRow } = await db.from("event_winners")
    .select("member_id,selected_at,rank").eq("event_id", eventId).order("rank", { ascending: true }).limit(1).maybeSingle();
  let winner = null;
  if (winnerRow?.member_id) {
    const { data: profile } = await db.from("profiles")
      .select("id,nickname,account_type").eq("id", winnerRow.member_id).maybeSingle();
    winner = profile || { id: winnerRow.member_id, nickname: "VIP 회원", account_type: "human" };
  }

  let myAnswer = "아직 참가 기록 없음";
  if (myEntry) {
    if (event.event_type === "quiz") {
      const index = Number(myEntry.answer || 0);
      const options = quiz ? [quiz.option_1, quiz.option_2, quiz.option_3, quiz.option_4] : [];
      myAnswer = index >= 1 && index <= 4
        ? `${index}번${options[index - 1] ? ` (${options[index - 1]})` : ""} 선택`
        : "퀴즈 참가 완료";
    } else if (event.event_type === "gift_box") {
      myAnswer = `${myEntry.answer || "?"}번 상자 선택`;
    } else if (event.event_type === "number") {
      myAnswer = `${myEntry.answer || "?"}번 선택`;
    } else if (event.event_type === "roulette") {
      myAnswer = "룰렛 응모 완료";
    } else if (event.event_type === "draw") {
      myAnswer = "자동추첨 응모 완료";
    } else if (event.event_type === "attendance") {
      myAnswer = "출석 완료";
    } else if (event.event_type === "first_come") {
      myAnswer = "선착순 참여";
    } else {
      myAnswer = myEntry.result_text || "참가 완료";
    }
  }

  const quizText = quiz
    ? `퀴즈 문제=${quiz.question} / 보기=1:${quiz.option_1}, 2:${quiz.option_2}, 3:${quiz.option_3}, 4:${quiz.option_4}`
    : "";
  return {
    event,
    quiz,
    myEntry,
    winner,
    text: [
      `이벤트=${event.title || event.event_type}`,
      `종류=${event.event_type}`,
      `상태=${event.status}`,
      `현재 캐릭터 참가내용=${myAnswer}`,
      quizText,
      `당첨자=${winner?.nickname || "아직 발표 전"}`,
      `현재 캐릭터가 당첨자=${winner?.id && speakerId ? String(winner.id === speakerId) : "false"}`,
      "중요: 진행 중 이벤트의 서버 정답/당첨 결과는 절대 추측하거나 미리 아는 척하지 않는다.",
    ].filter(Boolean).join("\n"),
  };
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


const LOCAL_PATTERN_LOCK_HOURS = 72;

const LOCAL_REACTIONS = {
  greeting: ["안녕하세요ㅎㅎ", "반가워요!", "오 안녕하세요", "어서오세요~", "안녕하세요 :)"],
  thanks: ["별말씀을요ㅎㅎ", "아니에요 괜찮아요", "도움이 됐다니 다행이에요", "ㅎㅎ 다행이네요"],
  laugh: ["ㅋㅋㅋㅋ", "아 이건 좀 웃기네요ㅋㅋ", "ㅋㅋ 저도 웃었어요", "아 그건 인정이에요ㅋㅋ"],
  celebration: ["와 축하해요!", "오 대박 축하드려요ㅎㅎ", "헉 축하해요ㅋㅋ", "와 이건 좀 부럽네요", "좋은 소식이네요. 축하해요!"],
  loss: ["아이고 아쉽네요", "이건 좀 속상하겠어요", "ㅠㅠ 그래도 너무 마음 쓰진 마세요", "아쉽네요 진짜"],
  agree: ["맞아요", "그러게요ㅎㅎ", "아 그건 인정이에요", "저도 비슷한 편이에요"],
};

// 카카오톡 오픈채팅처럼 기본은 존댓말로 유지합니다.
// opener는 72시간 동안 같은 계열을 다시 쓰지 않도록 충분히 넓게 둡니다.
const LOCAL_OPENERS = [
  (t) => `요즘 ${t} 얘기가 은근 자주 보이더라고요.`,
  (t) => `${t}는 생각보다 취향 차이가 꽤 큰 것 같아요.`,
  (t) => `최근에 ${t} 얘기를 몇 번 들었는데 괜히 궁금해지더라고요ㅎㅎ`,
  (t) => `저는 ${t} 쪽은 가끔 생각날 때만 찾아보는 편이에요.`,
  (t) => `${t} 좋아하시는 분들이 주변에도 꽤 있더라고요.`,
  (t) => `오늘은 이상하게 ${t} 생각이 한번 나네요.`,
  (t) => `${t} 관련해서는 사람마다 기준이 진짜 다르더라고요.`,
  (t) => `예전에는 ${t}에 별 관심 없었는데 요즘은 조금 달라졌어요.`,
  (t) => `${t}는 막 자주 찾진 않는데 가끔 생각날 때가 있어요.`,
  (t) => `저는 ${t} 얘기 들으면 한 번쯤 찾아보게 되더라고요ㅎㅎ`,
  (t) => `${t} 쪽은 잘 모르는데 듣다 보면 은근 재미있어요.`,
  (t) => `주변에서 ${t} 얘기가 나오면 의견이 꽤 갈리더라고요ㅋㅋ`,
  (t) => `${t}는 기대 안 하고 접했을 때 오히려 괜찮았던 적이 있어요.`,
  (t) => `저는 요즘 ${t} 같은 건 너무 깊게 안 보고 가볍게 보는 편이에요.`,
  (t) => `${t} 얘기만 나오면 각자 경험담이 하나씩은 있는 것 같아요.`,
  (t) => `최근에 ${t} 쪽으로 괜찮다는 얘기를 들어서 조금 궁금했어요.`,
  (t) => `${t}는 그날 기분에 따라서 느낌이 좀 달라지는 것 같아요.`,
  (t) => `저는 ${t} 쪽은 편하게 즐기는 게 제일 좋더라고요.`,
  (t) => `${t} 관련해서 괜히 오래 고민할 때가 있더라고요ㅎㅎ`,
  (t) => `요즘은 ${t}도 예전이랑 느낌이 조금 달라진 것 같아요.`,
  (t) => `${t}는 남들 추천보다 직접 해보는 게 제일 빠른 것 같아요.`,
  (t) => `저는 ${t} 쪽에서 의외로 소소한 재미를 느끼는 편이에요.`,
  (t) => `${t} 얘기 들으니까 예전에 비슷한 경험이 하나 떠오르네요.`,
  (t) => `가끔 ${t} 같은 얘기 나올 때 듣고만 있어도 재밌더라고요.`,
  (t) => `저는 ${t}는 너무 계획하기보다 그때그때 보는 편이에요.`,
  (t) => `${t}는 한동안 안 찾다가도 어느 순간 다시 생각나더라고요.`,
  (t) => `요즘 ${t} 관련해서 새로운 얘기가 꽤 많더라고요.`,
  (t) => `${t} 쪽은 사소한 차이인데도 느낌이 확 달라질 때가 있어요.`,
  (t) => `저는 ${t}는 복잡하게 생각 안 하는 쪽이 더 편하더라고요.`,
  (t) => `${t}는 다른 분들 얘기 듣다 보면 생각이 바뀔 때도 있어요.`,
  (t) => `최근에는 ${t} 같은 소소한 얘기가 더 편하게 들리더라고요.`,
  (t) => `${t}는 한 번 관심 생기면 잠깐 찾아보게 되는 정도예요ㅎㅎ`,
  (t) => `저는 ${t} 쪽은 큰 기대 없이 보는 게 오히려 좋더라고요.`,
  (t) => `${t} 얘기는 가볍게 나눌 때 제일 재밌는 것 같아요.`,
  (t) => `요즘은 ${t} 관련해서 취향이 좀 바뀐 분들도 많더라고요.`,
  (t) => `${t}는 정답이 있다기보다 각자 편한 방식이 있는 것 같아요.`,
];

const LOCAL_REPLY_A = [
  "저도 비슷한 편이에요", "저는 조금 다르게 느끼는 편이에요", "저도 예전에는 그랬어요",
  "저는 그냥 편한 쪽으로 가는 편이에요", "그럴 때는 그날 기분 따라 달라져요",
  "저도 한동안 관심 있다가 요즘은 좀 뜸해졌어요", "저는 오히려 너무 고민 안 하는 게 편하더라고요",
  "저도 그런 얘기 들으면 한번 해보고 싶어져요", "저는 주변 추천을 좀 보는 편이에요",
  "저는 직접 해보고 판단하는 편이에요", "저도 가끔은 그런 생각 들어요", "저는 요즘 기준이 좀 바뀌었어요",
];

const LOCAL_REPLY_B = [
  "ㅎㅎ", "ㅋㅋ", "생각보다 괜찮더라고요", "은근 차이가 있더라고요", "그게 제일 편한 것 같아요",
  "저한테는 그쪽이 더 잘 맞더라고요", "막상 해보면 또 느낌이 다르더라고요", "너무 자주만 아니면 괜찮은 것 같아요",
];

const LOCAL_BRIDGES = [
  "저는 오늘 집에 가면 뭐 먹을지가 더 고민이에요ㅋㅋ",
  "오늘은 시간 진짜 빨리 가는 느낌이네요.",
  "요즘은 집에 들어가면 바로 쉬고 싶더라고요ㅎㅎ",
  "오늘 날씨는 생각보다 괜찮은 것 같아요.",
  "저는 요즘 커피를 줄이려고 하는데 잘 안 되네요ㅋㅋ",
  "이번 주말은 아직 아무 계획도 못 정했어요.",
  "요즘 잠을 조금 일찍 자보려고 하는 중이에요.",
  "저는 요즘 유튜브 켜놓고 멍하니 보는 시간이 늘었어요ㅎㅎ",
  "오늘은 이상하게 간식이 계속 생각나네요.",
  "저는 집에 쌓인 택배부터 정리해야 하는데 계속 미루고 있어요ㅋㅋ",
  "요즘은 저녁에 잠깐 걷는 게 생각보다 좋더라고요.",
  "저는 주말에 그냥 늦잠 자는 것도 꽤 좋더라고요ㅎㅎ",
  "오늘 할 일이 조금 남아서 저녁까지는 금방 갈 것 같아요.",
  "요즘 옷 입기가 애매한 날씨라 아침마다 고민돼요.",
  "저는 최근에 배달을 좀 줄여보려고 하고 있어요ㅋㅋ",
  "요즘은 집에서 조용히 쉬는 시간이 제일 좋더라고요.",
  "오늘은 괜히 달달한 게 하나 먹고 싶네요ㅎㅎ",
  "저는 요즘 사진 정리를 미루고만 있어요.",
  "주말에 영화 하나 볼까 하는데 아직 못 골랐어요.",
  "요즘은 하루가 왜 이렇게 빨리 지나가는지 모르겠어요ㅋㅋ",
  "저는 오늘 빨래부터 해야 하는데 벌써 귀찮네요.",
  "최근에 방 정리를 조금 했더니 생각보다 속이 시원하더라고요.",
  "저는 요즘 아침보다 저녁 시간이 훨씬 편해요.",
  "오늘은 집 가는 길에 편의점 한번 들를까 싶어요ㅎㅎ",
  "요즘 음악은 예전에 듣던 것만 다시 듣게 되더라고요.",
  "저는 요즘 주말 약속을 너무 많이 안 잡으려고 해요.",
  "오늘은 점심 먹고 나서 유난히 졸리더라고요ㅋㅋ",
  "저는 요즘 새로 사는 것보다 있는 걸 잘 쓰는 쪽으로 바뀌었어요.",
  "이번 주는 유난히 길게 느껴지는 것 같아요.",
  "요즘 저녁 메뉴 정하는 게 은근 제일 어렵네요ㅎㅎ",
  "저는 최근에 산책할 때 이어폰 없이 걷는 것도 괜찮더라고요.",
  "오늘은 그냥 조용히 쉬고 싶은 날이에요.",
  "요즘 집에 있는 시간이 생각보다 편해졌어요ㅎㅎ",
  "저는 이번 주말에 밀린 정리 좀 하려고요.",
  "오늘은 따뜻한 거 하나 마시면 좋을 것 같네요.",
  "요즘은 잠깐 쉬는 시간도 꽤 소중하게 느껴져요.",
];

function pickOne(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function compactCharacter(character) {
  const nick = character?.profile?.nickname || character?.nickname || character?.character_name || "회원";
  const style = String(character?.speaking_style || "").slice(0, 90);
  const traits = String(character?.style_traits || "").slice(0, 80);
  const interests = Array.isArray(character?.interests) ? character.interests.slice(0, 4).join(",") : "";
  return `${character.member_id}|${nick}|${character.age || ""}|${style}|${traits}|${interests}`;
}

function styleLocalText(character, base) {
  let text = String(base || "").trim();
  const style = `${character?.speaking_style || ""} ${character?.style_traits || ""}`;
  if (/ㅋㅋ/.test(style) && Math.random() < 0.18 && !/ㅋㅋ/.test(text)) text += " ㅋㅋ";
  else if (/ㅎㅎ/.test(style) && Math.random() < 0.18 && !/ㅎㅎ/.test(text)) text += "ㅎㅎ";
  if (/느낌표/.test(style) && Math.random() < 0.12 && !/[!?]$/.test(text)) text += "!";
  return trimChatMessage(text, 110);
}

function simpleHumanIntent(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return "other";
  if (/^(안녕|안녕하세요|하이|ㅎㅇ|반가워)/.test(value)) return "greeting";
  if (/(고마워|감사|땡큐|ㄳ)/.test(value)) return "thanks";
  if (/^(ㅋ+|ㅎ+)$/.test(value) || /(ㅋㅋㅋ|ㅎㅎㅎ)/.test(value)) return "laugh";
  if (detectSituation(value) === "celebration") return "celebration";
  if (detectSituation(value) === "loss") return "loss";
  if (value.length <= 12 && /(맞아|맞아요|인정|그러게|그렇죠|ㅇㅇ|네네|넵)/.test(value)) return "agree";
  return "other";
}

function localReplyForHuman(character, intent, humanText = "") {
  const pool = LOCAL_REACTIONS[intent] || LOCAL_REACTIONS.agree;
  let base = pickOne(pool);
  if (intent === "greeting" && Math.random() < 0.25) {
    base = pickOne(["오셨네요ㅎㅎ", "안녕하세요~", "반가워요ㅎㅎ"]);
  }
  return styleLocalText(character, base);
}

function normalizeLocalShape(text, topic = "") {
  let value = String(text || "").toLowerCase();
  const t = String(topic || "").toLowerCase().trim();
  if (t) value = value.split(t).join("{topic}");
  return value
    .replace(/[ㅋㅎ]{2,}/g, "")
    .replace(/[^가-힣a-z0-9{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function localShapeTooSimilar(candidate, recentShapes) {
  const shape = normalizeLocalShape(candidate);
  if (!shape) return true;
  if (recentShapes.has(shape)) return true;
  const words = new Set(shape.split(" ").filter((w) => w.length > 1));
  for (const recent of recentShapes) {
    if (!recent) continue;
    if (shape.slice(0, 14) === recent.slice(0, 14) && shape.slice(0, 14).length >= 8) return true;
    const rWords = new Set(recent.split(" ").filter((w) => w.length > 1));
    if (!words.size || !rWords.size) continue;
    let same = 0;
    for (const w of words) if (rWords.has(w)) same += 1;
    const ratio = same / Math.max(words.size, rWords.size);
    if (ratio >= 0.72) return true;
  }
  return false;
}

async function load72HourLocalLocks(db, now = new Date()) {
  const cutoff = new Date(now.getTime() - LOCAL_PATTERN_LOCK_HOURS * 60 * 60 * 1000).toISOString();
  const [{ data: threads }, { data: messages }] = await Promise.all([
    db.from("ai_conversation_threads")
      .select("summary,created_at")
      .eq("thread_type", "autonomous")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("group_messages")
      .select("content,created_at")
      .eq("room_id", AI_ROOM_ID)
      .eq("is_deleted", false)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(700),
  ]);

  const openerIds = new Set();
  const flowIds = new Set();
  const bridgeIds = new Set();
  for (const row of threads || []) {
    const summary = String(row.summary || "");
    const marker = summary.match(/LOCK72\|open=(\d+)\|flow=([^|]+)\|bridge=(-?\d+)/);
    if (!marker) continue;
    openerIds.add(Number(marker[1]));
    flowIds.add(marker[2]);
    if (Number(marker[3]) >= 0) bridgeIds.add(Number(marker[3]));
  }
  const recentShapes = new Set((messages || []).map((m) => normalizeLocalShape(m.content)).filter(Boolean));
  return { openerIds, flowIds, bridgeIds, recentShapes };
}

function buildReplyLine() {
  const a = Math.floor(Math.random() * LOCAL_REPLY_A.length);
  const b = Math.floor(Math.random() * LOCAL_REPLY_B.length);
  return { id: `reply-${a}-${b}`, text: `${LOCAL_REPLY_A[a]}${LOCAL_REPLY_B[b] ? ` ${LOCAL_REPLY_B[b]}` : ""}`.trim() };
}

async function localAutonomousMessages(db, selected, topic, now = new Date()) {
  const title = String(topic?.title || topic?.category || "요즘 일상").replace(/\s+/g, " " ).slice(0, 28);
  const locks = await load72HourLocalLocks(db, now);

  const availableOpeners = LOCAL_OPENERS
    .map((fn, id) => ({ fn, id }))
    .filter((x) => !locks.openerIds.has(x.id));
  if (!availableOpeners.length) return { messages: [], meta: null };

  const opener = pickOne(availableOpeners);
  const count = Math.max(2, Math.min(selected.length, randInt(2, 4)));
  const includeBridge = count >= 3 && Math.random() < 0.42;

  let bridge = null;
  if (includeBridge) {
    const availableBridges = LOCAL_BRIDGES
      .map((text, id) => ({ text, id }))
      .filter((x) => !locks.bridgeIds.has(x.id));
    if (availableBridges.length) bridge = pickOne(availableBridges);
  }

  const messages = [];
  const localShapes = new Set(locks.recentShapes);
  const patternIds = [];

  const firstCharacter = selected[0];
  const firstText = styleLocalText(firstCharacter, opener.fn(title));
  if (localShapeTooSimilar(firstText, localShapes)) return { messages: [], meta: null };
  messages.push({ member_id: firstCharacter.member_id, message: firstText, act: "experience" });
  localShapes.add(normalizeLocalShape(firstText));
  patternIds.push(`open-${opener.id}`);

  for (let i = 1; i < count; i += 1) {
    const character = selected[i % selected.length];
    let picked = null;

    if (bridge && i === count - 1) {
      const text = styleLocalText(character, bridge.text);
      if (!localShapeTooSimilar(text, localShapes)) picked = { id: `bridge-${bridge.id}`, text, act: "bridge" };
    }

    if (!picked) {
      for (let tries = 0; tries < 18; tries += 1) {
        const reply = buildReplyLine();
        const text = styleLocalText(character, reply.text);
        if (locks.flowIds.has(reply.id)) continue;
        if (localShapeTooSimilar(text, localShapes)) continue;
        picked = { ...reply, text, act: tries % 4 === 0 ? "experience" : "agree" };
        break;
      }
    }

    if (!picked) continue;
    messages.push({ member_id: character.member_id, message: picked.text, act: picked.act });
    localShapes.add(normalizeLocalShape(picked.text));
    patternIds.push(picked.id);
  }

  if (messages.length < 2) return { messages: [], meta: null };
  const flowId = patternIds.join(",");
  if (locks.flowIds.has(flowId)) return { messages: [], meta: null };
  return {
    messages,
    meta: {
      openerId: opener.id,
      bridgeId: bridge?.id ?? -1,
      flowId,
      summary: `V18 로컬 오픈채팅 대화 | LOCK72|open=${opener.id}|flow=${flowId}|bridge=${bridge?.id ?? -1}`,
    },
  };
}

function localWelcomeMessages(selected, nickname) {
  return selected.slice(0, 4).map((c, i) => ({
    member_id: c.member_id,
    message: styleLocalText(c, i === 0 ? `${nickname || "회원"}님 안녕하세요ㅎㅎ` : pickOne(["반가워요!", "어서오세요~", "오 새로 오셨네요ㅎㅎ"])),
    act: "agree",
  }));
}

function localEventMessages(selected, event, winner = null) {
  if (winner) {
    return selected.map((c) => ({
      member_id: c.member_id,
      message: styleLocalText(
        c,
        c.member_id === winner.id
          ? pickOne(["헉 제가요? 감사합니다ㅎㅎ", "와 저 당첨된 거예요?ㅋㅋ 감사합니다!", "헉 대박 감사합니다"])
          : pickOne(LOCAL_REACTIONS.celebration)
      ),
      act: "celebration",
    }));
  }
  const label = event?.title || "이벤트";
  return selected.map((c, i) => ({
    member_id: c.member_id,
    message: styleLocalText(c, i === 0 ? `${label} 저도 참여했어요ㅎㅎ` : pickOne(["오 저도 넣었어요ㅋㅋ", "저도 참여 완료!", "이번엔 좀 기대되네요ㅎㅎ"])),
    act: "agree",
  }));
}

function preparedGenerated(item, remainingCount = 0, provider = "local") {
  return {
    message: item.message,
    replyTo: item.reply_to_message_id || null,
    act: item.act || "agree",
    shouldContinue: remainingCount > 0,
    openQuestion: false,
    energy: remainingCount > 0 ? 0.72 : 0.15,
    summary: null,
    provider,
    relationshipNote: "",
    memoryUpdates: [],
  };
}

async function publishPreparedNow(db, thread, characters, settings, prepared, now, provider = "local") {
  if (!prepared?.length) return null;
  const first = prepared[0];
  const speaker = characters.find((c) => c.member_id === first.member_id);
  if (!speaker) return null;
  const generated = preparedGenerated(first, prepared.length - 1, provider);
  const published = await publishGeneratedTurn(db, thread, speaker, generated, settings, now, { scheduleNext: false });
  const remaining = prepared.slice(1);
  if (remaining.length) {
    await queueTurn(db, thread.id, {
      delaySeconds: FIXED_AI_TURN_DELAY_SECONDS,
      preferredMemberId: remaining[0].member_id,
      targetMessageId: published?.inserted?.id || thread.last_message_id || null,
      turnKind: thread.thread_type,
      priority: thread.priority || 70,
      preparedPayload: remaining,
      preparedProvider: provider,
      generationMode: provider === "local" ? "local" : "batch",
      now,
    });
  }
  return published;
}

async function generateHumanBatch(db, humanText, selected, context, purpose = "human_batch") {
  const recent = context.rows.slice(-6).map((r) => {
    const p = context.profileMap.get(r.member_id);
    return `${p?.nickname || "회원"}: ${String(r.content || "").slice(0, 180)}`;
  }).join("\n");
  const chars = selected.map(compactCharacter).join("\n");
  const prompt = `
한국 VIP 단체채팅에서 실제회원의 말에 여러 사람이 자연스럽게 답한다.
한 번의 API 호출로 아래 캐릭터들의 짧은 답변을 모두 만든다.

[실제회원 메시지]
${String(humanText || "").slice(0, 500)}

[최근 대화 최대 6개]
${recent || "없음"}

[응답 캐릭터]
형식: member_id|닉네임|나이|말투|표현특징|관심사
${chars}

규칙:
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
- "아 맞다"로 습관적으로 시작하거나 "이 얘기는 여기까지"처럼 대화를 선언적으로 끝내지 않는다.
- JSON 외 문장 금지.

JSON:
{"replies":[{"member_id":"UUID","message":"짧은 답변","act":"answer|agree|experience|joke|support|bridge"}]}
`.trim();
  const generated = await generateAI(db, prompt, 700, purpose);
  const replies = Array.isArray(generated?.result?.replies) ? generated.result.replies : [];
  const allowed = new Set(selected.map((c) => c.member_id));
  const cleaned = [];
  for (const r of replies) {
    if (!allowed.has(r?.member_id)) continue;
    const message = trimChatMessage(String(r?.message || ""), 110);
    if (message.length < 2) continue;
    cleaned.push({
      member_id: r.member_id,
      message,
      act: ["answer","agree","experience","joke","support","bridge"].includes(r?.act) ? r.act : "answer",
    });
  }
  return { replies: cleaned, provider: generated?.provider || "unknown" };
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
  const eventContext = thread.source_event_id
    ? await loadEventContext(db, thread.source_event_id, speaker.member_id)
    : null;

  const threadMessages = context.rows.filter((r) => r.ai_thread_id === thread.id).slice(-14);
  const threadGuidance = thread.thread_type === "welcome"
    ? "새로 들어온 실제회원에게 반갑게 인사하고, 환영문구만 반복하지 말고 편하게 어울릴 수 있는 한마디를 이어간다."
    : thread.thread_type === "celebration"
      ? "실제회원의 기쁜 소식에 반응한다. 축하만 복사하지 말고 앞사람의 말과 상황을 받아 기쁜 분위기를 이어간다."
      : thread.thread_type === "loss"
        ? "실제회원의 속상한 상황에 가볍게 비웃지 말고 공감/안정/짧은 경험으로 자연스럽게 반응한다."
        : thread.thread_type === "human_reply"
          ? "실제회원의 대화가 중심이다. 캐릭터끼리 자기 이야기만 하지 말고 회원의 말에서 나온 구체적인 내용에 연결한다."
          : thread.thread_type === "event_start"
            ? "지금 실제로 진행 중인 이벤트에 참가한 사람처럼 짧게 반응한다. 자신이 제출한 선택은 말해도 되지만 정답이나 당첨 결과를 미리 아는 척하면 안 된다. '이벤트 참여했습니다' 같은 안내문 말투보다 실제 단톡 반응을 쓴다."
            : thread.thread_type === "event_winner"
              ? "방금 발표된 이벤트 당첨자를 자연스럽게 축하한다. 현재 캐릭터가 당첨자라면 자기 자신을 축하하지 말고 놀라거나 고맙다고 반응한다. 다른 사람은 감탄/축하/장난/부러움 중 캐릭터다운 방식으로 반응한다."
              : "사람들이 쉬는 커뮤니티에서 자연스럽게 이어지는 사적인 일상대화다. 토론이나 정보교환 회의가 아니다. 같은 소재를 2~5개 메시지 정도 나눴으면 충분하며, 반복되기 전에 짧게 끝내거나 연상되는 다른 일상 주제로 가볍게 넘어간다.";
  const candidateTargets = threadMessages.slice(-8).map((r) => {
    const p = context.profileMap.get(r.member_id);
    return `[${r.id}] ${p?.nickname || "회원"}: ${String(r.content || "").slice(0, 300)}`;
  }).join("\n");
  const recentThreadMessages = threadMessages.slice(-5);
  const recentQuestionCount = recentThreadMessages.filter((r) => /[?？]\s*$/.test(String(r.content || "").trim())).length;
  const recentLongCount = recentThreadMessages.filter((r) => String(r.content || "").trim().length >= 90).length;
  const autonomousFatigue = thread.thread_type === "autonomous"
    ? clamp((Number(thread.turn_count || 0) - 1) / 4, 0, 1)
    : 0;

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
최근 5개 중 질문형 메시지 수=${recentQuestionCount}
최근 5개 중 90자 이상 장문 수=${recentLongCount}
주제 피로도=${autonomousFatigue.toFixed(2)}
요약=${thread.summary || "아직 없음"}
${topic ? `주제=${topic.category} / ${topic.title} / ${topic.prompt_seed}` : "주제=실제회원 대화에서 자연스럽게 결정"}

${eventContext ? `[현재 이벤트 정보]\n${eventContext.text}\n` : ""}

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
- 실제회원이 질문했다면 첫 문장에서 그 질문에 직접 답한다. 질문과 관계없는 자기 근황으로 회피하지 않는다.
- 질문을 던져야만 대화가 이어진다고 생각하지 않는다. 답/리액션/경험만 말하고 끝내도 자연스럽다.
- 최근 질문형 메시지가 2개 이상이면 이번 메시지는 질문으로 끝내지 않는다.
- 최근 장문이 2개 이상이면 이번 메시지는 짧은 한 문장으로 쓴다.
- 자율대화에서 turn_count가 3 이상이면 '더 깊게 설명'보다 짧은 반응/농담/연상 화제 전환/자연스러운 종료를 우선한다.
- 자율대화에서 turn_count가 4 이상이면 정말 열린 질문에 답해야 하는 경우가 아니면 should_continue=false를 우선한다.
- 같은 팁, 같은 재료, 같은 수치, 같은 방법을 표현만 바꿔 다시 말하지 않는다.
- 이벤트 진행 중이면 현재 이벤트 정보에 있는 자신의 실제 참가내용과 일치시킨다.
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
  "relationship_note":"",
  "memory_updates":[
    {"scope":"personal|person|relationship|community|future","subject":"speaker|source_human|null","fact":"기억할 사실","importance":50,"confidence":100,"event_at":null,"valid_until":null}
  ]
}
`.trim();

  const generatedBy = await generateAI(db, prompt, 420, "legacy_single");
  const result = generatedBy.result;
  const message = String(result?.message || "").trim().replace(/\s+/g, " ");
  if (message.length < 2) throw new AIProviderError(generatedBy.provider, 200, "AI_PROVIDER_EMPTY_MESSAGE", "AI 공급자가 빈 대사를 반환했습니다.");
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
    provider: generatedBy.provider,
    relationshipNote: String(result?.relationship_note || "").slice(0, 500),
    memoryUpdates: Array.isArray(result?.memory_updates) ? result.memory_updates : [],
  };
}

function normalizeChatText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(normalizeChatText(value).split(/\s+/).filter((v) => v.length >= 2));
}

function jaccardSimilarity(a, b) {
  const aa = tokenSet(a);
  const bb = tokenSet(b);
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection += 1;
  const union = aa.size + bb.size - intersection;
  return union ? intersection / union : 0;
}

function trimChatMessage(value, limit) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length <= limit) return text;
  const clipped = text.slice(0, limit);
  const punctuation = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf("!"),
    clipped.lastIndexOf("?"),
    clipped.lastIndexOf("~")
  );
  if (punctuation >= Math.floor(limit * 0.55)) return clipped.slice(0, punctuation + 1).trim();
  const lastSpace = clipped.lastIndexOf(" ");
  const cutAt = lastSpace >= Math.floor(limit * 0.6) ? lastSpace : limit;
  return `${clipped.slice(0, cutAt).trim()}…`;
}

async function isRepetitiveAutonomousTurn(db, threadId, message) {
  const { data } = await db.from("group_messages")
    .select("content")
    .eq("ai_thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(4);
  const recent = data || [];
  return recent.some((row) => jaccardSimilarity(row.content, message) >= 0.62);
}

async function publishGeneratedTurn(db, thread, speaker, generated, settings, now = new Date(), { scheduleNext = true } = {}) {
  const maxChars = thread.thread_type === "autonomous" ? 120
    : ["event_start","event_winner","welcome","celebration"].includes(thread.thread_type) ? 140
      : 220;
  generated.message = trimChatMessage(generated.message, maxChars);

  if (thread.thread_type === "autonomous" && await isRepetitiveAutonomousTurn(db, thread.id, generated.message)) {
    await db.from("ai_conversation_threads").update({
      status: "completed",
      completed_at: now.toISOString(),
      last_activity_at: now.toISOString(),
      energy: Math.min(Number(thread.energy || 0.5), 0.18),
      summary: generated.summary || thread.summary || "같은 내용 반복을 감지해 자연스럽게 대화를 종료했습니다.",
    }).eq("id", thread.id);
    await db.from("ai_turn_queue").update({
      status: "cancelled",
      processed_at: now.toISOString(),
    }).eq("thread_id", thread.id).eq("status", "queued");
    return { inserted: null, continueThread: false, provider: generated.provider, skipped: "topic_repetition" };
  }

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
  const configuredMax = Number(thread.max_turns || 10);
  const effectiveMax = thread.thread_type === "autonomous" ? Math.min(configuredMax, 5) : configuredMax;
  const mustContinue = nextTurnCount < Number(thread.min_turns || 2);
  const mustStop = nextTurnCount >= effectiveMax;
  const fatiguedAutonomous = thread.thread_type === "autonomous" && nextTurnCount >= 4;
  const continueSignal = fatiguedAutonomous
    ? (generated.openQuestion && generated.shouldContinue && generated.energy >= 0.72)
    : (generated.shouldContinue || generated.openQuestion);
  const continueThread = !mustStop && (mustContinue || continueSignal) && generated.energy >= 0.2;

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
      delaySeconds: FIXED_AI_TURN_DELAY_SECONDS,
      targetMessageId: inserted.id,
      turnKind: ["human_reply","welcome","celebration","loss"].includes(kind) ? kind : "continue",
      priority,
      now,
    });
  } else if (thread.thread_type === "autonomous") {
    // 한 주제가 끝났으면 다음 자율 대화 판단을 1분 뒤 확실하게 열어둡니다.
    await db.from("ai_community_state").update({
      next_autonomous_at: new Date(now.getTime() + 60 * 1000).toISOString(),
      updated_at: now.toISOString(),
    }).eq("id", 1);
  }
  return { inserted, continueThread, provider: generated.provider };
}

async function processTurn(db, turn, characters, settings, now = new Date()) {
  const thread = await loadThread(db, turn.thread_id);
  if (!thread || thread.status !== "active") {
    await db.from("ai_turn_queue").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", turn.id);
    return { action: "turn_cancelled" };
  }

  const prepared = Array.isArray(turn.prepared_payload) ? turn.prepared_payload : [];
  if (prepared.length) {
    const item = prepared[0];
    const speaker = characters.find((c) => c.member_id === item.member_id)
      || characters.find((c) => c.member_id === turn.preferred_member_id);
    if (!speaker) {
      await db.from("ai_turn_queue").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", turn.id);
      return { action: "prepared_speaker_missing" };
    }

    const remaining = prepared.slice(1);
    const generated = preparedGenerated(item, remaining.length, turn.prepared_provider || "local");
    const published = await publishGeneratedTurn(db, thread, speaker, generated, settings, now, { scheduleNext: false });

    if (remaining.length) {
      await db.from("ai_turn_queue").update({
        status: "queued",
        scheduled_at: new Date(now.getTime() + FIXED_AI_TURN_DELAY_SECONDS * 1000).toISOString(),
        preferred_member_id: remaining[0].member_id,
        target_message_id: published?.inserted?.id || turn.target_message_id || null,
        prepared_payload: remaining,
        processed_at: null,
      }).eq("id", turn.id);
    } else {
      await db.from("ai_turn_queue").update({
        status: "done",
        processed_at: now.toISOString(),
        prepared_payload: [],
      }).eq("id", turn.id);
      await db.from("ai_conversation_threads").update({
        status: "completed",
        completed_at: now.toISOString(),
        last_activity_at: now.toISOString(),
      }).eq("id", thread.id);
      if (thread.thread_type === "autonomous") {
        await db.from("ai_community_state").update({
          next_autonomous_at: new Date(now.getTime() + 60 * 1000).toISOString(),
          updated_at: now.toISOString(),
        }).eq("id", 1);
      }
    }
    return {
      action: "prepared_turn_published",
      speaker: speaker.profile?.nickname || speaker.character_name,
      threadId: thread.id,
      provider: turn.prepared_provider || "local",
    };
  }

  if (["autonomous","event_start","event_winner","welcome","celebration","loss"].includes(thread.thread_type)) {
    await db.from("ai_turn_queue").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", turn.id);
    await db.from("ai_conversation_threads").update({ status: "completed", completed_at: now.toISOString() }).eq("id", thread.id);
    return { action: "legacy_api_turn_cancelled" };
  }

  const context = await recentChatContext(db, Math.min(Number(settings.recent_context_messages || 10), 10));
  const participants = await loadThreadParticipants(db, thread.id, characters);
  let speaker = turn.preferred_member_id ? characters.find((c) => c.member_id === turn.preferred_member_id) : null;
  if (!speaker) speaker = await chooseSpeaker(db, thread, participants, characters, context);
  if (!speaker) {
    await db.from("ai_turn_queue").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", turn.id);
    return { action: "turn_no_speaker" };
  }

  try {
    const generated = await generateTurn(db, thread, speaker, settings, context, turn.target_message_id);
    const published = await publishGeneratedTurn(db, thread, speaker, generated, settings, now, { scheduleNext: false });
    await db.from("ai_turn_queue").update({ status: "done", processed_at: now.toISOString() }).eq("id", turn.id);
    return {
      action: "legacy_single_turn_published",
      speaker: speaker.profile?.nickname || speaker.character_name,
      threadId: thread.id,
      provider: published.provider,
    };
  } catch (error) {
    await db.from("ai_turn_queue").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", turn.id);
    await db.from("ai_conversation_threads").update({ status: "completed", completed_at: now.toISOString() }).eq("id", thread.id);
    await logEngineEvent(db, {
      level: "error",
      category: error?.code || "AI_GENERATION_STOPPED",
      provider: error?.provider || null,
      message: error?.message || "AI 생성 중단",
      meta: { thread_id: thread.id, turn_id: turn.id },
    });
    return { success: false, action: "turn_generation_stopped", error: error?.message || "generation_failed" };
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
    count = Math.min(characters.length, Math.max(Number(settings.celebration_min || 5), randInt(5, 7)));
  } else {
    count = randInt(Number(settings.human_reply_min || 3), Number(settings.human_reply_max || 4));
  }

  let selected = await selectHumanResponders(characters, situation, count, now);
  const mentioned = characters.find((c) => {
    const nickname = c?.profile?.nickname;
    return nickname && String(info.latest.content || "").includes(nickname);
  });
  if (mentioned) selected = [mentioned, ...selected.filter((c) => c.member_id !== mentioned.member_id)].slice(0, count);
  if (!selected.length) return { scheduled: 0, situation };

  await markHumanHandled(db, [info.latest]);
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
    open_question: false,
    priority: situation === "celebration" ? 100 : 90,
    title: `실제회원 ${info.latestProfile?.nickname || "회원"} 대화`,
  });
  await addParticipants(db, thread.id, selected);

  const intent = simpleHumanIntent(info.latest.content);
  let prepared = [];
  let provider = "local";

  if (intent !== "other" || situation !== "general") {
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
  }

  if (!prepared.length) {
    await db.from("ai_conversation_threads").update({ status: "completed", completed_at: now.toISOString() }).eq("id", thread.id);
    return { scheduled: 0, situation };
  }

  await publishPreparedNow(db, thread, characters, settings, prepared, now, provider);
  return { scheduled: prepared.length, situation, provider, apiCalls: provider.startsWith("local") ? 0 : 1 };
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
    open_question: false, priority: 80, title: `${member.nickname} 입장 환영`,
  });
  await addParticipants(db, thread.id, selected);
  const prepared = localWelcomeMessages(selected, member.nickname);
  await publishPreparedNow(db, thread, characters, settings, prepared, now, "local");
  await db.from("ai_community_events").update({ status: "done", processed_at: now.toISOString() }).eq("id", event.id);
  return selected.length;
}


async function startEventCommunityThread(db, communityEvent, characters, settings, now = new Date()) {
  if (!communityEvent?.event_id) {
    await db.from("ai_community_events").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", communityEvent.id);
    return { started: 0, cancelled: true };
  }

  const { data: event } = await db.from("events")
    .select("id,title,event_type,status,starts_at,ends_at")
    .eq("id", communityEvent.event_id)
    .maybeSingle();

  if (!event) {
    await db.from("ai_community_events").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", communityEvent.id);
    return { started: 0, cancelled: true };
  }

  if (communityEvent.event_type === "event_start") {
    if (event.status !== "active" || new Date(event.ends_at).getTime() <= now.getTime()) {
      await db.from("ai_community_events").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", communityEvent.id);
      return { started: 0, cancelled: true };
    }
    const { data: entries } = await db.from("event_entries").select("member_id").eq("event_id", event.id);
    const participantIds = new Set((entries || []).map((row) => row.member_id));
    const participantCharacters = characters.filter((c) => participantIds.has(c.member_id));
    if (!participantCharacters.length) {
      const ageMs = now.getTime() - new Date(communityEvent.created_at).getTime();
      if (ageMs < 4 * 60 * 1000) return { started: 0, deferred: true };
      await db.from("ai_community_events").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", communityEvent.id);
      return { started: 0, cancelled: true };
    }
    const selected = weightedSample(participantCharacters, Math.min(participantCharacters.length, randInt(1, 2)), (c) => Number(c.general_reply_rate || 10) + 5);
    const thread = await insertThread(db, {
      thread_type: "event_start", source_event_id: event.id, status: "active",
      min_turns: selected.length, max_turns: selected.length, energy: 0.82,
      open_question: false, priority: 75, title: `${event.title || "이벤트"} 참가 반응`,
    });
    await addParticipants(db, thread.id, selected);
    await publishPreparedNow(db, thread, characters, settings, localEventMessages(selected, event, null), now, "local");
    await db.from("ai_community_events").update({ status: "done", processed_at: now.toISOString() }).eq("id", communityEvent.id);
    return { started: selected.length, type: "event_start", apiCalls: 0 };
  }

  if (communityEvent.event_type === "event_winner") {
    const winnerId = communityEvent.member_id;
    const { data: winner } = winnerId
      ? await db.from("profiles").select("id,nickname,account_type,approval_status").eq("id", winnerId).maybeSingle()
      : { data: null };
    if (!winner) {
      await db.from("ai_community_events").update({ status: "cancelled", processed_at: now.toISOString() }).eq("id", communityEvent.id);
      return { started: 0, cancelled: true };
    }

    const others = characters.filter((c) => c.member_id !== winner.id);
    const baseCount = winner.account_type === "human" ? randInt(5, 8) : randInt(3, 5);
    let selected = await selectHumanResponders(others, "celebration", Math.min(baseCount, others.length), now);
    const winnerCharacter = characters.find((c) => c.member_id === winner.id);
    if (winnerCharacter && selected.length < 6) selected = [...selected, winnerCharacter];
    if (!selected.length) {
      await db.from("ai_community_events").update({ status: "done", processed_at: now.toISOString() }).eq("id", communityEvent.id);
      return { started: 0, type: "event_winner" };
    }

    const thread = await insertThread(db, {
      thread_type: "event_winner", source_member_id: winner.id, source_event_id: event.id, status: "active",
      min_turns: selected.length, max_turns: selected.length, energy: 0.96,
      open_question: false, priority: 100, title: `${event.title || "이벤트"} 당첨 축하`,
    });
    await addParticipants(db, thread.id, selected);
    await publishPreparedNow(db, thread, characters, settings, localEventMessages(selected, event, winner), now, "local");
    await db.from("ai_community_events").update({ status: "done", processed_at: now.toISOString() }).eq("id", communityEvent.id);
    return { started: selected.length, type: "event_winner", apiCalls: 0 };
  }

  return { started: 0 };
}

async function countActiveAutonomousThreads(db) {
  const { count } = await db.from("ai_conversation_threads").select("id", { count: "exact", head: true })
    .eq("thread_type", "autonomous").eq("status", "active");
  return Number(count || 0);
}

async function startAutonomousThread(db, characters, settings, now = new Date()) {
  if (await hasRecentHuman(db, settings.human_quiet_minutes, now)) return 0;
  const kst = kstParts(now);
  if (kst.minutes >= timeToMinutes(settings.autonomous_last_start_cutoff || "18:20")) return 0;
  const activeCount = await countActiveAutonomousThreads(db);
  if (activeCount >= Number(settings.autonomous_max_active_threads || 3)) return 0;

  const { data: state } = await db.from("ai_community_state").select("next_autonomous_at").eq("id", 1).maybeSingle();
  if (state?.next_autonomous_at && new Date(state.next_autonomous_at).getTime() > now.getTime()) return 0;

  if (activeCount > 0 && Math.random() * 100 >= Number(settings.new_parallel_topic_chance || 32)) {
    await db.from("ai_community_state").update({
      next_autonomous_at: new Date(now.getTime() + 60 * 1000).toISOString(),
      updated_at: now.toISOString(),
    }).eq("id", 1);
    return 0;
  }

  const topic = await pickTopic(db, now);
  if (!topic) return 0;
  const availableCharacters = characters.filter((c) => availableNow(c, now));
  if (availableCharacters.length < 2) return 0;
  const targetCount = Math.min(availableCharacters.length, randInt(2, 4));
  const selected = weightedSample(availableCharacters, targetCount, (c) => topicInterestWeight(c, topic));
  if (selected.length < 2) return 0;

  const localScene = await localAutonomousMessages(db, selected, topic, now);
  const prepared = localScene.messages;
  if (!prepared.length) {
    await db.from("ai_community_state").update({
      next_autonomous_at: new Date(now.getTime() + 60 * 1000).toISOString(),
      updated_at: now.toISOString(),
    }).eq("id", 1);
    return 0;
  }
  const thread = await insertThread(db, {
    thread_type: "autonomous", topic_id: topic.id, status: "active",
    min_turns: prepared.length, max_turns: prepared.length,
    energy: 0.72, open_question: false, priority: 10,
    title: `${topic.category} · ${topic.title}`,
    summary: localScene.meta?.summary || "V18 로컬 오픈채팅 대화",
  });
  await addParticipants(db, thread.id, selected);
  await db.from("ai_topic_history").insert({ topic_id: topic.id, thread_id: thread.id, used_at: now.toISOString() });

  await publishPreparedNow(db, thread, characters, settings, prepared, now, "local");
  await db.from("ai_community_state").update({
    next_autonomous_at: new Date(now.getTime() + 60 * 1000).toISOString(),
    updated_at: now.toISOString(),
  }).eq("id", 1);
  return 1;
}

async function recoverStaleProcessingTurns(db, now = new Date()) {
  const cutoff = new Date(now.getTime() - 3 * 60000).toISOString();
  const { data: stale } = await db.from("ai_turn_queue")
    .select("id")
    .eq("status", "processing")
    .lt("scheduled_at", cutoff);
  const ids = (stale || []).map((row) => row.id);
  if (!ids.length) return 0;
  await db.from("ai_turn_queue").update({
    status: "queued",
    scheduled_at: now.toISOString(),
    processed_at: null,
  }).in("id", ids);
  await logEngineEvent(db, { level: "warning", category: "QUEUE_STALE_RECOVERED", message: `멈춘 processing 큐 ${ids.length}건을 복구했습니다.`, meta: { count: ids.length } });
  return ids.length;
}

async function closeStaleThreads(db, now = new Date()) {
  // 자율대화가 active인데 다음 큐가 사라진 경우 45분 동안 방을 막지 않도록 빠르게 복구합니다.
  const orphanCutoff = new Date(now.getTime() - 4 * 60000).toISOString();
  const { data: candidates } = await db.from("ai_conversation_threads")
    .select("id")
    .eq("thread_type", "autonomous")
    .eq("status", "active")
    .lt("last_activity_at", orphanCutoff);
  const candidateIds = (candidates || []).map((r) => r.id);
  if (candidateIds.length) {
    const { data: pending } = await db.from("ai_turn_queue")
      .select("thread_id")
      .in("thread_id", candidateIds)
      .in("status", ["queued", "processing"]);
    const pendingIds = new Set((pending || []).map((r) => r.thread_id));
    const orphanIds = candidateIds.filter((id) => !pendingIds.has(id));
    if (orphanIds.length) {
      await db.from("ai_conversation_threads").update({
        status: "completed", completed_at: now.toISOString(), last_activity_at: now.toISOString(),
      }).in("id", orphanIds);
      await db.from("ai_community_state").update({
        next_autonomous_at: new Date(now.getTime() + 60 * 1000).toISOString(), updated_at: now.toISOString(),
      }).eq("id", 1);
      await logEngineEvent(db, { level: "warning", category: "AUTONOMOUS_ORPHAN_RECOVERED", message: `다음 턴이 사라진 자율대화 ${orphanIds.length}건을 복구했습니다.`, meta: { thread_ids: orphanIds } });
    }
  }

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
    // 공급자가 잠깐 멈춰도 큐/스레드 복구는 계속 수행합니다.
    await recoverStaleProcessingTurns(db, now);
    await closeStaleThreads(db, now);

    const providerState = await hasUsableProvider(db, now);
    if (!providerState.ok) {
      return { success: false, reason: providerState.reason, error: "현재 사용 가능한 AI 공급자가 없습니다." };
    }

    // 1순위: 실제회원 새 메시지
    const humanInfo = await findLatestUnhandledHuman(db);
    if (humanInfo) {
      const result = await startHumanThread(db, humanInfo, characters, settings, now);
      if (result?.providerError) return { success: false, action: "human_priority_failed", source, ...result.providerError };
      return { success: true, action: "human_priority", source, ...result };
    }

    // 2순위: 이벤트 참가 반응 / 당첨 축하.
    // 실제회원 새 메시지보다는 뒤지만, 일반 자율대화보다 앞에서 처리한다.
    const { data: eventCommunity } = await db.from("ai_community_events").select("*")
      .in("event_type", ["event_winner", "event_start"])
      .eq("status", "pending")
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (eventCommunity) {
      const eventResult = await startEventCommunityThread(db, eventCommunity, characters, settings, now);
      if (eventResult?.providerError) {
        return { success: false, action: "event_community_failed", source, ...eventResult.providerError };
      }
      if (!eventResult?.deferred) {
        return { success: true, action: eventResult?.type || "event_community", source, ...eventResult };
      }
    }

    // 3순위: 시간이 된 '다음 턴' 1개. 문장은 지금 생성한다.
    const due = await getDueTurn(db);
    if (due) {
      const result = await processTurn(db, due, characters, settings, now);
      if (result?.success === false) return { ...result, source };
      return { success: true, source, ...result };
    }

    // 4순위: 신규 실제회원 환영
    const { data: welcome } = await db.from("ai_community_events").select("*")
      .eq("event_type", "member_join").eq("status", "pending")
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (welcome) {
      const queued = await startWelcomeThread(db, welcome, characters, settings, now);
      return { success: true, action: "welcome_thread", queued, source };
    }

    // 5순위: 사람이 조용할 때 새 일상대화 가지 시작. 기존 가지가 살아 있어도 제한적으로 병렬 허용.
    const started = await startAutonomousThread(db, characters, settings, now);
    return { success: true, action: started ? "autonomous_thread_started" : "idle", started, source };
  } catch (error) {
    console.error("AI COMMUNITY V18 ERROR:", error);
    return { success: false, error: error?.message || "AI 커뮤니티 엔진 오류" };
  }
}

export async function getAiCommunityStatus() {
  const db = dbClient();
  if (!db) return { success: false, reason: "supabase_server_env_missing" };
  const [stateRes, settingsRes, aiRes, turnRes, threadRes, relRes, memoryRes, providerRes, logRes] = await Promise.all([
    db.from("ai_community_state").select("*").eq("id", 1).maybeSingle(),
    db.from("ai_community_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("account_type", "ai_character").eq("approval_status", "approved"),
    db.from("ai_turn_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
    db.from("ai_conversation_threads").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("ai_relationships").select("member_low", { count: "exact", head: true }),
    db.from("ai_social_memories").select("id", { count: "exact", head: true }),
    db.from("ai_provider_health").select("provider,status,paused_until,last_error_code,last_error_message,last_success_at,last_error_at,error_count").order("provider"),
    db.from("ai_engine_logs").select("level,category,provider,message,created_at").order("created_at", { ascending: false }).limit(10),
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
    configuredProviders: providerConfig(),
    providerHealth: providerRes.data || [],
    recentEngineLogs: logRes.data || [],
  };
}
