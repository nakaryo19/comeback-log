import { Component, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius, spacing } from "../lib/theme";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * 描画中の例外を受け止めて、代わりの画面を出す。
 *
 * React は描画中に例外が出るとツリー全体を捨てる。境界を置かないと**白画面**になり、
 * 利用者にはアプリが壊れたようにしか見えず、再起動以外の手が残らない。
 *
 * クラスコンポーネントなのは仕様上の制約。`componentDidCatch` に相当するフックは
 * 存在しないため、ここだけは関数コンポーネントにできない。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // 開発時のみ。外部には送らない。
    // エラーの文脈には感情ログの自由記述が混ざりうるため、送信先を作ってはならない（CLAUDE.md）。
    // B5（エラー監視）を入れるときも、この原則が満たせるかを先に確かめること
    if (__DEV__) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          {/* 落ち度が利用者にあるかのような書き方をしない。
              このアプリの利用者は「うまくいかなかったこと」に向き合っている最中で、
              失敗を突きつける文面はそれ自体が負荷になる（CLAUDE.md の表現トーン） */}
          <Text style={styles.title}>画面を表示できませんでした</Text>
          <Text style={styles.body}>
            一時的な不具合の可能性があります。{"\n"}
            保存済みの記録が消えることはありません。
          </Text>

          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>もう一度読み込む</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            繰り返し表示される場合は、アプリを一度終了してから開き直してください。
          </Text>

          {/* 原因の手がかりは開発時だけ出す。英語の例外文をそのまま利用者に見せない
              （B11 と同じ理由）。ただし開発中に握りつぶすと原因追跡ができなくなる */}
          {__DEV__ && <Text style={styles.devDetail}>{this.state.error.message}</Text>}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    padding: spacing.md + 2,
    alignItems: "center",
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  devDetail: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
