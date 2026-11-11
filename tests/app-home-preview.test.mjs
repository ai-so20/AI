import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("independent app-home preview preserves original home and has no live data client",()=>{
  const page=get("app/app-home-preview/page.jsx");
  const css=get("app/app-home-preview/page.module.css");
  assert.match(page,/export default function AppHomePreview/);
  assert.match(page,/useState\("running"\)/);
  assert.match(page,/진행 중/);
  assert.match(page,/진행 전/);
  assert.match(page,/실제 계정·시세 미연동/);
  assert.doesNotMatch(page,/supabase|fetch\(|\.insert\(|\.update\(|\.delete\(/i);
  assert.match(css,/\.mobileNav\{/);
  assert.match(css,/@media\(min-width:1024px\)/);
  assert.doesNotMatch(css,/\.member-app-surface|\.member-app-frame/);
});
