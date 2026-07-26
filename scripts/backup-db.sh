#!/usr/bin/env bash
#
# Supabase のユーザーデータを暗号化してバックアップする。
#
# 無料プランにはバックアップ機能が一切ないため、自前で確保する必要がある。
# 詳細は docs/運用/バックアップ運用.md を参照。
#
# ダンプには emotion_logs.free_text（感情ログの自由記述）が平文で含まれる。
# CLAUDE.md「感情ログを外部に露出させない」方針に従い、
# 保存前に必ず gpg で暗号化する。復号鍵を持たない場所には平文を置かない。
#
# 使い方:
#   SUPABASE_DB_URL=... BACKUP_PASSPHRASE=... ./scripts/backup-db.sh [出力先ディレクトリ]
#
set -euo pipefail

: "${SUPABASE_DB_URL:?環境変数 SUPABASE_DB_URL が未設定です（Supabase の Session pooler 接続文字列）}"
: "${BACKUP_PASSPHRASE:?環境変数 BACKUP_PASSPHRASE が未設定です（バックアップ暗号化用のパスフレーズ）}"

OUT_DIR="${1:-backup}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="${OUT_DIR}/comeback-log-${STAMP}.tar.gz.gpg"

mkdir -p "$OUT_DIR"

WORK="$(mktemp -d)"
# 平文のダンプを残さないよう、成否にかかわらず必ず消す
trap 'rm -rf "$WORK"' EXIT

echo "==> public スキーマをダンプします（goals / sub_goals / tasks / emotion_logs / public_profiles）"
pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --file="$WORK/public.sql"

# auth.users はプロジェクトごと失った場合の復旧に必要。
# ただし権限やSupabase側の内部変更で失敗しうるため、失敗しても全体は止めない。
echo "==> auth.users をダンプします（プロジェクト全損時の復旧用・ベストエフォート）"
if pg_dump "$SUPABASE_DB_URL" \
  --data-only \
  --table=auth.users \
  --no-owner \
  --no-privileges \
  --file="$WORK/auth_users.sql" 2>"$WORK/auth_users.err"; then
  echo "    auth.users のダンプに成功しました"
else
  echo "::warning::auth.users のダンプに失敗しました。public スキーマのみでバックアップを続行します。"
  sed 's/^/    /' "$WORK/auth_users.err" || true
  rm -f "$WORK/auth_users.sql"
  echo "auth.users のダンプに失敗（$(date -u +%FT%TZ)）" > "$WORK/auth_users.SKIPPED"
fi

# 復旧時に何を見ればよいか分かるようにメモを同梱する
cat > "$WORK/README.txt" <<EOF
comeback-log データベースバックアップ
取得日時 (UTC): ${STAMP}

public.sql      … public スキーマ（スキーマ定義＋データ）。--clean --if-exists 付きで作成。
auth_users.sql  … auth.users のデータのみ。存在しない場合はダンプに失敗している。

復旧手順は docs/運用/バックアップ運用.md を参照すること。
このアーカイブには感情ログの自由記述が平文で含まれる。取り扱いに注意すること。
EOF

echo "==> アーカイブして暗号化します"
tar -czf - -C "$WORK" . |
  gpg --symmetric \
    --cipher-algo AES256 \
    --batch \
    --yes \
    --passphrase-fd 3 \
    --output "$ARCHIVE" 3<<<"$BACKUP_PASSPHRASE"

SIZE="$(wc -c < "$ARCHIVE" | tr -d ' ')"
echo "==> 完了: ${ARCHIVE} (${SIZE} bytes)"

# 中身が空に近い場合は、ダンプが失敗している可能性が高いので気づけるようにする
if [ "$SIZE" -lt 1024 ]; then
  echo "::error::バックアップが異常に小さいです（${SIZE} bytes）。ダンプが失敗している可能性があります。"
  exit 1
fi
