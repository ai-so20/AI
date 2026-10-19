import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function createLoginClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase 공개 환경변수가 설정되지 않았습니다.");
  }

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function findExistingProfile(admin, loginValue) {
  const { data: nicknameProfile, error: nicknameError } = await admin
    .from("profiles")
    .select("id,nickname,real_name,approval_status")
    .eq("nickname", loginValue)
    .maybeSingle();

  if (nicknameError) throw nicknameError;
  if (nicknameProfile?.id) return nicknameProfile;

  const { data: nameProfiles, error: nameError } = await admin
    .from("profiles")
    .select("id,nickname,real_name,approval_status")
    .eq("real_name", loginValue)
    .limit(2);

  if (nameError) throw nameError;

  // 이름은 중복될 수 있으므로 정확히 한 계정만 일치할 때만 로그인 대상으로 사용합니다.
  if (Array.isArray(nameProfiles) && nameProfiles.length === 1) {
    return nameProfiles[0];
  }

  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const loginValue = String(body?.nickname || "").trim();
    const candidates = Array.isArray(body?.passwordCandidates)
      ? body.passwordCandidates.map((value) => String(value || "")).filter(Boolean)
      : [];

    if (!loginValue || candidates.length === 0) {
      return NextResponse.json(
        { message: "닉네임 또는 비밀번호를 확인해주세요." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const profile = await findExistingProfile(admin, loginValue);

    if (!profile?.id) {
      return NextResponse.json(
        { message: "닉네임 또는 비밀번호를 확인해주세요." },
        { status: 401 }
      );
    }

    const { data: authData, error: authError } = await admin.auth.admin.getUserById(
      profile.id
    );

    const authEmail = authData?.user?.email;
    if (authError || !authEmail) {
      return NextResponse.json(
        { message: "닉네임 또는 비밀번호를 확인해주세요." },
        { status: 401 }
      );
    }

    const authClient = createLoginClient();

    for (const password of [...new Set(candidates)]) {
      const { data, error } = await authClient.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (!error && data?.session?.access_token && data?.session?.refresh_token) {
        return NextResponse.json({
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        });
      }
    }

    return NextResponse.json(
      { message: "닉네임 또는 비밀번호를 확인해주세요." },
      { status: 401 }
    );
  } catch (error) {
    console.error("로그인 API 오류:", error);
    return NextResponse.json(
      { message: "로그인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
