import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { fetchAllUserData } from "../../lib/supabase/export";
import { describeDataError } from "../../lib/supabase/data-errors";
import { buildExportPayload, exportFileName } from "../../lib/export/buildExport";
import { buildCsv } from "../../lib/export/buildCsv";
import { saveTextFile, type ExportFormat } from "../../lib/export/saveFile";
import { colors, hitSlop, radius, spacing } from "../../lib/theme";

export function DataExportScreen({ onBack }: { onBack: () => void }) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleExport(format: ExportFormat) {
    setExporting(format);
    setError(null);
    setResult(null);
    try {
      const dump = await fetchAllUserData();
      const fileName = exportFileName(format);
      const content =
        format === "csv"
          ? buildCsv(dump)
          : JSON.stringify(buildExportPayload(dump), null, 2);

      const outcome = await saveTextFile(fileName, content, format);

      // 共有シートは、利用者が保存をやめた場合も同じように閉じる。
      // 何が起きたか分からないまま「保存しました」と言い切らない
      setResult(
        outcome === "saved"
          ? `${fileName} を保存しました。`
          : `${fileName} を書き出しました。選んだ保存先をご確認ください。`,
      );
    } catch (e) {
      setError(describeDataError(e, "書き出しに失敗しました。"));
    } finally {
      setExporting(null);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity hitSlop={hitSlop} onPress={onBack} style={styles.backLink}>
          <Text style={styles.navLink}>← ホームへ</Text>
        </TouchableOpacity>
        <Text style={styles.title}>データエクスポート</Text>

        {/* 無料枠には自動バックアップが無い。控えを持つ意味を、義務ではなく理由として伝える */}
        <Text style={styles.description}>
          これまでの記録を、ファイルにして端末に保存します。ときどき保存しておくと、
          端末を変えたときやアカウントを消したあとでも、記録を読み返せます。
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}
        {result && <Text style={styles.success}>{result}</Text>}

        {/* 既定はCSV。JSONは「開いても読めないファイル」になりがちで、
            控えとして受け取った本人の役に立たない */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>一覧で見る（CSV）</Text>
          <Text style={styles.cardBody}>
            Excel・Numbers・Googleスプレッドシートで開けます。1行が1つのタスクで、
            その日の気持ちのスコアやメモも同じ行に並びます。
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, exporting !== null && styles.disabled]}
            disabled={exporting !== null}
            accessibilityRole="button"
            onPress={() => handleExport("csv")}
          >
            <Text style={styles.primaryButtonText}>
              {exporting === "csv" ? "書き出しています..." : "CSVで保存"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>まるごと残す（JSON）</Text>
          <Text style={styles.cardBody}>
            目標の階層や達成日も含めて、記録をそのままの形で残します。
            そのままでは読みにくい形式ですが、控えとしてはこちらが完全です。
          </Text>
          <TouchableOpacity
            style={[styles.secondaryButton, exporting !== null && styles.disabled]}
            disabled={exporting !== null}
            accessibilityRole="button"
            onPress={() => handleExport("json")}
          >
            <Text style={styles.secondaryButtonText}>
              {exporting === "json" ? "書き出しています..." : "JSONで保存"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  backLink: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  navLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  success: {
    fontSize: 13,
    color: colors.success,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  primaryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
  },
  primaryButtonText: {
    fontSize: 14,
    color: colors.white,
    fontWeight: "600",
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
});
