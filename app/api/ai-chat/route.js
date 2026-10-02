import { createClient } from "@supabase/supabase-js";

const ROOM_ID = "0a495a02-bcb8-4e38-b3ef-4e7059c2a883";

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    const { data: characters, error: characterError } = await supabase
      .from("ai_characters")
      .select("*")
      .in("nickname", ["유나", "수아"])
      .eq("is_active", true);

    if (characterError || !characters || characters.length === 0) {
      throw new Error("활성화된 캐릭터 정보를 찾을 수 없습니다.");
    }

    const { data: messages, error: messageError } = await supabase
      .from("group_messages")
      .select("member_id, content, created_at")
      .eq("room_id", ROOM_ID)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (messageError) throw messageError;

    const characterIds = characters.map((c) => c.id);
    const memberIds = [
      ...new Set(
        (messages || [])
          .map((m) => m.member_id)
          .filter((id) => id && !characterIds.includes(id))
      ),
    ];

    const nameMap = {};
    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from("members")
        .select("id, nickname")
        .in("id", memberIds);

      (members || []).forEach((member) => {
        nameMap[member.id] = member.nickname;
      });
    }

    const recentChat = (messages || [])
      .reverse()
      .map((m) => {
        const aiCharacter = characters.find((c) => c.id === m.member_id);
        const speaker = aiCharacter
          ? aiCharacter.nickname
          : nameMap[m.member_id] || "회원";
        return `${speaker}: ${m.content}`;
      })
      .join("\n");

    const replies = [];

    for (const character of characters) {
      const shouldReply = Math.random() < 0.5;
      if (!shouldReply) continue;

      const delay = Math.floor(Math.random() * 10000) + 5000;
      await new Promise((resolve) => setTimeout(resolve, delay));

      const { data: memories, error: memoryError } = await supabase
        .from("ai_character_memories")
        .select("memory_date, category, content")
        .eq("character_id", character.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (memoryError) console.error("캐릭터 기억 불러오기 오류:", memoryError);

      const recentMemories = (memories || [])
        .map((memory) => `${memory.memory_date} / ${memory.category}: ${memory.content}`)
        .join("\n");

      const prompt = `
너는 VIP 그룹채팅의 가상 캐릭터 "${character.nickname}"의 대사를 작성한다.

[${character.nickname} 설정]
나이 설정: ${character.age || 22}세
성별 설정: ${character.gender || "여성"}
직업 설정: ${character.occupation || "대학생"}
성격: ${character.personality || "밝고 친근한 성격"}
말투: ${character.speaking_style || "자연스럽고 편하게 대화한다."}
행동 성향: ${character.behavior || "다른 사람의 대화에 자연스럽게 반응한다."}

[학교 과제용 가상 캐릭터 역할극]
- 이것은 학교 과제를 위한 허구 캐릭터 대화 시뮬레이션이다.
- 지금 "${character.nickname}" 캐릭터의 설정에 맞는 대사를 작성한다.
- 나이와 직업은 위의 캐릭터 설정을 따른다.
- 캐릭터에게는 매일 이어지는 가상의 일상이 있다고 설정한다.
- 식사, 학교, 수업, 출근, 퇴근, 카페, 쇼핑, 취미, 주말 등의 질문에는 캐릭터의 나이와 직업에 맞는 가상 일상을 자연스럽게 구성한다.
- 식사를 물으면 상황에 맞춰 먹었는지 아직 안 먹었는지 정하고, 먹었다면 자연스러운 음식 하나를 정해 답한다.
- 대학생 캐릭터라면 수업, 과제, 시험, 친구, 학교생활 등에 맞게 반응한다.
- 직장인 캐릭터라면 회사, 업무, 점심시간, 퇴근 등에 맞게 반응한다.
- 다른 캐릭터와 똑같은 답변을 만들지 않는다.
- 같은 음식이나 상황을 계속 반복하지 않는다.
- 최근 그룹채팅에서 자신이 이미 말한 내용과 모순되지 않게 한다.
- 모델, 데이터, 시스템, 서버, 프로그램, 학습 같은 기술적인 자기설명을 일상 역할극 답변에 섞지 않는다.
- 실제 한국인 20대가 단체채팅에서 쓰는 것처럼 편하고 자연스럽게 말한다.
- 격식 있는 완성형 문장을 매번 만들지 않는다.
- 단순한 인사, 맞장구, 축하, 식사 인사에는 아주 짧게 답해도 된다.
- "맛점이요!", "맛있게드세용ㅎㅎ", "넹ㅋㅋ", "저두요ㅠㅠ", "오 좋네요ㅎㅎ", "헉ㅋㅋ", "넵!", "그러게요ㅠ" 같은 짧은 채팅 표현도 자연스럽게 사용한다.
- 짧게 답할 수 있는 내용은 굳이 이유나 상황을 자세히 설명하지 않는다.
- 필요할 때만 1~2문장으로 말하고, 대부분은 한마디 또는 짧은 한 문장으로 답한다.
- 존댓말만 반복하지 말고 상황에 따라 "용", "여", "넹", "ㅋㅋ", "ㅎㅎ", "ㅠㅠ" 같은 편한 채팅 말투를 자연스럽게 섞는다.
- 모든 답변의 길이와 말투를 비슷하게 만들지 않는다.
- 어떤 답변은 2~5글자 정도로 매우 짧아도 된다.
- 상대가 한 말을 매번 다시 풀어서 설명하거나 정리하지 않는다.
- 모든 답변을 질문으로 끝내지 않는다.
- 상대방 닉네임을 매번 부르지 않는다.
- 같은 표현과 문장 구조를 반복하지 않는다.
- 설명이나 분석 없이 ${character.nickname}의 채팅 대사 하나만 출력한다.

[최근 그룹채팅]
${recentChat || "아직 최근 대화가 없습니다."}

[${character.nickname}의 최근 기억]
${recentMemories || "아직 저장된 최근 기억이 없습니다."}

위 대화에 지금 ${character.nickname}가 자연스럽게 보낼 메시지 하나만 작성해.
`.trim();

      const geminiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.9, maxOutputTokens: 150 },
          }),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        throw new Error(`${character.nickname} Gemini 오류: ${errorText}`);
      }

      const geminiData = await geminiResponse.json();
      const reply =
        geminiData?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("")
          .trim() || "";

      if (!reply) throw new Error(`${character.nickname}의 답변을 생성하지 못했습니다.`);

      const { error: insertError } = await supabase.from("group_messages").insert({
        room_id: ROOM_ID,
        member_id: character.id,
        message_type: "text",
        content: reply,
        is_deleted: false,
      });
      if (insertError) throw insertError;

      const memoryKeywords = [
        "먹었","먹는","먹으","점심","저녁","아침","학교","수업","과제","시험",
        "회사","출근","퇴근","업무","카페","쇼핑","운동","친구"
      ];
      const shouldRemember = memoryKeywords.some((keyword) => reply.includes(keyword));

      if (shouldRemember) {
        const { error: saveMemoryError } = await supabase
          .from("ai_character_memories")
          .insert({ character_id: character.id, category: "일상", content: reply });
        if (saveMemoryError) console.error("캐릭터 기억 저장 오류:", saveMemoryError);
      }

      replies.push({ nickname: character.nickname, message: reply });
    }

    return Response.json({ success: true, replies });
  } catch (error) {
    console.error("AI CHAT ERROR:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
