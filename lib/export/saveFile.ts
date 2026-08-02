import { Platform } from "react-native";

/**
 * 書き出したファイルを端末に保存する。
 *
 * 現時点では Web のみ対応する。ネイティブでファイルを保存・共有するには
 * expo-file-system と expo-sharing が要るが、実機ビルドの整備が済んでおらず
 * 動作を確認できないため、検証できない依存を先に足すことはしない
 * （docs/運用/商用リリース前チェックリスト.md §1-5 と同時に対応する）。
 *
 * 黙って何も起きない状態にはせず、理由を画面に出せるよう例外を投げる。
 */
export function saveTextFile(fileName: string, content: string, mimeType: string): void {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    throw new Error(
      "この端末ではまだ書き出しに対応していません。ブラウザ版からお試しください。",
    );
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
