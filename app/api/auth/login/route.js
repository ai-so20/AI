import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");
  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}
function createLoginClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Supabase 공개 환경변수가 설정되지 않았습니다.");
  return createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const nickname = String(body?.nickname || "").trim();
    const realName = String(body?.realName || "").trim();
    if (!nickname || !realName) return NextResponse.json({ message: "닉네임과 이름을 모두 입력해주세요." }, { status: 400 });

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from("profiles").select("id,nickname,real_name,approval_status").eq("nickname", nickname).eq("real_name", realName).maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.id) return NextResponse.json({ message: "닉네임 또는 이름을 확인해주세요." }, { status: 401 });
    if (profile.approval_status !== "approved") return NextResponse.json({ message: "가입 승인이 완료된 후 로그인할 수 있습니다." }, { status: 403 });

    const { data: authData, error: authError } = await admin.auth.admin.getUserById(profile.id);
    const authEmail = authData?.user?.email;
    if (authError || !authEmail) return NextResponse.json({ message: "회원 인증 정보를 확인할 수 없습니다." }, { status: 401 });

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: authEmail });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error("내부 로그인 링크 생성 오류:", linkError);
      return NextResponse.json({ message: "로그인 인증을 만들지 못했습니다." }, { status: 500 });
    }

    const authClient = createLoginClient();
    const { data, error } = await authClient.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
      console.error("내부 로그인 세션 생성 오류:", error);
      return NextResponse.json({ message: "로그인 인증에 실패했습니다." }, { status: 401 });
    }
    return NextResponse.json({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token });
  } catch (error) {
    console.error("로그인 API 오류:", error);
    return NextResponse.json({ message: "로그인 중 오류가 발생했습니다." }, { status: 500 });
  }
}
