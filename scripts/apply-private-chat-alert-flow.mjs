import fs from "node:fs";

const path = "app/page.js";
let src = fs.readFileSync(path, "utf8");

// 1:1 문의 화면 안에서는 상단 고정 알림을 띄우지 않습니다.
// 실제 메시지는 privateMessages 목록에 들어가므로 채팅의 일부로 그대로 남고,
// 이후 채팅이 이어지면 자연스럽게 위로 밀립니다.
const from = "          {privateAlert && (\n            <button";
const to = "          {privateAlert && chatTab !== \"private\" && (\n            <button";
if (!src.includes(from)) throw new Error("privateAlert render target not found");
src = src.replace(from, to);

fs.writeFileSync(path, src);
console.log("patched", path);
