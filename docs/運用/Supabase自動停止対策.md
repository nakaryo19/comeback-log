# Supabase 自動一時停止への対策

## 背景

Supabase の無料プランでは、**7日間「十分なユーザーDB活動」がないとプロジェクトが自動的に一時停止**される。
公式ドキュメントによれば「毎日数回のリクエストがあれば停止を防ぐには十分」とされている。

本プロジェクトは開発に週数時間しか割けない前提であり、記録が途切れる週も想定される
（そもそも「うまくいかない日がある」ことを前提としたアプリである）。
アプリの利用実績だけに依存すると、記録が途切れた週にプロジェクトが停止しかねないため、
自動 ping で稼働状態を担保する。

一時停止された場合でも、**90日以内**であれば Supabase ダッシュボードから手動で再開でき、データは失われない。

## 対策：GitHub Actions による定期 ping

`.github/workflows/keep-alive.yml` が毎日 02:17 UTC に Supabase の REST API へ 1 回だけリクエストを送る。

```
GET /rest/v1/goals?select=id&limit=1
```

### なぜこのリクエストなのか

- **DB活動として記録される**：PostgREST 経由で実際に PostgreSQL へクエリが発行される。
- **データが一切露出しない**：`goals` の RLS ポリシーは `auth.uid() = user_id` であり、
  匿名キーでは `auth.uid()` が NULL になるため 0 件しか返らない。実際の応答は `HTTP 200` と空配列 `[]`。
- **感情ログに触れない**：`emotion_logs` には一切アクセスしない（CLAUDE.md のプライバシー方針）。

なお REST のルート（`/rest/v1/`）は匿名キーでは `HTTP 401` を返すため、ping の宛先には使えない。

### 必要な GitHub Secrets

リポジトリの Settings → Secrets and variables → Actions に以下を登録する。

| シークレット名 | 値 |
|---|---|
| `SUPABASE_URL` | `.env.local` の `EXPO_PUBLIC_SUPABASE_URL` と同じ値 |
| `SUPABASE_ANON_KEY` | `.env.local` の `EXPO_PUBLIC_SUPABASE_ANON_KEY` と同じ値 |

anon キーは元々クライアントバンドルに含まれる公開前提のキー（実データは RLS で保護される）だが、
public リポジトリにハードコードするのは避け、Secrets 経由で渡す。

## 既知の弱点：GitHub の60日ルール

**public リポジトリでは、リポジトリに60日間まったく活動（コミット等）がないと、
スケジュールワークフローが GitHub により自動的に無効化される。**

つまり2ヶ月以上開発から完全に離れると、この keep-alive 自体が止まり、その7日後に Supabase が停止する。

- 無効化の前に GitHub から警告メールが届く。
- 無効化された場合は、リポジトリの Actions タブから手動で再有効化する（またはコミットを1つ積む）。
- 仮に Supabase が停止しても、90日以内ならダッシュボードの「Resume project」で再開できる。

## 動作確認の方法

手動実行に対応しているため、いつでも確認できる。

```bash
# 手動でワークフローを実行する
gh workflow run keep-alive.yml

# 直近の実行結果を確認する
gh run list --workflow keep-alive.yml --limit 5
```

ping に失敗した場合はワークフローが失敗し、GitHub から通知メールが届く
（プロジェクトが既に停止している、キーが失効している、などの可能性がある）。

## 採用しなかった選択肢

| 選択肢 | 却下理由 |
|---|---|
| Supabase の pg_cron（DB内部cron） | 内部処理でありユーザーからのリクエストではないため、活動として数えられない可能性が高い |
| 外部の無料 cron サービス（cron-job.org 等） | 新しいサービス依存が増え、Supabase の URL とキーを第三者に預けることになる |
| Pro プランへの移行 | 月額費用が発生し、「完全無料運営」の前提に反する |
| アプリを毎日使う（ドッグフーディング） | Phase 1 の目標そのものではあるが、記録が途切れた週こそ停止するため対策としては不適切 |

## 参考

- [Supabase Docs - Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [GitHub Docs - Events that trigger workflows（schedule）](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
