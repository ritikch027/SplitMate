import React, { useEffect } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { colors, fontSize, radius, spacing } from "../constants/theme";

const MemberAvatar = ({ name }) => (
  <View style={styles.avatar}>
    <Text style={styles.avatarText}>{name?.charAt(0) || "U"}</Text>
  </View>
);

function BalanceRow({ member, onSettlePress }) {
  const { name, amount, upiId, paidPercent = 0 } = member;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(paidPercent, { duration: 800 });
  }, [paidPercent, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  let statusText = "Settled up";
  let statusColor = colors.subtext;

  if (amount > 0) {
    statusText = `${name} owes you Rs ${amount}`;
    statusColor = colors.success;
  }

  if (amount < 0) {
    statusText = `You owe ${name} Rs ${Math.abs(amount)}`;
    statusColor = colors.danger;
  }

  const handleSettle = () => {
    if (!upiId) return;

    const url = `upi://pay?pa=${upiId}&am=${Math.abs(amount)}&tn=SplitMate`;

    Linking.openURL(url).catch(() => console.warn("UPI app not available"));
    onSettlePress?.(member);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <MemberAvatar name={name} />

        <View style={styles.center}>
          <Text style={styles.name}>{name}</Text>
          <Text style={[styles.status, { color: statusColor }]}>{statusText}</Text>
        </View>

        <View style={styles.right}>
          <Text style={[styles.amount, { color: statusColor }]}>
            Rs {Math.abs(amount)}
          </Text>

          {amount !== 0 && upiId ? (
            <TouchableOpacity style={styles.settleButton} onPress={handleSettle}>
              <Text style={styles.settleText}>Settle Up</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]}>
          <LinearGradient
            colors={[colors.accent, colors.cyan]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

export default function BalanceSummary({ balances, onSettlePress }) {
  return (
    <View style={styles.container}>
      {balances.map((member) => (
        <BalanceRow
          key={member.userId}
          member={member}
          onSettlePress={onSettlePress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.text,
    fontWeight: "600",
  },
  center: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  status: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  settleButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
  },
  settleText: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.card,
    borderRadius: radius.full,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
    overflow: "hidden",
  },
});
