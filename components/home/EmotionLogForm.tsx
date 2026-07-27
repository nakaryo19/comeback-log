import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createEmotionLog } from "../../lib/supabase/emotionLogs";
import type { EmotionLog, EmotionScore, UUID } from "../../types/database";
import { colors, hitSlop, radius, spacing } from "../../lib/theme";

const SCORES: EmotionScore[] = [1, 2, 3, 4, 5];
const SCORE_EMOJI: Record<EmotionScore, string> = {
  1: "😞",
  2: "🙁",
  3: "😐",
  4: "🙂",
  5: "😄",
};
const TAGS = ["不安", "達成感", "焦り", "集中", "疲労"];

export function EmotionLogForm({
  taskId,
  onSaved,
  onSkip,
}: {
  taskId: UUID;
  onSaved: (log: EmotionLog) => void;
  onSkip: () => void;
}) {
  const [score, setScore] = useState<EmotionScore | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (score === null) return;
    setSaving(true);
    try {
      const log = await createEmotionLog({
        taskId,
        score,
        tag,
        freeText: freeText.trim() || null,
      });
      onSaved(log);
    } catch (e) {
      setError(e instanceof Error ? e.message : "記録に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>お疲れさまでした。今の気分は？</Text>

      <View style={styles.scoreRow}>
        {SCORES.map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.scoreButton, score === value && styles.scoreButtonActive]}
            onPress={() => setScore(value)}
          >
            <Text style={styles.scoreEmoji}>{SCORE_EMOJI[value]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tagRow}>
        {TAGS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tagChip, tag === t && styles.tagChipActive]}
            onPress={() => setTag(tag === t ? null : t)}
          >
            <Text style={[styles.tagChipText, tag === t && styles.tagChipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {expanded ? (
        <TextInput
          style={styles.freeTextInput}
          placeholder="よければ、もう少し書いてみてください"
          placeholderTextColor={colors.textMuted}
          multiline
          value={freeText}
          onChangeText={setFreeText}
        />
      ) : (
        <TouchableOpacity hitSlop={hitSlop} onPress={() => setExpanded(true)}>
          <Text style={styles.expandLink}>もう少し書く</Text>
        </TouchableOpacity>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actionRow}>
        <TouchableOpacity hitSlop={hitSlop} onPress={onSkip}>
          <Text style={styles.skipLink}>あとで</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, score === null && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={score === null || saving}
        >
          <Text style={styles.saveButtonText}>{saving ? "記録中..." : "記録する"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  prompt: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  scoreRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  scoreButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  scoreButtonActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  scoreEmoji: {
    fontSize: 18,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tagChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
  },
  tagChipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  tagChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tagChipTextActive: {
    color: colors.primaryDark,
    fontWeight: "600",
  },
  expandLink: {
    fontSize: 13,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  freeTextInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skipLink: {
    fontSize: 13,
    color: colors.textMuted,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 13,
  },
});
