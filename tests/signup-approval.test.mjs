import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source = relative => readFileSync(new URL("../" + relative, import.meta.url), "utf8");

test("self-service signup creates pending profile (never auto-approves)", () => {
 const signup = source("app/api/auth/signup/route.js");
 assert.match(signup,/approval_status:\s*["']pending["']/);
 assert.doesNotMatch(signup,/approval_status:\s*["']approved["']/);
 assert.match(signup,/auth\.admin\.createUser/);
});

test("nickname/password login enforces admin approval", () => {
 const login = source("app/api/auth/login/route.js");
 assert.match(login,/profile\.approval_status\s*!==\s*["']approved["']/);
});

test("UI signup text and admin approval flow remain coherent", () => {
 const entry = source("app/design-entry/page.js");
 const admin = source("app/page.js");
 assert.match(entry,/관리자 승인 후 로그인할 수 있습니다/);
 assert.match(admin,/admin_set_profile_approval/);
 assert.match(admin,/nextStatus === ["']approved["']/);
});
