import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './lib/supabase/auth-context';
import { AuthScreen } from './components/auth/AuthScreen';
import { PasswordRecoveryScreen } from './components/auth/PasswordRecoveryScreen';
import { MainApp } from './components/MainApp';
import { colors } from './lib/theme';

function AppContent() {
  const { session, loading, recovering } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>読み込み中...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  // 再設定リンクを踏むと一時的にセッションが張られる。そのままアプリに入れず、
  // 新しいパスワードを決めてもらうまでは復旧画面を優先する。
  return (
    <>
      {recovering ? <PasswordRecoveryScreen /> : session ? <MainApp /> : <AuthScreen />}
      <StatusBar style="auto" />
    </>
  );
}

/**
 * セーフエリアとキーボード回避は、画面ごとではなくここで一括して面倒を見る。
 * 個別対応にすると、画面を追加するたびに付け忘れが起きる（Phase 2 でダッシュボードが増える）。
 *
 * - SafeAreaView：ノッチ／ダイナミックアイランドとホームインジケータへの潜り込みを防ぐ
 * - KeyboardAvoidingView：iOS はキーボードが出ても画面が押し上がらないため、入力欄が隠れる。
 *   Android は OS 側が調整するので behavior を指定しない
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: colors.textMuted,
  },
});
