import fs from 'node:fs';

let community = fs.readFileSync('app/lib/ai-community.js','utf8');
let css = fs.readFileSync('app/globals.css','utf8');

function replaceOnce(source, from, to, label){
  const next = source.replace(from,to);
  if(next === source) throw new Error('anchor not found: '+label);
  return next;
}

community = replaceOnce(
  community,
  '  celebration: ["와 축하해요!", "오 대박 축하드려요ㅎㅎ", "헉 축하해요ㅋㅋ", "와 이건 좀 부럽네요", "좋은 소식이네요. 축하해요!"],',
  '  celebration: ["축하드립니다!!", "축하드려요~~!", "축하해용!", "당첨 축하드려요!", "당첨 축하해요", "추카추카~~~~", "축하해요~", "좋은 결과 축하드립니다!", "축하합니당~", "진심으로 축하드려요!"],',
  'celebration local reactions'
);

const dailyOpeners = `const LOCAL_DAILY_OPENERS = [
  () => "오늘은 유난히 시간이 빨리 가는 느낌이네요.",
  () => "요즘 집에 들어가면 바로 눕고 싶더라고요ㅎㅎ",
  () => "이번 주는 왜 이렇게 길게 느껴지는지 모르겠어요.",
  () => "요즘은 저녁 메뉴 고르는 게 제일 어렵네요.",
  () => "오늘은 괜히 달달한 게 하나 땡기네요.",
  () => "저는 요즘 잠깐 걷는 시간이 꽤 좋더라고요.",
  () => "최근에 집 정리 조금 했더니 생각보다 속이 시원하네요.",
  () => "요즘은 새로 사는 것보다 있는 걸 잘 쓰게 돼요.",
  () => "주말 계획 아직 하나도 안 정했어요ㅋㅋ",
  () => "저는 요즘 음악을 예전에 듣던 것만 다시 듣게 돼요.",
  () => "오늘은 이상하게 계속 간식 생각이 나네요.",
  () => "요즘 사진 정리 미뤄둔 게 너무 많아요.",
  () => "저는 요즘 배달을 좀 줄여보려고 하는 중이에요.",
  () => "오늘은 그냥 조용히 쉬고 싶은 날이네요.",
  () => "요즘은 잠깐 멍하니 있는 시간도 괜찮더라고요.",
  () => "저는 최근에 이어폰 없이 걷는 게 은근 좋더라고요.",
  () => "오늘 집 가는 길에 편의점 들를까 고민 중이에요.",
  () => "요즘은 아침보다 저녁 시간이 훨씬 편해요.",
  () => "저는 주말 약속을 너무 많이 안 잡으려고 해요.",
  () => "오늘은 따뜻한 거 하나 마시면 딱 좋을 것 같아요.",
  () => "요즘은 하루가 끝나면 시간이 어디 갔나 싶어요.",
  () => "저는 빨래 돌려놓고 까먹는 일이 자꾸 생기네요ㅋㅋ",
  () => "요즘 집에 있는 시간이 생각보다 편해졌어요.",
  () => "오늘은 뭔가 집중이 잘 안 되는 날이네요.",
  () => "저는 요즘 자기 전에 영상 하나만 보려다가 계속 늦게 자요.",
  () => "이번 주말엔 그냥 늦잠 좀 자고 싶네요.",
  () => "요즘 옷 입기가 애매해서 아침마다 고민돼요.",
  () => "오늘은 커피를 마셨는데도 졸리네요ㅎㅎ",
  () => "저는 요즘 알람 한 번에 못 일어나겠어요.",
  () => "집에 쌓인 택배 박스부터 정리해야 하는데 계속 미루는 중이에요.",
  () => "요즘 뭐 하나 사려다가도 꼭 한 번 더 고민하게 되네요.",
  () => "오늘은 유난히 밖에 나가기 귀찮네요ㅋㅋ",
  () => "저는 요즘 냉장고에 뭐 있는지도 모르고 또 장을 봐요.",
  () => "요즘 하루에 물을 좀 더 마셔보려고 하는데 쉽지 않네요.",
  () => "저는 최근에 방 조명 하나 바꿨는데 분위기가 꽤 달라졌어요.",
  () => "오늘은 저녁 먹고 아무것도 안 하고 쉬고 싶어요.",
  () => "요즘은 작은 일 하나 끝내도 괜히 뿌듯하더라고요.",
  () => "저는 요즘 주말 아침이 제일 좋더라고요.",
  () => "오늘은 괜히 평소 안 먹던 게 생각나네요.",
  () => "요즘은 휴대폰 내려놓고 있는 시간이 생각보다 어렵네요.",
  () => "저는 최근에 오래 안 쓰던 물건들 조금씩 버리는 중이에요.",
  () => "오늘 할 일 하나만 딱 끝내고 쉬고 싶네요.",
  () => "요즘은 날씨보다 실내 온도 맞추는 게 더 어렵네요.",
  () => "저는 요즘 밤에 잠깐 창문 열어두는 게 좋더라고요.",
  () => "오늘은 뭔가 맛있는 걸 먹어야 기분이 풀릴 것 같아요.",
  () => "요즘은 예전 사진 보면 시간이 진짜 빨랐구나 싶어요.",
  () => "저는 최근에 미뤄둔 연락 하나 했더니 마음이 편해졌어요.",
  () => "오늘은 그냥 평범해서 오히려 좋은 날인 것 같아요.",
  () => "요즘 작은 루틴 하나 만들어보려고 하는데 오래 갈지 모르겠어요.",
  () => "저는 집에 오면 제일 먼저 편한 옷부터 갈아입어요ㅋㅋ",
];

`;
community = replaceOnce(community,'const LOCAL_OPENERS = [',dailyOpeners+'const LOCAL_OPENERS = [','daily opener insert');
community = replaceOnce(community,'  const availableOpeners = LOCAL_OPENERS\n','  const availableOpeners = LOCAL_DAILY_OPENERS\n','autonomous opener source');
community = community.replaceAll('randInt(5, 10) * 60 * 1000','randInt(3, 6) * 60 * 1000');

const dailyLockFn = `async function loadTodayCelebrationLocks(db, now = new Date()) {
  const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const { data } = await db.from("group_messages")
    .select("content")
    .eq("room_id", AI_ROOM_ID)
    .eq("is_deleted", false)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(500);
  return new Set((data || []).map((row) => String(row.content || "").trim()).filter(Boolean));
}

`;
community = replaceOnce(community,'function localEventMessages(selected, event, winner = null) {',dailyLockFn+'function localEventMessages(selected, event, winner = null, dailyLocks = new Set()) {','celebration lock insert');

community = community.replace(/  if \(winner\) \{[\s\S]*?\n  \}\n  const eventType =/m, `  if (winner) {
    const winnerCharacter = selected.find((c) => c.member_id === winner.id) || null;
    const others = selected.filter((c) => c.member_id !== winner.id);
    const split = Math.min(others.length, randInt(1, 2));
    const ordered = winnerCharacter
      ? [...others.slice(0, split), winnerCharacter, ...others.slice(split)]
      : others;
    const prize = String(event?.prize || "").trim();
    const winnerName = String(winner?.nickname || "당첨자").trim();
    const winnerThanks = [
      "감사합니다~!", "감사해요!!", "감사합니당~!", "정말 감사합니다!", "고마워요~!", "감사드려요!",
      prize && prize !== "VIP EVENT 당첨" ? \`${'${prize}'} 잘 받을게요 감사합니다!\` : "잘 받을게요 감사합니다!",
      "기분 좋네요 감사합니다~", "축하해주셔서 감사해요!", "감사합니다 잘 쓸게요~"
    ].filter(Boolean);
    const congrats = [
      "축하드립니다!!", "축하드려요~~!", "축하해용!", \`${'${winnerName}'}님 축하합니다\`, \`${'${winnerName}'}님 축하드려요~\`,
      \`축하드립니당 ${'${winnerName}'}님\`, "당첨 축하드려요!", "당첨 축하해요", "추카추카~~~~", "축하해요~",
      "진심으로 축하드립니다!", "좋은 결과 축하드려요!", \`${'${winnerName}'}님 당첨 축하해요!\`, \`${'${winnerName}'}님 축하드립니다~\`,
      "당첨 정말 축하드려요!", "축하합니당~~", "축하축하!!", "당첨 축하드립니다!", "축하드려용~", "축하해요!!",
      \`축하합니다 ${'${winnerName}'}님!\`, \`${'${winnerName}'}님 축하해요~\`, "축하드려요!", "당첨 축하해용!", "축하합니다~!",
      "축하드립니당!", \`${'${winnerName}'}님 당첨 축하드립니다\`, "당첨되신 거 축하해요~", "축하 많이 드려요!", "오늘 좋은 소식 축하드려요!",
      "기분 좋은 당첨 축하합니다!", "축하드려요 좋은 결과네요!", \`${'${winnerName}'}님 좋은 결과 축하해요\`, "당첨 축하합니다~", "축하해용~~",
      "축하드려요 :) ", "좋은 소식 축하드립니당!", "당첨 정말 축하해요!", \`${'${winnerName}'}님 축하축하!\`, "축하드립니다~!"
    ];
    const used = new Set(dailyLocks);
    return ordered.map((c) => {
      const pool = c.member_id === winner.id ? winnerThanks : congrats;
      let candidates = pool.filter((text) => !used.has(String(text).trim()));
      if (!candidates.length) candidates = pool;
      const message = String(pickOne(candidates)).trim();
      used.add(message);
      return { member_id: c.member_id, message: trimChatMessage(message, 110), act: "celebration" };
    });
  }
  const eventType =`);

community = replaceOnce(
  community,
  '    await publishPreparedNow(db, thread, characters, settings, localEventMessages(selected, event, winner), now, "local");',
  '    const dailyCelebrationLocks = await loadTodayCelebrationLocks(db, now);\n    await publishPreparedNow(db, thread, characters, settings, localEventMessages(selected, event, winner, dailyCelebrationLocks), now, "local");',
  'winner daily lock call'
);

community = community.replace(/  const providerState = await hasUsableProvider\(db, now\);\n  if \(!providerState\.ok\) \{\n    return \{ success: false, reason: providerState\.reason, error: "현재 사용 가능한 AI 공급자가 없습니다\." \};\n  \}\n/m,
`  // 로컬 자율대화와 이벤트 반응은 AI 공급자 상태와 무관하게 계속 동작합니다.
  // 실제회원 문맥 생성은 공급자 호출이 실패하면 기존 로컬 fallback을 사용합니다.
`);

community = community.replace(/const thanks = \[[\s\S]*?\n    \];\n    return thanks\[randInt\(0, thanks\.length - 1\)\];/m, `const thanks = [
      "감사합니다~!",
      "감사해요!!",
      "감사합니당~!",
      "정말 감사합니다!",
      "축하해주셔서 감사해요~",
      "고마워요! 기분 좋네요",
      "감사드려요 잘 받을게요!",
    ];
    return thanks[randInt(0, thanks.length - 1)];`);

fs.writeFileSync('app/lib/ai-community.js',community);

const v48Css = `

/* V48 scroll + home visual continuity */
.vip-home-v20{
  height:100%!important;
  min-height:0!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  overscroll-behavior-y:contain;
  -webkit-overflow-scrolling:touch;
  background:#f4f6f5!important;
  color:#24332e!important;
  padding-bottom:96px!important;
}
.vip-home-v20-welcome{
  background:#fff!important;
  border-color:#dfe6e3!important;
  box-shadow:0 8px 24px rgba(31,54,47,.055)!important;
}
.vip-home-v20-welcome span,.vip-home-v20-section-head span,.vip-home-v20-process-top span,.vip-home-v20-event span{color:#4f7569!important}
.vip-home-v20-event{background:#fff!important;border-color:#dfe6e3!important}
.vip-home-v20-process{background:linear-gradient(135deg,#203b34,#29483f)!important}
@media(max-width:999px){
  .vip-app-body{overflow:hidden!important;min-height:0!important}
  .vip-home-v20{height:100%!important;max-height:100%!important;padding-bottom:118px!important}
}
`;
if(!css.includes('/* V48 scroll + home visual continuity */')) css += v48Css;
fs.writeFileSync('app/globals.css',css);
console.log('V48 community and scroll fixes applied');
