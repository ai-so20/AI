import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const RANDOM_PROFILE_KEYS = Array.from({ length: 40 }, (_, index) => `profile-${String(index + 1).padStart(2, "0")}`);
function pickRandomProfile() { return RANDOM_PROFILE_KEYS[Math.floor(Math.random() * RANDOM_PROFILE_KEYS.length)]; }
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");
  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}
function makeInternalAuthAddress() { return `vip.${randomUUID().replaceAll("-", "")}@gmail.com`; }
function makeInternalSecret() { return `${randomUUID()}-${randomUUID()}`; }

export async function POST(request) {
  try {
    const body = await request.json();
    const nickname = String(body?.nickname || "").trim();
    const realName = String(body?.realName || "").trim();
    if (!nickname || !realName) return NextResponse.json({ message: "닉네임과 이름을 모두 입력해주세요." }, { status: 400 });

    const admin = createAdminClient();
    const { data: existingProfile, error: existingError } = await admin.from("profiles").select("id").eq("nickname", nickname).maybeSingle();
    if (existingError) return NextResponse.json({ message: "가입 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    if (existingProfile) return NextResponse.json({ message: "이미 사용 중인 닉네임입니다." }, { status: 409 });

    const randomAvatar = pickRandomProfile();
    const { data, error } = await admin.auth.admin.createUser({ email: makeInternalAuthAddress(), password: makeInternalSecret(), email_confirm: true, user_metadata: { nickname, real_name: realName, avatar: randomAvatar } });
    if (error || !data?.user) return NextResponse.json({ message: "가입 신청 중 오류가 발생했습니다." }, { status: 400 });

    const { error: profileError } = await admin.from("profiles").upsert({ id: data.user.id, nickname, real_name: realName, approval_status: "pending", avatar: randomAvatar }, { onConflict: "id" });
    if (profileError) return NextResponse.json({ message: "프로필 생성 중 오류가 발생했습니다." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("가입 API 오류:", error);
    return NextResponse.json({ message: "가입 신청 중 오류가 발생했습니다." }, { status: 500 });
  }
}
