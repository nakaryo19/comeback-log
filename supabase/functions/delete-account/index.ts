/**
 * アカウント削除（App Store Review Guideline 5.1.1(v) 対応）。
 *
 * `auth.users` の行の削除には service_role キーが必要で、クライアントからは実行できない。
 * service_role は RLS をすべて迂回するため、アプリのバンドルに含めてはならない。
 * そのため、この処理だけをサーバー側（Edge Function）に置く。
 *
 * 削除するユーザーは **必ず JWT から導出する**。リクエストボディの user_id を信用すると、
 * ログインさえしていれば任意の他人のアカウントを消せる関数になる。
 *
 * `auth.users` を消せば goals → sub_goals → tasks → emotion_logs は
 * `on delete cascade` で連鎖削除される（supabase/migrations/20260713000000_initial_schema.sql）。
 * public_profiles も同様に user_id 経由で連鎖する。
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // 副作用のある操作なので GET では受け付けない（リンクを踏んだだけで消えることを防ぐ）
  if (req.method !== "POST") {
    return json({ error: "POST のみ受け付けます。" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "サーバーの設定が不足しています。" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "認証が必要です。" }, 401);
  }

  // 呼び出し元の本人確認。匿名キーのクライアントに Authorization を引き継いで
  // getUser させることで、JWT の署名・有効期限の検証を Supabase 側に任せる
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "認証に失敗しました。" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    console.error("アカウント削除に失敗:", deleteError.message);
    return json({ error: "アカウントの削除に失敗しました。" }, 500);
  }

  return json({ ok: true }, 200);
});
