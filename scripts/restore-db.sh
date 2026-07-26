#!/usr/bin/env bash
#
# バックアップアーカイブを復号して展開する。
#
# 安全のため、このスクリプトは「復号と展開」までしか行わない。
# DB への流し込みは中身を確認したうえで手動で実行すること
# （復旧はデータを上書きする操作であり、自動化すると事故の被害が大きくなるため）。
#
# 使い方:
#   BACKUP_PASSPHRASE=... ./scripts/restore-db.sh <アーカイブ.tar.gz.gpg> [展開先ディレクトリ]
#
set -euo pipefail

: "${BACKUP_PASSPHRASE:?環境変数 BACKUP_PASSPHRASE が未設定です}"

ARCHIVE="${1:?復号するアーカイブのパスを指定してください}"
DEST="${2:-restored}"

if [ ! -f "$ARCHIVE" ]; then
  echo "::error::アーカイブが見つかりません: ${ARCHIVE}"
  exit 1
fi

mkdir -p "$DEST"

echo "==> 復号して展開します: ${ARCHIVE} -> ${DEST}/"
gpg --decrypt \
  --batch \
  --quiet \
  --passphrase-fd 3 \
  "$ARCHIVE" 3<<<"$BACKUP_PASSPHRASE" |
  tar -xzf - -C "$DEST"

echo "==> 展開しました:"
ls -la "$DEST"

cat <<'EOF'

------------------------------------------------------------
展開した内容は平文です。確認後は必ず削除してください。

DB へ流し込む場合（内容を確認してから手動で実行）:

  psql "$SUPABASE_DB_URL" -f RESTORED_DIR/public.sql

public.sql は --clean --if-exists 付きで作られているため、
既存の public スキーマのテーブルを削除してから作り直します。
実行先の接続文字列が復旧対象のものか、必ず確認してください。

詳細は docs/運用/バックアップ運用.md を参照。
------------------------------------------------------------
EOF
