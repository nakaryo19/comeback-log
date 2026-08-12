import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, hitSlop, radius, spacing } from "../../lib/theme";

/**
 * 同梱している OSS のライセンス表示（チェックリスト §3-3）。
 *
 * MIT・BSD 系のライセンスは「著作権表示と許諾表示を複製物に含めること」を
 * 条件にしている。これを満たさないまま配布すると、ライセンス違反のまま
 * ストアに出すことになる。
 *
 * 一覧は `scripts/build-licenses.mjs` が本番依存から生成する
 * （実行時に node_modules を読めないため）。
 */
type LicenseData = {
  texts: string[];
  packages: {
    name: string;
    version: string;
    license: string;
    /** texts の添字。LICENSE ファイルを同梱していないパッケージでは undefined */
    text?: number;
    /** 条文が無い場合の著作権者（package.json の author） */
    author?: string;
  }[];
};

export function OpenSourceLicenses({ onBack }: { onBack: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // 400KB 超あるため、ファイル先頭の import ではなくここで読み込む。
  // import は巻き上げられて起動時に解析されるが、require はこの関数が
  // 呼ばれるまで走らない。ほとんどの利用者が開かない画面のために
  // 毎回の起動でこれを解析させない。2回目以降はモジュールキャッシュが返る。
  const data = require("../../lib/licenses/licenses.json") as LicenseData;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity hitSlop={hitSlop} onPress={onBack} style={styles.backLink}>
          <Text style={styles.navLink}>← このアプリについて</Text>
        </TouchableOpacity>
        <Text style={styles.title}>オープンソースライセンス</Text>
        <Text style={styles.description}>
          このアプリは、以下のオープンソースソフトウェアを利用しています。
          それぞれの著作権は各権利者に帰属します。
        </Text>

        {data.packages.map((pkg) => {
          const key = `${pkg.name}@${pkg.version}`;
          const isOpen = expanded === key;
          const text = pkg.text === undefined ? null : data.texts[pkg.text];
          // 条文を同梱していないパッケージは、せめて著作権者を示す。
          // MIT・BSD は著作権表示を複製物に含めることを条件にしているため、
          // ライセンス名だけでは条件を満たしたことにならない
          const fallback = pkg.author
            ? `${pkg.license} License\n\nCopyright (c) ${pkg.author}`
            : `${pkg.license} の条文に基づいて提供されています。`;

          return (
            <View key={key} style={styles.item}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                onPress={() => setExpanded(isOpen ? null : key)}
              >
                <Text style={styles.itemName}>{pkg.name}</Text>
                <Text style={styles.itemMeta}>
                  {pkg.version} ・ {pkg.license}
                </Text>
              </TouchableOpacity>
              {isOpen && (
                <Text style={styles.licenseText}>
                  {text ?? fallback}
                </Text>
              )}
            </View>
          );
        })}
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
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  item: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingVertical: spacing.md,
  },
  itemName: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  itemMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  licenseText: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    backgroundColor: colors.neutralMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
});
