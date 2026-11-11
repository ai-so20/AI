import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const pages = ["design-home","design-event","design-attendance","design-ai-process","design-reward"];
test("five member routes share a surface, frame and one nav", () => {
  for (const page of pages) {
    const code = read("app/" + page + "/page.js");
    assert.match(code, /member-app-surface/, page);
    assert.match(code, /member-app-frame/, page);
    assert.equal((code.match(/<MemberNav\b/g) || []).length, 1, page);
  }
});
test("shared CSS is imported and navigation uses a responsive width", () => {
  assert.match(read("app/layout.js"), /member-layout\.css/);
  assert.match(read("app/components/design/MemberNav.jsx"), /member-app-nav/);
  const css = read("app/member-layout.css");
  assert.match(css, /max-width:100%!important/);
  assert.match(css, /@media\(min-width:768px\)/);
  assert.match(css, /repeat\(5,minmax\(0,1fr\)\)/);
});

test("desktop is an isolated layout instead of a stretched phone frame", () => {
  const layout=read("app/layout.js");
  const desktop=read("app/member-desktop.css");
  assert.match(layout,/member-desktop\.css/);
  assert.match(desktop,/@media \(min-width: 1024px\)/);
  assert.match(desktop,/flex-direction: column/);
  assert.match(desktop,/grid-column: 2/);
});

test("tablet keeps a single shared column until desktop begins at 1024px", () => {
 const css=read("app/member-layout.css");
 const pc=read("app/member-desktop.css");
 assert.match(css, /max-width:1023px/);
 assert.match(css, /--member-desktop-width:880px/);
 assert.match(css, /--member-gutter:24px/);
 assert.match(pc, /min-width: 1024px/);
 assert.doesNotMatch(css,/\.phone>\.body\{display:grid/);
});

test("PC-only layout uses a fluid rail and preserves mobile CSS", () => {
 const desktop=read("app/member-desktop.css");
 assert.match(desktop,/--member-rail-width:\s*clamp\(180px,\s*16\.5vw,\s*210px\)/);
 assert.match(desktop,/var\(--member-rail-width\)/);
 assert.match(desktop,/\.phone > \.hero \.brand \{color: #f4f9ff !important;\}/);
 assert.match(desktop,/min-height:360px/);
 assert.match(desktop,/@media \(min-width: 1024px\)/);
});
