import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorReport } from "@/lib/errors";

type Post = { message_id: number; chat: { id: number }; text?: string; caption?: string; author_signature?: string };
type Update = { channel_post?: Post; edited_channel_post?: Post };

// The news channel's bot reports every post in the channel here, so a post
// written straight in Telegram reaches the clubs on the site too (a post
// written in the admin area is already stored — it is not stored twice).
// An edited post is updated. Always answers 200, or Telegram keeps resending.
async function handlePOST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const update = (await req.json().catch(() => ({}))) as Update;
  const post = update.channel_post ?? update.edited_channel_post;
  const text = (post?.text ?? post?.caption ?? "").trim().slice(0, 4000);
  if (!post || !text || String(post.chat.id) !== (process.env.TELEGRAM_NEWS_CHANNEL_ID ?? "")) return NextResponse.json({ ok: true });

  const db = createAdminClient();
  if (update.edited_channel_post) {
    await db.from("news_posts").update({ body: text }).eq("tg_message_id", post.message_id);
  } else {
    await db
      .from("news_posts")
      .upsert({ body: text, tg_message_id: post.message_id, author_label: post.author_signature ? `Telegram · ${post.author_signature}` : "Telegram" }, { onConflict: "tg_message_id", ignoreDuplicates: true });
  }
  return NextResponse.json({ ok: true });
}

export const POST = withErrorReport("news", handlePOST);
