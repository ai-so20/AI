import fs from "node:fs";

function mustReplace(src, from, to, label) {
  if (!src.includes(from)) throw new Error(`${label} anchor not found`);
  return src.replace(from, to);
}

const routePath = "app/api/event-runtime/route.js";
let route = fs.readFileSync(routePath, "utf8");
route = mustReplace(
  route,
  `.select("id").eq("event_type", "event_started").eq("source_key", String(event.id)).limit(1);`,
  `.select("id").eq("event_type", "event_start").eq("source_key", String(event.id)).limit(1);`,
  "event type lookup"
);
route = mustReplace(
  route,
  `event_type: "event_started",`,
  `event_type: "event_start",`,
  "event type insert"
);
route = mustReplace(
  route,
  `if (error && error.code !== "23505") console.warn("event_started queue insert failed", error.message);`,
  `if (error && error.code !== "23505") console.warn("event_start queue insert failed", error.message);`,
  "event type warning"
);
route = mustReplace(
  route,
  `    "이벤트 메뉴에서 바로 참여해주세요.",\n    \`event:\${event.id}\`,`,
  `    "이벤트 메뉴에서 바로 참여해주세요.",`,
  "event id leak"
);
fs.writeFileSync(routePath, route);

const communityPath = "app/lib/ai-community.js";
let community = fs.readFileSync(communityPath, "utf8");
community = mustReplace(
  community,
  `  const humanRows = rows.filter((r) => r.member_id && profileMap.get(r.member_id)?.account_type === "human");`,
  `  const humanRows = rows.filter((r) =>\n    r.member_id &&\n    r.message_type !== "event" &&\n    profileMap.get(r.member_id)?.account_type === "human"\n  );`,
  "human event filter"
);
fs.writeFileSync(communityPath, community);

console.log("V27 event chat semantic fix applied");
