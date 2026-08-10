import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * 書き出したファイルを端末に渡す。
 *
 * Web とネイティブで「保存」の意味が違う。
 * - Web：ダウンロードとしてそのまま保存される
 * - ネイティブ：アプリの外に直接ファイルを置く手段がないため、共有シートを開いて
 *   保存先（ファイルApp・メール・クラウド等）を利用者に選んでもらう
 *
 * 完了後の案内文が変わるので、どちらの経路を通ったかを返す。
 * 呼び出し側が Platform を見て文言を分岐すると、判断が2箇所に散る。
 */
export type SaveOutcome = "saved" | "shared";

export type ExportFormat = "csv" | "json";

/**
 * 書き出し形式ごとの型情報。
 *
 * iOS の共有シートは UTI を見て「どのアプリに渡せるか」を決める。指定しないと
 * 汎用データ扱いになり、ファイルApp 以外の選択肢が出てこないことがある。
 * Android は mimeType 側を見る。両方を持っておく。
 */
const FORMAT_TYPES: Record<ExportFormat, { mimeType: string; uti: string }> = {
  csv: { mimeType: "text/csv;charset=utf-8", uti: "public.comma-separated-values-text" },
  json: { mimeType: "application/json", uti: "public.json" },
};

export async function saveTextFile(
  fileName: string,
  content: string,
  format: ExportFormat,
): Promise<SaveOutcome> {
  const { mimeType, uti } = FORMAT_TYPES[format];

  if (Platform.OS === "web") {
    saveViaDownload(fileName, content, mimeType);
    return "saved";
  }

  await saveViaShareSheet(fileName, content, mimeType, uti);
  return "shared";
}

function saveViaDownload(fileName: string, content: string, mimeType: string): void {
  if (typeof document === "undefined") {
    throw new Error("この環境では書き出しに対応していません。");
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // 解放しないとページを閉じるまでメモリに残る
  URL.revokeObjectURL(url);
}

async function saveViaShareSheet(
  fileName: string,
  content: string,
  mimeType: string,
  uti: string,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("この端末では共有機能を利用できないため、書き出しできませんでした。");
  }

  // 書き出しは共有シートに渡すための一時ファイルなので、キャッシュ領域に置く。
  // 書類領域に置くと、共有し終えた控えがアプリ内に無期限に残り続ける。
  const file = new File(Paths.cache, fileName);

  try {
    // 同じ日に2回書き出すとファイル名が衝突する（exportFileName は日付までしか入れない）
    file.create({ overwrite: true });
    file.write(content);

    await Sharing.shareAsync(file.uri, {
      mimeType,
      UTI: uti,
      dialogTitle: "記録の書き出し",
    });
  } finally {
    // 感情ログの自由記述を含むファイルを、共有が済んだあとも端末に残さない
    // （CLAUDE.md「感情ログのプライバシーを最優先する」）。
    // 共有先へのコピーは完了済みなので、ここで消しても保存結果には影響しない。
    try {
      file.delete();
    } catch {
      // 消せなくても書き出し自体は成立している。ここで失敗を表に出さない
    }
  }
}
