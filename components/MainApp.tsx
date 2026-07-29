import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/supabase/auth-context";
import { fetchGoalTree, type GoalWithSubGoals } from "../lib/supabase/goals";
import { OnboardingScreen } from "./goals/OnboardingScreen";
import { GoalManagementScreen } from "./goals/GoalManagementScreen";
import { HomeScreen } from "./home/HomeScreen";
import { AnalyticsScreen } from "./analytics/AnalyticsScreen";
import { colors, spacing } from "../lib/theme";

type ViewName = "home" | "goals" | "analytics";

export function MainApp() {
  const { user, signOut } = useAuth();
  const [goals, setGoals] = useState<GoalWithSubGoals[] | null>(null);
  const [view, setView] = useState<ViewName>("home");

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
      {view === "home" ? (
        <HomeScreen
          goals={goals}
          onOpenGoalManagement={() => setView("goals")}
          onOpenAnalytics={() => setView("analytics")}
        />
      ) : view === "analytics" ? (
        <AnalyticsScreen onBack={() => setView("home")} />
      ) : (
        <GoalManagementScreen
          goals={goals}
          onBack={() => setView("home")}
          onGoalsChanged={loadGoals}
        />
      )}
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutButtonText}>ログアウト</Text>
      </TouchableOpacity>
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
  signOutButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  signOutButtonText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
