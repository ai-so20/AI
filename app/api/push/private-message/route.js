import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject =
  process.env.VAPID_SUBJECT || "https://vip-event-gamma.vercel.app";

function adminClient() {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request) {
  try {
    if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
      return NextResponse.json(
        { error: "Push server env is missing." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = adminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const sender = authData?.user;

    if (authError || !sender) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const chatId = String(body?.chatId || "");
    const content = String(body?.content || "").slice(0, 180);

    if (!chatId) {
      return NextResponse.json({ error: "chatId is required." }, { status: 400 });
    }

    const { data: chat, error: chatError } = await supabase
      .from("private_chats")
      .select("id,member_id,operator_id")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }

    let targetUserId = null;

    if (sender.id === chat.member_id) {
      if (chat.operator_id) {
        targetUserId = chat.operator_id;
      } else {
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin")
          .limit(1)
          .maybeSingle();
        targetUserId = adminProfile?.id || null;
      }
    } else {
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", sender.id)
        .maybeSingle();

      if (senderProfile?.role !== "admin" && sender.id !== chat.operator_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetUserId = chat.member_id;
    }

    if (!targetUserId || targetUserId === sender.id) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", targetUserId);

    if (subscriptionError) throw subscriptionError;

    if (!subscriptions?.length) {
      return NextResponse.json({ ok: true, sent: 0, reason: "no_subscription" });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const payload = JSON.stringify({
      title: "AI PROCESS VIP · 1:1 새 메시지",
      body: content || "새 1:1 메시지가 도착했습니다.",
      tag: `vip-private-${chatId}`,
      url: "/?tab=private&from=push",
    });

    let sent = 0;

    await Promise.all(
      subscriptions.map(async (item) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: item.endpoint,
              keys: { p256dh: item.p256dh, auth: item.auth },
            },
            payload,
            { TTL: 60 * 60 * 24, urgency: "high" }
          );
          sent += 1;
        } catch (error) {
          const status = error?.statusCode;
          if (status === 404 || status === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", item.id);
          } else {
            console.error("web-push error", status, error?.message);
          }
        }
      })
    );

    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    console.error("private push route error", error);
    return NextResponse.json(
      { error: error?.message || "Push failed." },
      { status: 500 }
    );
  }
}
