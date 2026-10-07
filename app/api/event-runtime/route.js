import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const QUIZ_SEEDS = [
  ["[상식] 대한민국의 수도는 어디일까요?", "부산", "서울", "대전", "인천", 2],
  ["[상식] 세계에서 가장 넓은 바다는?", "대서양", "인도양", "태평양", "북극해", 3],
  ["[상식] 한글을 창제한 왕은?", "세종대왕", "태조", "정조", "영조", 1],
  ["[상식] 지구에서 가장 큰 대륙은?", "유럽", "아시아", "아프리카", "남아메리카", 2],
  ["[상식] 1년은 평년 기준 며칠일까요?", "360일", "364일", "365일", "366일", 3],
  ["[상식] 올림픽 오륜기의 고리 개수는?", "4개", "5개", "6개", "7개", 2],
  ["[상식] 대한민국의 국화는?", "장미", "무궁화", "진달래", "국화", 2],
  ["[상식] 태양이 뜨는 방향은?", "동쪽", "서쪽", "남쪽", "북쪽", 1],

  ["[과학] 물이 표준 기압에서 어는 온도는?", "0℃", "10℃", "50℃", "100℃", 1],
  ["[과학] 식물이 광합성에 주로 사용하는 기체는?", "산소", "질소", "이산화탄소", "수소", 3],
  ["[과학] 사람의 몸에서 혈액을 순환시키는 기관은?", "폐", "간", "심장", "신장", 3],
  ["[과학] 지구가 태양을 한 바퀴 도는 운동은?", "자전", "공전", "회전", "진동", 2],
  ["[과학] 태양계에서 가장 큰 행성은?", "지구", "화성", "토성", "목성", 4],
  ["[과학] 빛의 속도가 소리의 속도보다 빠를까요?", "빠르다", "느리다", "같다", "상황마다 항상 반대다", 1],
  ["[과학] 사람의 유전 정보를 담는 물질은?", "DNA", "ATP", "단백질", "칼슘", 1],
  ["[과학] 달은 스스로 빛을 낼까요?", "항상 낸다", "태양빛을 반사한다", "밤에만 낸다", "보름달일 때만 낸다", 2],

  ["[넌센스] 세상에서 가장 뜨거운 과일은?", "사과", "천도복숭아", "수박", "포도", 2],
  ["[넌센스] 세상에서 가장 야한 닭은?", "후라이드", "백숙", "홀닥", "양념닭", 3],
  ["[넌센스] 세상에서 가장 쉬운 숫자는?", "190000", "1004", "8282", "7942", 1],
  ["[넌센스] 자동차를 톡 치면 나는 소리는?", "붕붕", "카톡", "빵빵", "부릉", 2],
  ["[넌센스] 세상에서 가장 지루한 중학교는?", "로딩중", "대기중", "게임중", "수업중", 1],
  ["[넌센스] 오리가 얼면?", "언덕", "얼음오리", "동오리", "오리탕", 1],
  ["[넌센스] 세상에서 가장 뜨거운 전화는?", "스마트폰", "무선전화", "화상전화", "공중전화", 3],
  ["[넌센스] 세상에서 가장 잔인한 비빔밥은?", "돌솥비빔밥", "산채비빔밥", "회덮밥", "육회비빔밥", 1],
];

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function stablePercent(...parts) {
  const hex = createHash("sha256").update(parts.join(":"), "utf8").digest("hex").slice(0, 8);
  return parseInt(hex, 16) % 100;
}

function stableIndex(length, ...parts) {
  if (!length) return 0;
  const hex = createHash("sha256").update(parts.join(":"), "utf8").digest("hex").slice(0, 8);
  return parseInt(hex, 16) % length;
}

function quizCategory(question) {
  const text = String(question || "");
  if (text.startsWith("[상식]")) return { key: "상식", title: "🧠 상식 퀴즈" };
  if (text.startsWith("[과학]")) return { key: "과학", title: "🔬 과학 퀴즈" };
  if (text.startsWith("[넌센스]")) return { key: "넌센스", title: "😄 넌센스 퀴즈" };
  return { key: "퀴즈", title: "🧩 오늘의 퀴즈" };
}

async function ensureQuizBank(db) {
  const questions = QUIZ_SEEDS.map((q) => q[0]);
  const { data: existing } = await db.from("event_quiz_bank").select("question").in("question", questions);
  const have = new Set((existing || []).map((row) => row.question));
  const missing = QUIZ_SEEDS.filter((q) => !have.has(q[0])).map((q) => ({
    question: q[0], option_1: q[1], option_2: q[2], option_3: q[3], option_4: q[4], correct_option: q[5], active: true,
  }));
  if (missing.length) await db.from("event_quiz_bank").insert(missing);
}

async function ensureQuizSetup(db, event) {
  if (event.event_type !== "quiz") return null;

  let { data: secret } = await db.from("event_game_secrets")
    .select("secret_answer").eq("event_id", event.id).maybeSingle();
  let quiz = null;

  if (secret?.secret_answer) {
    const { data } = await db.from("event_quiz_bank")
      .select("id,question,option_1,option_2,option_3,option_4,correct_option")
      .eq("id", secret.secret_answer).eq("active", true).maybeSingle();
    quiz = data || null;
  }

  if (!quiz) {
    const { data: bank } = await db.from("event_quiz_bank")
      .select("id,question,option_1,option_2,option_3,option_4,correct_option")
      .eq("active", true).limit(200);
    if (!bank?.length) return null;
    quiz = bank[stableIndex(bank.length, event.id, "quiz")];
    await db.from("event_game_secrets").upsert({ event_id: event.id, secret_answer: quiz.id }, { onConflict: "event_id" });
    secret = { secret_answer: quiz.id };
  }

  const category = quizCategory(quiz.question);
  if (event.title !== category.title) {
    await db.from("events").update({
      title: category.title,
      description: `${category.key} 문제입니다. 4개의 보기 중 정답 하나를 선택하세요.`,
    }).eq("id", event.id);
  }
  return quiz;
}

async function findAdmin(db) {
  const { data } = await db.from("profiles")
    .select("id,nickname")
    .eq("role", "admin")
    .eq("approval_status", "approved")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function ensureAnnouncement(db, event, admin) {
  if (!admin || event.status !== "active") return false;
  const since = new Date(new Date(event.starts_at || Date.now()).getTime() - 60_000).toISOString();
  const { data: recent } = await db.from("group_messages")
    .select("id,content,created_at")
    .eq("room_id", event.room_id)
    .eq("message_type", "event")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);

  const exists = (recent || []).some((row) => String(row.content || "").includes(event.id));
  if (exists) return false;

  const endText = event.ends_at
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(event.ends_at))
    : "진행 중";
  const content = [
    "🎁 LIVE EVENT 시작",
    "",
    event.title || "이벤트",
    event.description || "지금 이벤트 메뉴에서 참여할 수 있습니다.",
    event.prize ? `🎁 상품: ${event.prize}` : "",
    `⏰ 종료: ${endText}`,
    "",
    "이벤트 메뉴에서 바로 참여해주세요.",
    `event:${event.id}`,
  ].filter(Boolean).join("\n");

  const { error } = await db.from("group_messages").insert({
    room_id: event.room_id,
    member_id: admin.id,
    message_type: "event",
    content,
    is_deleted: false,
  });
  if (error) throw error;
  return true;
}

async function ensureCommunityEvent(db, event) {
  const { data: rows } = await db.from("ai_community_events")
    .select("id").eq("event_type", "event_started").eq("source_key", String(event.id)).limit(1);
  if (rows?.length) return;
  const { error } = await db.from("ai_community_events").insert({
    event_type: "event_started",
    member_id: null,
    source_key: String(event.id),
    status: "pending",
  });
  if (error && error.code !== "23505") console.warn("event_started queue insert failed", error.message);
}

async function aiCharacters(db) {
  const { data } = await db.from("profiles")
    .select("id,nickname,account_type,ai_chat_enabled,approval_status")
    .eq("account_type", "ai_character")
    .eq("approval_status", "approved")
    .eq("ai_chat_enabled", true)
    .limit(100);
  return data || [];
}

async function ensureAiParticipation(db, event, characters, quiz) {
  if (event.status !== "active" || !characters.length) return 0;
  const now = Date.now();
  const start = new Date(event.starts_at || 0).getTime();
  if (!start || now < start) return 0;
  const ageSeconds = (now - start) / 1000;
  if (event.event_type === "first_come" && ageSeconds < 120) return 0;
  if (event.event_type !== "first_come" && ageSeconds < 30) return 0;

  const { data: existing } = await db.from("event_entries").select("member_id").eq("event_id", event.id);
  const joined = new Set((existing || []).map((row) => row.member_id));

  if (event.event_type === "first_come" && joined.size > 0) return 0;

  let secret = null;
  const { data: secretRow } = await db.from("event_game_secrets")
    .select("secret_answer").eq("event_id", event.id).maybeSingle();
  secret = secretRow?.secret_answer || null;

  const candidates = characters.filter((c) => !joined.has(c.id) && stablePercent(event.id, c.id, "event-participation") < 30);
  const chosen = event.event_type === "first_come" ? candidates.slice(0, 1) : candidates;
  if (!chosen.length) return 0;

  const rows = chosen.map((c) => {
    let answer = null;
    let correct = null;
    if (event.event_type === "quiz") {
      answer = String(1 + stableIndex(4, event.id, c.id, "quiz-answer"));
      correct = quiz?.correct_option ? Number(answer) === Number(quiz.correct_option) : null;
    } else if (event.event_type === "gift_box") {
      answer = String(1 + stableIndex(4, event.id, c.id, "gift-answer"));
      correct = secret ? answer === String(secret) : null;
    } else if (event.event_type === "number") {
      answer = String(1 + stableIndex(100, event.id, c.id, "number-answer"));
      correct = secret ? answer === String(secret) : null;
    } else if (event.event_type === "roulette") answer = "roulette";
    else if (event.event_type === "draw") answer = "draw";
    else if (event.event_type === "attendance") answer = "attendance";
    else if (event.event_type === "first_come") { answer = "first_come"; correct = true; }

    return {
      event_id: event.id,
      member_id: c.id,
      answer,
      is_correct: correct,
      result_text: `AI 자동 ${event.event_type} 참여`,
      submitted_at: new Date().toISOString(),
    };
  });

  const { error } = await db.from("event_entries").upsert(rows, { onConflict: "event_id,member_id", ignoreDuplicates: true });
  if (error) throw error;

  if (event.event_type === "attendance") {
    const attendance = chosen.map((c) => ({ event_id: event.id, member_id: c.id, attendance_date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }) }));
    await db.from("attendance_records").upsert(attendance, { onConflict: "event_id,member_id", ignoreDuplicates: true });
  }
  return rows.length;
}

export async function POST() {
  const db = dbClient();
  if (!db) return Response.json({ ok: false, error: "server_not_configured" }, { status: 500 });

  try {
    await ensureQuizBank(db);
    const admin = await findAdmin(db);
    const characters = await aiCharacters(db);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const { data: events, error } = await db.from("events")
      .select("id,room_id,title,description,prize,event_type,status,starts_at,ends_at,auto_event,schedule_date")
      .eq("auto_event", true)
      .eq("schedule_date", today)
      .in("status", ["scheduled", "active"])
      .order("starts_at", { ascending: true });
    if (error) throw error;

    let announcements = 0;
    let aiEntries = 0;
    for (const original of events || []) {
      const quiz = await ensureQuizSetup(db, original);
      const event = quiz && original.event_type === "quiz"
        ? { ...original, title: quizCategory(quiz.question).title, description: `${quizCategory(quiz.question).key} 문제입니다. 4개의 보기 중 정답 하나를 선택하세요.` }
        : original;
      if (event.status === "active") {
        if (await ensureAnnouncement(db, event, admin)) announcements += 1;
        await ensureCommunityEvent(db, event);
        aiEntries += await ensureAiParticipation(db, event, characters, quiz);
      }
    }

    return Response.json({ ok: true, announcements, aiEntries, quizSeeds: QUIZ_SEEDS.length });
  } catch (error) {
    console.error("event runtime error", error);
    return Response.json({ ok: false, error: error?.message || "event_runtime_failed" }, { status: 500 });
  }
}
