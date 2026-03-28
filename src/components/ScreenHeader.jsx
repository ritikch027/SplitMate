import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { colors, fontSize, spacing, surfaces } from "../constants/theme";

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  compact = false,
}) {
  return (
    <View style={[styles.row, compact && styles.compactRow]}>
      <View style={styles.side}>
        {onBack ? (
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={onBack}
            style={styles.iconButton}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.side}>{right || <View style={styles.placeholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  compactRow: {
    marginBottom: spacing.md,
  },
  side: {
    width: 48,
    alignItems: "flex-start",
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: surfaces.input,
    borderWidth: 1,
    borderColor: surfaces.border,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  title: {
    color: "#F8FAFC",
    fontSize: fontSize.lg,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: colors.subtext,
    fontSize: fontSize.sm,
    fontWeight: "500",
    marginTop: 3,
    textAlign: "center",
  },
});
