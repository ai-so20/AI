import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function makeInternalAuthAddress() {
  return `vip.${randomUUID().replaceAll("-", "")}@example.com`;
}

export async function POST(request) {
  let createdUserId = null;

  try {
    const body = await request.json().catch(() => ({}));
    const nickname = String(body?.nickname || "").normalize("NFKC").trim();
    const realName = String(body?.realName || "").normalize("NFKC").trim();
    const password = String(body?.password || "");

    if (!nickname || !realName || !password) {
      return NextResponse.json(
        { message: "닉네임, 성함, 비밀번호를 모두 입력해주세요." },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { message: "비밀번호는 4자리 이상 입력해주세요." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: existingProfile, error: existingError } = await admin
      .from("profiles")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { message: "가입 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        { message: "이미 사용 중인 닉네임입니다." },
        { status: 409 }
      );
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: makeInternalAuthAddress(),
      password,
      email_confirm: true,
      user_metadata: {
        nickname,
        real_name: realName,
      },
    });

    createdUserId = data?.user?.id || null;

    if (error || !createdUserId) {
      return NextResponse.json(
        { message: "가입 신청 중 오류가 발생했습니다." },
        { status: 400 }
      );
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: createdUserId,
          nickname,
          real_name: realName,
          approval_status: "approved",
        },
        { onConflict: "id" }
      );

    if (profileError) {
      await admin.auth.admin.deleteUser(createdUserId).catch(() => {});
      return NextResponse.json(
        { message: "회원정보 생성 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("가입 API 오류:", error);
    return NextResponse.json(
      { message: "가입 신청 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
