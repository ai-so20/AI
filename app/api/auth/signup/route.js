import { randomUUID } from "crypto";
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

function makeInternalAuthAddress() {
  // 사용자에게 노출하거나 입력받지 않는 내부 인증용 주소입니다.
  // admin.createUser는 가입 확인 메일을 발송하지 않습니다.
  const id = randomUUID().replaceAll("-", "");
  return `vip.${id}@gmail.com`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const nickname = String(body?.nickname || "").trim();
    const realName = String(body?.realName || "").trim();
    const password = String(body?.password || "");

    if (!nickname || !realName || !password) {
      return NextResponse.json(
        { message: "닉네임, 성함, 비밀번호를 모두 입력해주세요." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "비밀번호는 6자리 이상 입력해주세요." },
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
      console.error("닉네임 중복 확인 오류:", existingError);
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

    if (error || !data?.user) {
      console.error("회원 생성 오류:", error);
      return NextResponse.json(
        { message: "가입 신청 중 오류가 발생했습니다." },
        { status: 400 }
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
