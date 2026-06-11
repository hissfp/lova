import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { langFlag, langName } from "@/src/constants/languages";
import { colors, fonts, radius, spacing } from "@/src/theme";

interface LanguagePairProps {
  native?: string | null;
  learning?: string | null;
  compact?: boolean;
}

export const LanguagePair: React.FC<LanguagePairProps> = ({
  native,
  learning,
  compact,
}) => (
  <View style={styles.row}>
    <View style={[styles.chip, styles.nativeChip]}>
      <Text style={styles.chipText}>
        {langFlag(native)} {compact ? native?.toUpperCase() : langName(native)}
      </Text>
    </View>
    <Ionicons
      name="swap-horizontal"
      size={14}
      color={colors.onSurfaceSecondary}
      style={{ marginHorizontal: spacing.xs }}
    />
    <View style={[styles.chip, styles.learningChip]}>
      <Text style={[styles.chipText, styles.learningText]}>
        {langFlag(learning)}{" "}
        {compact ? learning?.toUpperCase() : langName(learning)}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  nativeChip: {
    backgroundColor: colors.brandTertiary,
  },
  learningChip: {
    backgroundColor: colors.surfaceSecondary,
  },
  chipText: {
    fontSize: 12,
    fontFamily: fonts.textBold,
    color: colors.onBrandTertiary,
  },
  learningText: {
    color: colors.onSurfaceSecondary,
  },
});
