import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './lib/supabase/auth-context';
import { AuthScreen } from './components/auth/AuthScreen';
import { MainApp } from './components/MainApp';

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>読み込み中...</Text>
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
});
