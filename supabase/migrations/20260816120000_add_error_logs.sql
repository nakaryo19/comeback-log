-- 本番で起きたエラーを、自前の Supabase にだけ記録する（リリース計画 B5）。
--
-- なぜ外部の監視サービスを使わないか:
--   CLAUDE.md の制約は「観測するな」ではなく「感情ログを外部へ送るな」。
--   自前の Supabase は既に感情ログ本体を保持している場所で、
--   ここに書くかぎり**新しい信頼境界を一つも増やさない**。
--   第三者提供の記載も、App Store のプライバシーラベルの事業者追加も要らない。
--
-- 何が見えないか（この仕組みの限界。埋められると誤解しないこと）:
--   - Supabase に到達できない障害は、原理的にここへ書けない
--   - ネイティブのクラッシュは拾えない。そちらは App Store Connect /
--     Xcode Organizer のクラッシュレポートで見る
--   - ログイン前のエラーも書けない（下記 RLS の理由）

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- どこで起きたか。画面名や操作名を呼び出し側が渡す（"ErrorBoundary" / "タスクの取得" 等）
  context text not null,
  message text not null,
  stack text,
  app_version text,
  platform text,
  created_at timestamptz not null default now()
);

comment on table public.error_logs is
  '本番で起きたエラーの記録。外部の監視サービスへは送らず、ここにだけ書く。';

comment on column public.error_logs.message is
  '例外のメッセージ。**感情ログの自由記述など、利用者が書いた本文を入れてはならない。**
   書き込み側（lib/errorReporter.ts）で長さを打ち切っている。';

create index error_logs_created_at_idx on public.error_logs (created_at desc);

-- ============================================================
-- RLS
-- ============================================================
alter table public.error_logs enable row level security;

-- 書き込みのみ許す。**select ポリシーは意図的に作らない。**
-- 閲覧は運用者がダッシュボード（service_role）から行う。
-- 利用者に読ませる必要が無く、ポリシーを持たせないほうが
-- 他人のエラー内容へ回り込む経路を作らずに済む。
create policy "error_logs_insert_own" on public.error_logs
  for insert with check (auth.uid() = user_id);

-- 匿名の insert は許可しない。ログイン前のエラーは記録できなくなるが、
-- 誰でも書ける口は、そのまま無制限に行を積まれる口でもある。
-- 無料枠のDBを守るほうを優先する。

-- 保存期間の管理は手動。無料プランでは pg_cron を前提にできないため、
-- 運用者が定期的に古い行を消す（docs/運用/ に手順を置く）。
