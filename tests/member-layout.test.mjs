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
