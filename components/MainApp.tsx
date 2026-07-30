import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/supabase/auth-context";
import { fetchGoalTree, type GoalWithSubGoals } from "../lib/supabase/goals";
import { OnboardingScreen } from "./goals/OnboardingScreen";
import { GoalManagementScreen } from "./goals/GoalManagementScreen";
import { HomeScreen } from "./home/HomeScreen";
import { AnalyticsScreen } from "./analytics/AnalyticsScreen";
import { AccountScreen } from "./settings/AccountScreen";
import { colors, radius, shadow, spacing } from "../lib/theme";

type ViewName = "home" | "goals" | "analytics" | "account";

export function MainApp() {
  const { user, signOut } = useAuth();
  const [goals, setGoals] = useState<GoalWithSubGoals[] | null>(null);
  const [view, setView] = useState<ViewName>("home");
  const [menuOpen, setMenuOpen] = useState(false);

  const loadGoals = useCallback(async () => {
    if (!user) return;
    setGoals(await fetchGoalTree(user.id));
  }, [user]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

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
        <AccountScreen onBack={() => setView("home")} />
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
