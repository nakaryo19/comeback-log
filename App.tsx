import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './lib/supabase/auth-context';
import { AuthScreen } from './components/auth/AuthScreen';
import { MainApp } from './components/MainApp';
import { colors } from './lib/theme';

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>読み込み中...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <>
      {session ? <MainApp /> : <AuthScreen />}
      <StatusBar style="auto" />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
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
