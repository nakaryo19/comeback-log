import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を .env.local に設定してください。",
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // パスワード再設定のメールリンクは、Webでは URL のハッシュにトークンを載せて戻ってくる。
      // Web で false のままだとアプリがそれを読み取れず、リンク経由の復旧が成立しない。
      // ネイティブには「今開いている URL」が無いためこの仕組みは使えない。false のままにし、
      // ディープリンクで受け取った URL を auth-context 側で自前に解釈する（recovery-link.ts）。
      detectSessionInUrl: Platform.OS === "web",
    },
  },
);

// アプリがバックグラウンドに回っている間はトークンの自動リフレッシュを止める
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
