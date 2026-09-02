import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/supabase/auth-context";
import { describeDataError } from "../lib/supabase/data-errors";
import { fetchGoalTree, type GoalWithSubGoals } from "../lib/supabase/goals";
import { OnboardingScreen } from "./goals/OnboardingScreen";
import { GoalManagementScreen } from "./goals/GoalManagementScreen";
import { HomeScreen } from "./home/HomeScreen";
import { AnalyticsScreen } from "./analytics/AnalyticsScreen";
import { AccountScreen } from "./settings/AccountScreen";
import { DataExportScreen } from "./settings/DataExportScreen";
import { AboutScreen } from "./settings/AboutScreen";
import { colors, hitSlop, radius, shadow, spacing } from "../lib/theme";

type ViewName = "home" | "goals" | "analytics" | "account" | "export" | "about";

export function MainApp() {
  const { user, signOut } = useAuth();
  const [goals, setGoals] = useState<GoalWithSubGoals[] | null>(null);
  const [view, setView] = useState<ViewName>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * 目標の取得は**必ず失敗しうる**ものとして扱う。
   *
   * 直す前はここに try/catch が無く、`fetchGoalTree` が投げると `goals` が
   * null のままになり、画面は「読み込み中...」で永久に止まっていた。
   * しかも下の分岐は読み込み中の表示だけを返すため **☰ メニューも描画されず**、
   * ログアウトも再試行も画面移動もできない完全な行き止まりになる。
   * 通信が一度失敗しただけでアプリが使えなくなるということで、
   * これは利用者から見て「アプリが壊れている」のと区別が付かない。
   */
  const loadGoals = useCallback(async () => {
    if (!user) return;
    try {
      // 解除は成功してから。先に同期で消すと、この関数が useEffect から呼ばれる関係で
      // 「効果の中で直接 setState する」形になり、再試行のたびに一瞬エラーが消えて瞬く
      setGoals(await fetchGoalTree(user.id));
      setLoadError(null);
    } catch (e) {
      setLoadError(describeDataError(e, "目標の読み込みに失敗しました。"));
    }
  }, [user]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // 失敗の表示は読み込み中の判定より先に置く。`goals` は失敗しても null のままなので、
  // 順序を逆にすると読み込み中の表示に吸われてエラーに辿り着けない
  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
        {/* 出口を2つ用意する。再試行は通信が戻れば直る場合のため、
            ログアウトはそれでも直らない場合の最後の逃げ道 */}
        <TouchableOpacity
          style={styles.retryButton}
          accessibilityRole="button"
          onPress={loadGoals}
        >
          <Text style={styles.retryButtonText}>再試行</Text>
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={hitSlop}
          style={styles.signOutLink}
          accessibilityRole="button"
          onPress={signOut}
        >
          <Text style={styles.signOutLinkText}>ログアウト</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!user || goals === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  if (goals.length === 0) {
    return <OnboardingScreen onDone={loadGoals} />;
  }

  return (
    <View style={styles.flex}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.menuButton}
          accessibilityRole="button"
          accessibilityLabel="メニュー"
          onPress={() => setMenuOpen((prev) => !prev)}
        >
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {view === "home" ? (
        <HomeScreen
          goals={goals}
          onOpenGoalManagement={() => setView("goals")}
          onOpenAnalytics={() => setView("analytics")}
        />
      ) : view === "analytics" ? (
        <AnalyticsScreen onBack={() => setView("home")} />
      ) : view === "account" ? (
        <AccountScreen onBack={() => setView("home")} onOpenExport={() => setView("export")} />
      ) : view === "export" ? (
        <DataExportScreen onBack={() => setView("home")} />
      ) : view === "about" ? (
        <AboutScreen onBack={() => setView("home")} />
      ) : (
        <GoalManagementScreen
          goals={goals}
          onBack={() => setView("home")}
          onGoalsChanged={loadGoals}
        />
      )}
      {/* メニューは画面本体より後に置く。先に置くと本体のスクロール領域に重なりを取られ、
          Web で項目が押せなくなる */}
      {menuOpen && (
        <>
          {/* 外側をタップしたら閉じる。メニューを開いたまま操作を続けられると、
              本体の内容が隠れたままになる */}
          <Pressable
            style={styles.menuBackdrop}
            accessibilityLabel="メニューを閉じる"
            onPress={() => setMenuOpen(false)}
          />
          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItem}
              accessibilityRole="button"
              onPress={() => {
                setMenuOpen(false);
                signOut();
              }}
            >
              <Text style={styles.menuItemText}>ログアウト</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              accessibilityRole="button"
              onPress={() => {
                setMenuOpen(false);
                setView("export");
              }}
            >
              <Text style={styles.menuItemText}>データエクスポート</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              accessibilityRole="button"
              onPress={() => {
                setMenuOpen(false);
                setView("about");
              }}
            >
              <Text style={styles.menuItemText}>このアプリについて</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              accessibilityRole="button"
              onPress={() => {
                setMenuOpen(false);
                setView("account");
              }}
            >
              <Text style={styles.menuItemText}>アカウント削除</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textMuted,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  signOutLink: {
    marginTop: spacing.lg,
  },
  signOutLinkText: {
    color: colors.primary,
    fontSize: 14,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  menuButton: {
    // 44pt 四方を確保する。ヘッダーの操作は当たり判定を削らない
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  menuBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  menu: {
    position: "absolute",
    top: spacing.sm + 44,
    right: spacing.md,
    minWidth: 160,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    ...shadow.card,
  },
  menuItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuItemText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
});
