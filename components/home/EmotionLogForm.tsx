import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createEmotionLog } from "../../lib/supabase/emotionLogs";
import type { EmotionLog, EmotionScore, UUID } from "../../types/database";

const SCORES: EmotionScore[] = [1, 2, 3, 4, 5];
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
      <Text style={styles.prompt}>今の気分は？</Text>

      <View style={styles.scoreRow}>
        {SCORES.map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.scoreButton, score === value && styles.scoreButtonActive]}
            onPress={() => setScore(value)}
          >
            <Text style={[styles.scoreButtonText, score === value && styles.scoreButtonTextActive]}>
              {value}
            </Text>
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
          multiline
          value={freeText}
          onChangeText={setFreeText}
        />
      ) : (
        <TouchableOpacity onPress={() => setExpanded(true)}>
          <Text style={styles.expandLink}>もう少し書く</Text>
        </TouchableOpacity>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actionRow}>
        <TouchableOpacity onPress={onSkip}>
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
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  prompt: {
    fontSize: 13,
    color: "#555",
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  scoreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  scoreButtonText: {
    fontSize: 14,
    color: "#333",
  },
  scoreButtonTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  tagChip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  tagChipActive: {
    backgroundColor: "#eef2ff",
    borderColor: "#2563eb",
  },
  tagChipText: {
    fontSize: 12,
    color: "#555",
  },
  tagChipTextActive: {
    color: "#2563eb",
    fontWeight: "600",
  },
  expandLink: {
    fontSize: 13,
    color: "#2563eb",
    marginBottom: 10,
  },
  freeTextInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  error: {
    color: "#b91c1c",
    fontSize: 12,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skipLink: {
    fontSize: 13,
    color: "#999",
  },
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  saveButtonDisabled: {
    backgroundColor: "#c7d2fe",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
