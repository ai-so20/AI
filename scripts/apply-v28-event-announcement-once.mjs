import fs from 'node:fs';

const file = 'app/api/event-runtime/route.js';
let src = fs.readFileSync(file, 'utf8');

const start = src.indexOf('async function ensureAnnouncement(db, event, admin) {');
const end = src.indexOf('\nasync function ensureCommunityEvent(db, event) {', start);
if (start < 0 || end < 0) throw new Error('ensureAnnouncement block not found');

const replacement = `async function ensureAnnouncement(db, event, admin) {
  if (!admin || event.status !== "active") return false;

  // 이벤트 시작 공지는 회차당 딱 1번만 생성합니다.
  // event.group_message_id가 있으면 이미 공지가 생성된 회차입니다.
  if (event.group_message_id) return false;

  const startsAt = event.starts_at ? new Date(event.starts_at).getTime() : Date.now();
  const since = new Date(startsAt - 2 * 60_000).toISOString();

  // V27 이전 버전에서 이미 공지가 올라갔지만 group_message_id가 비어 있는 경우도 복구합니다.
  const { data: recent } = await db.from("group_messages")
    .select("id,content,created_at")
    .eq("room_id", event.room_id)
    .eq("member_id", admin.id)
    .eq("message_type", "event")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(50);

  const prior = (recent || []).find((row) => {
    const text = String(row.content || "");
    return text.includes("LIVE EVENT 시작") && text.includes(String(event.title || "이벤트"));
  });

  if (prior?.id) {
    await db.from("events").update({ group_message_id: prior.id }).eq("id", event.id).is("group_message_id", null);
    return false;
  }

  const endText = event.ends_at
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(event.ends_at))
    : "진행 중";
  const content = [
    "🎁 LIVE EVENT 시작",
    "",
    event.title || "이벤트",
    event.description || "지금 이벤트 메뉴에서 참여할 수 있습니다.",
    event.prize ? \`🎁 상품: \${event.prize}\` : "",
    \`⏰ 종료: \${endText}\`,
    "",
    "이벤트 메뉴에서 바로 참여해주세요.",
  ].filter(Boolean).join("\\n");

  const { data: inserted, error } = await db.from("group_messages").insert({
    room_id: event.room_id,
    member_id: admin.id,
    message_type: "event",
    content,
    is_deleted: false,
  }).select("id").single();
  if (error) throw error;

  if (inserted?.id) {
    await db.from("events").update({ group_message_id: inserted.id }).eq("id", event.id).is("group_message_id", null);
  }
  return true;
}
`;

src = src.slice(0, start) + replacement + src.slice(end);
fs.writeFileSync(file, src);
console.log('Applied V28 event announcement once patch');
