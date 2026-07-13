import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthProvider, useAuth } from './lib/supabase/auth-context';
import { AuthScreen } from './components/auth/AuthScreen';

function AppContent() {
  const { session, loading, signOut } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>読み込み中...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <AuthScreen />
        <StatusBar style="auto" />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <Text>ログイン済み: {session.user.email}</Text>
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutButtonText}>ログアウト</Text>
      </TouchableOpacity>
      <StatusBar style="auto" />
    </View>
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
  signOutButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  signOutButtonText: {
    color: '#2563eb',
    fontWeight: '600',
  },
});
