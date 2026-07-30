import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../lib/supabase/auth-context";
import {
  deleteAccount,
  fetchAccountDataSummary,
  type AccountDataSummary,
} from "../../lib/supabase/account";
import { colors, hitSlop, radius, spacing } from "../../lib/theme";

/**
 * 削除を確定するために入力してもらう語。
 * ボタン1つで消せてしまうと、戻せない操作を誤って踏める。
 * 感情ログは本アプリで最も失いたくないデータのため、意図の確認を1段厚くする。
 */
const CONFIRM_WORD = "削除";

export function AccountScreen({
  onBack,
  onOpenExport,
}: {
  onBack: () => void;
  onOpenExport: () => void;
}) {
  const { user, signOut } = useAuth();
  const [summary, setSummary] = useState<AccountDataSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAccountDataSummary()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "データ件数の取得に失敗しました。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      // 削除済みのユーザーのセッションを残さない。これでログイン画面へ戻る
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "アカウントの削除に失敗しました。");
      setDeleting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity hitSlop={hitSlop} onPress={onBack} style={styles.backLink}>
          <Text style={styles.navLink}>← ホームへ</Text>
        </TouchableOpacity>
        <Text style={styles.title}>アカウント削除</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* 削除対象のアカウントを明示する。取り違えたまま実行させないため、
            メールアドレスは残す。ログアウトはメニュー側に置き、ここには置かない */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>削除するアカウント</Text>
          <Text style={styles.email}>{user?.email ?? "-"}</Text>
        </View>

        <View style={styles.dangerSection}>
          <Text style={styles.dangerDescription}>
            アカウントと、記録したすべてのデータを削除します。元に戻すことはできません。
          </Text>
          {summary === null ? (
            <Text style={styles.impact}>削除される内容を確認しています...</Text>
          ) : (
            <Text style={styles.impact}>
              大目標 {summary.goals} 件、タスク {summary.tasks} 件
              {summary.emotionLogs > 0 && `、感情の記録 ${summary.emotionLogs} 件`}
              が削除されます。
            </Text>
          )}
          {/* 削除は取り消せず、無料枠にバックアップも無い。消す前に控えを取れることを示す */}
          <TouchableOpacity hitSlop={hitSlop} onPress={onOpenExport} style={styles.exportLink}>
            <Text style={styles.exportLinkText}>削除する前に、記録をエクスポートしておく</Text>
          </TouchableOpacity>

          {!confirming ? (
            <TouchableOpacity
              style={[styles.dangerButton, summary === null && styles.disabled]}
              disabled={summary === null}
              accessibilityRole="button"
              onPress={() => setConfirming(true)}
            >
              <Text style={styles.dangerButtonText}>アカウントを削除する</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmText}>
                続けるには、下の欄に「{CONFIRM_WORD}」と入力してください。
              </Text>
              <TextInput
                style={styles.confirmInput}
                value={typed}
                onChangeText={setTyped}
                accessibilityLabel="削除の確認"
                placeholder={CONFIRM_WORD}
                placeholderTextColor={colors.textMuted}
                editable={!deleting}
              />
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={[
                    styles.dangerButton,
                    (typed.trim() !== CONFIRM_WORD || deleting) && styles.disabled,
                  ]}
                  disabled={typed.trim() !== CONFIRM_WORD || deleting}
                  accessibilityRole="button"
                  onPress={handleDelete}
                >
                  <Text style={styles.dangerButtonText}>
                    {deleting ? "削除しています..." : "完全に削除する"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  hitSlop={hitSlop}
                  disabled={deleting}
                  onPress={() => {
                    setConfirming(false);
                    setTyped("");
                  }}
                >
                  <Text style={styles.subtleAction}>やめる</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    marginBottom: spacing.xl,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  dangerSection: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.lg,
  },
  dangerDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  impact: {
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  exportLink: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  exportLinkText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
  dangerButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.dangerMuted,
  },
  dangerButtonText: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  confirmBox: {
    backgroundColor: colors.neutralMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  confirmText: {
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  confirmInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    fontSize: 14,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  confirmActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  subtleAction: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
