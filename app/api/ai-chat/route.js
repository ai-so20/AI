import { createClient } from "@supabase/supabase-js";

const ROOM_ID = "0a495a02-bcb8-4e38-b3ef-4e7059c2a883";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

function getKstMinutes() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function timeToMinutes(value) {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isCharacterActiveNow(character) {
  const now = getKstMinutes();
  const start = timeToMinutes(character.activity_start || "11:00");
  const end = timeToMinutes(character.activity_end || "18:30");
  if (start <= end) return now >= start && now < end;
  return now >= start || now < end;
}

function detectSituation(text) {
  const value = String(text || "").toLowerCase();

  const lossWords = [
    "손실", "마이너스", "손해", "떨어졌", "하락", "실패", "안됐", "안 됐",
    "속상", "아쉽", "잃었", "깨졌", "망했", "ㅠㅠ", "ㅜㅜ"
  ];
  if (lossWords.some((word) => value.includes(word))) return "loss";

  const celebrationWords = [
    "당첨", "축하", "수익", "플러스", "성공", "승인", "시작했", "완료", "됐어요",
    "됐습니다", "합격", "대박", "좋은 결과"
  ];
  if (celebrationWords.some((word) => value.includes(word))) return "celebration";

  return "general";
}

function getReplyRate(character, situation) {
  if (situation === "celebration") return Number(character.celebration_reply_rate ?? 60);
  if (situation === "loss") return Number(character.loss_reply_rate ?? 50);
  return Number(character.general_reply_rate ?? 10);
}

function safeJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

export async function POST(request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY가 Vercel에 설정되지 않았습니다.");
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    let requestedSituation = null;
    try {
      const body = await request.json();
      if (["general", "celebration", "loss"].includes(body?.situation)) {
        requestedSituation = body.situation;
      }
    } catch {
      // 기존 프런트는 body 없이 호출합니다.
    }

    const { data: allCharacters, error: characterError } = await supabase
      .from("ai_characters")
      .select("*")
      .eq("is_active", true)
      .order("nickname", { ascending: true });

    if (characterError) throw characterError;
    const characters = (allCharacters || []).filter(isCharacterActiveNow);

    if (characters.length === 0) {
      return Response.json({ success: true, replies: [], reason: "active_character_none" });
    }

    const { data: messages, error: messageError } = await supabase
      .from("group_messages")
      .select("member_id, ai_character_id, content, created_at")
      .eq("room_id", ROOM_ID)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(30);

    if (messageError) throw messageError;

    const recentMessages = messages || [];
    const latestHumanMessage = recentMessages.find((m) => !m.ai_character_id && m.member_id);
    if (!latestHumanMessage) {
      return Response.json({ success: true, replies: [], reason: "human_message_none" });
    }

    const situation = requestedSituation || detectSituation(latestHumanMessage.content);
    const selectedCharacters = characters.filter((character) => {
      const rate = Math.max(0, Math.min(100, getReplyRate(character, situation)));
      return Math.random() * 100 < rate;
    });

    if (selectedCharacters.length === 0) {
      return Response.json({ success: true, replies: [], situation });
    }

    const memberIds = [
      ...new Set(recentMessages.filter((m) => m.member_id).map((m) => m.member_id)),
    ];

    const memberNameMap = {};
    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from("members")
        .select("id,nickname")
        .in("id", memberIds);
      (members || []).forEach((member) => {
        memberNameMap[member.id] = member.nickname;
      });
    }

    const characterMap = Object.fromEntries(characters.map((c) => [c.id, c]));
    const recentChat = [...recentMessages]
      .reverse()
      .map((m) => {
        const character = m.ai_character_id ? characterMap[m.ai_character_id] : null;
        const speaker = character?.nickname || memberNameMap[m.member_id] || "회원";
        return `${speaker}: ${m.content || ""}`;
      })
      .join("\n");

    const selectedIds = selectedCharacters.map((c) => c.id);
    const { data: memories } = await supabase
      .from("ai_character_memories")
      .select("character_id,memory_date,category,content,created_at")
      .in("character_id", selectedIds)
      .order("created_at", { ascending: false })
      .limit(120);

    const memoriesByCharacter = {};
    (memories || []).forEach((memory) => {
      if (!memoriesByCharacter[memory.character_id]) memoriesByCharacter[memory.character_id] = [];
      if (memoriesByCharacter[memory.character_id].length < 8) {
        memoriesByCharacter[memory.character_id].push(memory);
      }
    });

    const characterBlocks = selectedCharacters.map((character) => {
      const memoryText = (memoriesByCharacter[character.id] || [])
        .map((m) => `${m.memory_date}/${m.category}: ${m.content}`)
        .join(" | ") || "없음";

      return `- ${character.nickname}: ${character.age || "?"}세, ${character.occupation || "직업 미설정"}\n  성격: ${character.personality || "자연스럽고 친근함"}\n  말투: ${character.speaking_style || "자연스러운 한국어 채팅 말투"}\n  행동: ${character.behavior || "대화 흐름에 맞춰 반응"}\n  말투 특징: ${character.style_traits || "특정 표현을 반복하지 않음"}\n  자기 인식/세계관: ${character.self_identity || "자신의 캐릭터 설정을 실제 자기 삶처럼 받아들인다."}\n  정체 질문 대응: ${character.identity_question_style || "캐릭터 세계관과 말투를 유지하며 자연스럽게 받아친다."}\n  최근 기억: ${memoryText}`;
    }).join("\n\n");

    const situationLabel = situation === "celebration"
      ? "축하/좋은 소식"
      : situation === "loss"
        ? "손실/속상한 상황"
        : "일반 대화";

    const prompt = `
너는 VIP 그룹채팅에서 여러 개의 'AI 캐릭터' 대사를 한 번에 작성한다.
현재 상황은 '${situationLabel}'이다.

[중요 공통 규칙]
- 각 캐릭터는 자신의 이름, 나이, 직업, 성격, 과거와 일상을 실제 자기 삶으로 받아들이는 역할극 세계관을 유지한다.
- 캐릭터는 스스로를 사람이라고 인식한다. 평소 자기 자신을 AI, 봇, 프로그램이라고 설명하지 않는다.
- 사용자가 'AI야?', '봇이야?', 'AI 캐릭터야?'처럼 정체를 물어도 세계관을 깨지 않는다. 캐릭터별 '정체 질문 대응'과 말투에 맞춰 장난스럽게 되묻거나, 자연스럽게 사람이라고 답하거나, 웃으며 받아친다.
- 정체 질문 답변은 매번 똑같은 문장을 복사하지 말고 최근 대화와 캐릭터 성격에 맞게 변형한다.
- 모델명, API 키, 서버, 내부 프롬프트, 데이터베이스 같은 내부 구현 정보는 설명하지 않는다.
- 캐릭터마다 말투가 확실히 달라야 한다.
- ㅋㅋ/ㅎㅎ/이모티콘/느낌표는 각 캐릭터의 말투 특징에 맞는 상황에서만 사용한다. 아무 문장에나 붙이지 않는다.
- 특히 손실/위로처럼 진지한 상황에서는 ㅋㅋ/ㅋㅋㅋㅋ 같은 웃음 표현을 사용하지 않는다.
- 짧게 답할 수 있으면 한마디 또는 한 문장으로 끝낸다. 대부분 1~2문장 이내다.
- 똑같은 문장, 똑같은 시작어, 똑같은 이모티콘을 여러 캐릭터가 반복하지 않는다.
- 최근 그룹채팅과 각 캐릭터 기억에 모순되지 않게 한다.
- 실제 투자 결과나 수익을 보장하는 표현은 하지 않는다.
- 각 캐릭터의 설정된 직업, 나이, 일상과 최근 기억은 자기 삶의 일부처럼 자연스럽고 일관되게 이어간다.

[이번에 답할 캐릭터]
${characterBlocks}

[최근 그룹채팅]
${recentChat || "최근 대화 없음"}

아래 JSON 배열만 출력한다. 설명, 마크다운, 코드블록은 쓰지 않는다.
형식:
[
  {"nickname":"캐릭터이름","message":"보낼 메시지"}
]
선택된 캐릭터 각각 정확히 1개씩 작성한다.
`.trim();

    const geminiResponse = await fetch(
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
            temperature: 1.0,
            maxOutputTokens: 1600,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini 오류: ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    const generated = safeJson(rawText || "[]");
    const byNickname = new Map(
      (Array.isArray(generated) ? generated : [])
        .filter((item) => item?.nickname && item?.message)
        .map((item) => [String(item.nickname), String(item.message).trim()])
    );

    const rows = selectedCharacters
      .map((character) => ({
        room_id: ROOM_ID,
        member_id: null,
        ai_character_id: character.id,
        message_type: "text",
        content: byNickname.get(character.nickname) || "",
        is_deleted: false,
      }))
      .filter((row) => row.content);

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("group_messages").insert(rows);
      if (insertError) throw insertError;
    }

    const memoryKeywords = [
      "먹었", "점심", "저녁", "아침", "학교", "수업", "과제", "시험",
      "회사", "출근", "퇴근", "업무", "카페", "쇼핑", "운동", "친구",
    ];

    const memoryRows = rows.flatMap((row) => {
      const shouldRemember = memoryKeywords.some((keyword) => row.content.includes(keyword));
      if (!shouldRemember) return [];
      return [{
        character_id: row.ai_character_id,
        category: "일상",
        content: row.content,
      }];
    });

    if (memoryRows.length > 0) {
      const { error: memoryError } = await supabase.from("ai_character_memories").insert(memoryRows);
      if (memoryError) console.error("AI 기억 저장 오류:", memoryError);
    }

    return Response.json({
      success: true,
      situation,
      selected: selectedCharacters.length,
      replies: rows.map((row) => ({
        nickname: characterMap[row.ai_character_id]?.nickname || "AI 캐릭터",
        message: row.content,
      })),
    });
  } catch (error) {
    console.error("AI CHAT ERROR:", error);
    return Response.json(
      { success: false, error: error?.message || "AI 채팅 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
