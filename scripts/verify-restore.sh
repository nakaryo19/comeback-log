#!/usr/bin/env bash
#
# バックアップから実際に復元できることを検証する。
#
# 未検証のバックアップは、無いのと同じである。
# 復元手順の初回実行が「データを失った直後」になると、
# 外部キー制約や auth スキーマの欠落といった問題をそこで初めて踏むことになる。
# そうならないよう、平時に一度通しておくためのスクリプト。
#
# 流し込み先は **使い捨ての空 PostgreSQL**（CI のサービスコンテナ等）であり、
# 本番DBには一切書き込まない。本番への復旧は scripts/restore-db.sh で
# 中身を確認したうえで手動実行する（docs/運用/バックアップ運用.md 参照）。
#
# 感情ログの自由記述は復元されるが、**件数しか出力しない**。
# 検証ログは公開リポジトリの Actions に残るため、中身は絶対に出さないこと。
#
# 使い方:
#   BACKUP_PASSPHRASE=... PGHOST=localhost PGUSER=postgres PGPASSWORD=... \
#     ./scripts/verify-restore.sh <アーカイブ.tar.gz.gpg>
#
set -euo pipefail

: "${BACKUP_PASSPHRASE:?環境変数 BACKUP_PASSPHRASE が未設定です}"

ARCHIVE="${1:?検証するアーカイブのパスを指定してください}"

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-postgres}"

if [ ! -f "$ARCHIVE" ]; then
  echo "::error::アーカイブが見つかりません: ${ARCHIVE}"
  exit 1
fi

WORK="$(mktemp -d)"
# 平文のダンプをランナー上に残さない
trap 'rm -rf "$WORK"' EXIT

echo "==> 復号して展開します"
gpg --decrypt \
  --batch \
  --quiet \
  --passphrase-fd 3 \
  "$ARCHIVE" 3<<<"$BACKUP_PASSPHRASE" |
  tar -xzf - -C "$WORK"

if [ ! -f "$WORK/public.sql" ]; then
  echo "::error::アーカイブに public.sql が含まれていません。バックアップが壊れています。"
  exit 1
fi

echo "==> 検証先: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
psql --quiet --no-psqlrc --set=ON_ERROR_STOP=1 -c 'select version();' > /dev/null

# Supabase 固有の依存を最小限だけ用意する。
# public スキーマのダンプは auth.users への外部キーと、RLS ポリシー内の auth.uid() を参照するため、
# 素の PostgreSQL にそのままは流し込めない。
echo "==> auth スキーマのスタブを作成します"
psql --quiet --no-psqlrc --set=ON_ERROR_STOP=1 <<'SQL'
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
SQL
# public スキーマ配下には何も作らないこと。
# public.sql は --clean で `DROP SCHEMA public` から始まるため、
# ここで拡張などを置くと依存関係で drop に失敗する（pgcrypto で実際に踏んだ）。

if [ -f "$WORK/auth_users.sql" ]; then
  # auth.users はプロジェクト全損時の復旧に必要な経路。ここも一緒に検証する。
  # ダンプの COPY 句から列名を読み取り、同じ並びのスタブ表を作る
  # （id だけ uuid。外部キーの型を合わせるため。他は text で受ける）。
  COLUMNS="$(grep -m1 -oE '^COPY auth\.users \([^)]*\)' "$WORK/auth_users.sql" | sed -E 's/^COPY auth\.users \(//; s/\)$//')"
  if [ -z "$COLUMNS" ]; then
    echo "::error::auth_users.sql から列定義を読み取れませんでした。"
    exit 1
  fi
  DEFS="$(echo "$COLUMNS" | tr ',' '\n' | sed 's/^ *//; s/ *$//' |
    awk '{ if ($0 == "id") print "id uuid primary key"; else print $0 " text" }' | paste -sd, -)"

  echo "==> auth.users を復元します"
  psql --quiet --no-psqlrc --set=ON_ERROR_STOP=1 -c "create table auth.users (${DEFS});"
  psql --quiet --no-psqlrc --set=ON_ERROR_STOP=1 --file="$WORK/auth_users.sql" > /dev/null
  AUTH_USERS="$(psql --quiet --no-psqlrc --tuples-only --no-align -c 'select count(*) from auth.users;')"
  echo "    auth.users: ${AUTH_USERS} 行"
  if [ "$AUTH_USERS" -eq 0 ]; then
    echo "::error::auth.users が 0 行です。ダンプが空の可能性があります。"
    exit 1
  fi
else
  # ベストエフォートのため欠けることがある。その場合は auth.users への外部キーを外して検証を続ける
  echo "::warning::auth_users.sql がありません（ダンプに失敗している）。auth.users への外部キーを除外して検証します。"
  psql --quiet --no-psqlrc --set=ON_ERROR_STOP=1 -c 'create table auth.users (id uuid primary key);'
  perl -0777 -i -pe 's/ALTER TABLE ONLY[^;]*REFERENCES auth\.users[^;]*;//g' "$WORK/public.sql"
fi

echo "==> public スキーマを復元します"
psql --quiet --no-psqlrc --set=ON_ERROR_STOP=1 --file="$WORK/public.sql" > /dev/null

# 件数のみを出力する。free_text は絶対に出さない（Actions のログは公開される）
echo "==> 復元結果の件数"
FAILED=0
for table in goals sub_goals tasks emotion_logs public_profiles; do
  count="$(psql --quiet --no-psqlrc --tuples-only --no-align -c "select count(*) from public.${table};")"
  printf '    %-16s %s 行\n' "$table" "$count"
  # public_profiles は Phase 3 の機能で、まだ 0 行が正しい
  if [ "$table" != "public_profiles" ] && [ "$count" -eq 0 ]; then
    echo "::error::${table} が 0 行です。データが復元できていません。"
    FAILED=1
  fi
done

# 参照整合性が保たれているか（外部キーが張られていれば構造的に担保されるが、
# 外部キーを外した経路でも壊れを検知できるよう明示的に確認する）
ORPHANS="$(psql --quiet --no-psqlrc --tuples-only --no-align -c "
  select
    (select count(*) from public.sub_goals s left join public.goals g on g.id = s.goal_id where g.id is null)
  + (select count(*) from public.tasks t left join public.sub_goals s on s.id = t.sub_goal_id where s.id is null)
  + (select count(*) from public.emotion_logs e left join public.tasks t on t.id = e.task_id where t.id is null);
")"
echo "    親を失った行: ${ORPHANS} 行"
if [ "$ORPHANS" -ne 0 ]; then
  echo "::error::親レコードを参照できない行があります。バックアップが不整合です。"
  FAILED=1
fi

if [ "$FAILED" -ne 0 ]; then
  echo "==> 検証に失敗しました"
  exit 1
fi

echo "==> 検証に成功しました。このバックアップからは復元できます。"
