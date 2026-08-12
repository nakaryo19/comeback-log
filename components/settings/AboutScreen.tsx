import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { legalLinks } from "../../lib/legalLinks";
import { OpenSourceLicenses } from "./OpenSourceLicenses";
import { colors, hitSlop, radius, spacing } from "../../lib/theme";

/**
 * このアプリについて。
 *
 * プライバシーポリシー・利用規約への導線（チェックリスト §1-2）と、
 * 同梱している OSS のライセンス表示（§3-3）を1画面にまとめる。
 * どちらも「普段は使わないが、必要なときに必ず辿り着ける」種類の情報で、
 * 探す場所が分かれていると見つけられない。
 */
export function AboutScreen({ onBack }: { onBack: () => void }) {
  const [showLicenses, setShowLicenses] = useState(false);
  const links = legalLinks();

  if (showLicenses) {
    return <OpenSourceLicenses onBack={() => setShowLicenses(false)} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity hitSlop={hitSlop} onPress={onBack} style={styles.backLink}>
          <Text style={styles.navLink}>← ホームへ</Text>
        </TouchableOpacity>
        <Text style={styles.title}>このアプリについて</Text>

        {links.length > 0 && (
          <View style={styles.card}>
            {links.map((link, index) => (
              <TouchableOpacity
                key={link.url}
                style={[styles.row, index > 0 && styles.rowDivider]}
                accessibilityRole="link"
                onPress={() => Linking.openURL(link.url)}
              >
                <Text style={styles.rowLabel}>{link.label}</Text>
                {/* 外部ブラウザで開くことを、押す前に分かるようにする */}
                <Text style={styles.rowHint}>開く ↗</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            accessibilityRole="button"
            onPress={() => setShowLicenses(true)}
          >
            <Text style={styles.rowLabel}>オープンソースライセンス</Text>
            <Text style={styles.rowHint}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>
          このアプリは、記録した内容を外部のAIサービスへ送信しません。広告も配信していません。
        </Text>
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
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  rowLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  note: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
});
