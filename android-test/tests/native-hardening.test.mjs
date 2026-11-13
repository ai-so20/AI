import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const config=JSON.parse(read("capacitor.config.json"));

test("real membership login stays first and TLS-only",()=>{
  const url=new URL(config.server.url);
  assert.equal(url.protocol,"https:");
  assert.equal(url.pathname,"/design-entry");
  assert.equal(config.server.cleartext,false);
  assert.equal(config.android.allowMixedContent,false);
});
test("network error recovery is shipped as an offline local asset",()=>{
  assert.equal(config.server.errorPath,"offline.html");
  const local=read("www/offline.html");
  assert.match(local,/서버에 연결할 수 없습니다/);
  assert.match(local,/id="retry"/);
  assert.match(local,/window.location.replace\("https:\/\/ai-r6u0rn1ma-vipai.vercel.app\/design-entry"\)/);
  assert.doesNotMatch(local,/<script[^>]*src=/i);
  assert.doesNotMatch(local,/<link[^>]*href=/i);
});
test("generated native activity handles back, input, session and main-frame errors",()=>{
  const source=read("native/MainActivity.java");
  const deployed=read("android/app/src/main/java/com/vipai/aiprocess/smoketest/MainActivity.java");
  assert.equal(deployed,source);
  for(const required of [
    "extends BridgeActivity","getOnBackPressedDispatcher()",
    "webView.canGoBack()","webView.goBack()",
    "keyboardIsVisible()","SOFT_INPUT_ADJUST_RESIZE",
    "setDomStorageEnabled(true)","setAcceptCookie(true)",
    "setAcceptThirdPartyCookies(webView, false)",
    "CookieManager.getInstance().flush()",
    "new BridgeWebViewClient(getBridge())","request.isForMainFrame()"
  ])assert.ok(source.includes(required),required);
  assert.doesNotMatch(source,/removeAllCookies|deleteDatabase|clearCache\(/);
});
test("generated Android manifest resizes input instead of panning the login form",()=>{
  const manifest=read("android/app/src/main/AndroidManifest.xml");
  assert.match(manifest,/<activity\b[^>]*android:name="\.MainActivity"[^>]*android:windowSoftInputMode="adjustResize"[^>]*>/);
});
test("native changes are isolated from the Next.js application",()=>{
  assert.ok(existsSync(resolve(root,"www/index.html")));
  assert.ok(existsSync(resolve(root,"www/offline.html")));
  assert.ok(!existsSync(resolve(root,"android/app/src/main/java/com/vipai/aiprocess/smoketest/OtherActivity.java")));
});
