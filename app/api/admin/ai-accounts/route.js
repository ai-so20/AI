import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { AI_ROOM_ID } from "../../../lib/ai-community";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Supabase 서버 환경변수가 없습니다.");
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function requireAdmin(db, request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new Error("관리자 인증이 필요합니다.");

  const { data, error } = await db.auth.getUser(token);
  const user = data?.user;
  if (error || !user) throw new Error("관리자 인증을 확인할 수 없습니다.");

  const { data: profile } = await db
    .from("profiles")
    .select("id,role,approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.approval_status !== "approved") {
    throw new Error("관리자만 사용할 수 있습니다.");
  }
  return user;
}

function templateToCharacterProfile(memberId, template) {
  return {
    member_id: memberId,
    character_key: template.character_key,
    character_name: template.character_name,
    age: template.age,
    gender: template.gender,
    occupation: template.occupation,
    personality: template.personality,
    speaking_style: template.speaking_style,
    behavior: template.behavior,
    general_reply_rate: template.general_reply_rate,
    celebration_reply_rate: template.celebration_reply_rate,
    loss_reply_rate: template.loss_reply_rate,
    style_traits: template.style_traits,
    interests: template.interests || [],
    rest_min_minutes: template.rest_min_minutes,
    rest_max_minutes: template.rest_max_minutes,
    activity_start: template.activity_start,
    activity_end: template.activity_end,
    self_identity: template.self_identity,
    identity_question_style: template.identity_question_style,
    is_active: template.is_active !== false,
    updated_at: new Date().toISOString(),
  };
}

export async function POST(request) {
  const db = adminClient();

  try {
    await requireAdmin(db, request);

    const { data: templates, error: templateError } = await db
      .from("ai_character_templates")
      .select("*")
      .eq("is_active", true)
      .order("character_key", { ascending: true });

    if (templateError) throw templateError;
    if (!templates?.length) {
      throw new Error("AI 캐릭터 템플릿이 없습니다. V17 SQL을 먼저 실행해주세요.");
    }

    const [{ data: existingProfiles }, { data: usersPage }] = await Promise.all([
      db
        .from("profiles")
        .select("id,nickname,account_type,ai_character_key")
        .not("ai_character_key", "is", null),
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const profileByKey = new Map(
      (existingProfiles || [])
        .filter((profile) => profile.ai_character_key)
        .map((profile) => [profile.ai_character_key, profile])
    );
    const authByEmail = new Map(
      (usersPage?.users || [])
        .filter((user) => user.email)
        .map((user) => [String(user.email).toLowerCase(), user])
    );

    const results = [];

    for (const template of templates) {
      try {
        const email = `vip.ai.${template.character_key}@example.com`.toLowerCase();
        let memberId = profileByKey.get(template.character_key)?.id || null;

        if (!memberId) {
          const authExisting = authByEmail.get(email);
          if (authExisting?.id) {
            memberId = authExisting.id;
          } else {
            const password = randomBytes(24).toString("base64url");
            const { data: created, error: createError } = await db.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: {
                nickname: template.nickname,
                real_name: template.character_name,
                avatar: template.avatar,
                account_type: "ai_character",
                ai_character_key: template.character_key,
              },
            });
            if (createError || !created?.user?.id) {
              throw createError || new Error("Auth 계정 생성 실패");
            }
            memberId = created.user.id;
            authByEmail.set(email, created.user);
          }
        }

        const { data: nicknameOwner } = await db
          .from("profiles")
          .select("id,account_type")
          .eq("nickname", template.nickname)
          .neq("id", memberId)
          .maybeSingle();

        if (nicknameOwner) {
          throw new Error(`닉네임 '${template.nickname}'을 다른 계정이 사용 중입니다.`);
        }

        const now = new Date().toISOString();

        const { error: profileError } = await db
          .from("profiles")
          .upsert({
            id: memberId,
            nickname: template.nickname,
            real_name: template.character_name,
            approval_status: "approved",
            avatar: template.avatar || "profile-01",
            role: "member",
            show_in_admin_chat: false,
            account_type: "ai_character",
            ai_character_key: template.character_key,
            ai_chat_enabled: true,
          }, { onConflict: "id" });
        if (profileError) throw profileError;

        const { error: memberError } = await db
          .from("members")
          .upsert({
            id: memberId,
            nickname: template.nickname,
            password_hash: "SUPABASE_AUTH",
            role: "member",
            status: "approved",
            approved_at: now,
            left_at: null,
            account_type: "ai_character",
          }, { onConflict: "id" });
        if (memberError) throw memberError;

        const { error: characterError } = await db
          .from("ai_character_profiles")
          .upsert(templateToCharacterProfile(memberId, template), { onConflict: "member_id" });
        if (characterError) throw characterError;

        const { error: stateError } = await db
          .from("ai_character_state")
          .upsert({
            member_id: memberId,
            updated_at: now,
          }, { onConflict: "member_id", ignoreDuplicates: false });
        if (stateError) throw stateError;

        const { error: roomError } = await db
          .from("room_members")
          .upsert({
            room_id: AI_ROOM_ID,
            member_id: memberId,
            is_muted: false,
          }, { onConflict: "room_id,member_id" });
        if (roomError) throw roomError;

        profileByKey.set(template.character_key, {
          id: memberId,
          nickname: template.nickname,
          account_type: "ai_character",
          ai_character_key: template.character_key,
        });

        results.push({
          characterKey: template.character_key,
          nickname: template.nickname,
          memberId,
          success: true,
        });
      } catch (characterError) {
        results.push({
          characterKey: template.character_key,
          nickname: template.nickname,
          success: false,
          error: characterError?.message || "생성 실패",
        });
      }
    }

    const successCount = results.filter((row) => row.success).length;
    const failed = results.filter((row) => !row.success);

    return Response.json({
      success: failed.length === 0,
      createdOrSynced: successCount,
      total: templates.length,
      failed,
      results,
    }, { status: failed.length === 0 ? 200 : 207 });
  } catch (error) {
    console.error("AI account sync error:", error);
    return Response.json(
      { success: false, error: error?.message || "AI 계정 동기화 실패" },
      { status: 500 }
    );
  }
}
