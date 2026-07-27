import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatDateLabel, relativeDayLabel, shiftDateString } from "../../lib/date";
import type { ISODateString } from "../../types/database";
import { colors, hitSlop, radius, spacing } from "../../lib/theme";

/** ホーム画面の日付切り替え導線。過去・未来のどちらへも移動できる */
export function DateNavigator({
  date,
  today,
  onChangeDate,
}: {
  date: ISODateString;
  today: ISODateString;
  onChangeDate: (date: ISODateString) => void;
}) {
  const isToday = date === today;
  const relative = relativeDayLabel(date, today);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.arrowButton}
          accessibilityRole="button"
          accessibilityLabel="前日"
          onPress={() => onChangeDate(shiftDateString(date, -1))}
        >
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.labelBox}>
          <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
          {relative && <Text style={styles.relativeLabel}>{relative}</Text>}
        </View>

        <TouchableOpacity
          style={styles.arrowButton}
          accessibilityRole="button"
          accessibilityLabel="翌日"
          onPress={() => onChangeDate(shiftDateString(date, 1))}
        >
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {!isToday && (
        <TouchableOpacity hitSlop={hitSlop} style={styles.todayLink} onPress={() => onChangeDate(today)}>
          <Text style={styles.todayLinkText}>今日へ戻る</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: {
    fontSize: 20,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  labelBox: {
    flex: 1,
    alignItems: "center",
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  relativeLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  todayLink: {
    alignSelf: "center",
    marginTop: spacing.sm,
  },
  todayLinkText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
  },
});
