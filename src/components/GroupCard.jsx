import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, fontSize, spacing } from "../constants/theme";
import MemberAvatar from "./MemberAvatar";

const ICON_COLORS = ["#7C3AED", "#5B8CFF", "#F59E0B", "#4f7b6c", "#EC4899"];

const formatTimeAgo = (timestamp) => {
  if (!timestamp?.toDate) return "RECENTLY";

  const diff = Date.now() - timestamp.toDate().getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return "JUST NOW";
  if (hours < 24) return `${hours} HOURS AGO`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "YESTERDAY";

  return `${days} DAYS AGO`;
};

export default function GroupCard({ group, userBalance = 0, onPress }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 120 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };

  const iconColor = useMemo(() => {
    return ICON_COLORS[group.id.charCodeAt(0) % ICON_COLORS.length];
  }, [group.id]);

  const members = group.members || [];
  const visibleMembers = members.slice(0, 3);
  const extra = members.length - visibleMembers.length;

  let balanceText = "Settled";
  let chipStyle = styles.settledChip;

  if (userBalance > 0) {
    balanceText = `Owed Rs ${Math.abs(userBalance).toFixed(0)}`;
    chipStyle = styles.positiveChip;
  }

  if (userBalance < 0) {
    balanceText = `Owe Rs ${Math.abs(userBalance).toFixed(0)}`;
    chipStyle = styles.negativeChip;
  }

  return (
    <TouchableWithoutFeedback
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={[styles.iconBox, { backgroundColor: `${iconColor}22` }]}>
          <Text style={styles.iconEmoji}>{group.emoji || "👥"}</Text>
        </View>

        <View style={styles.center}>
          <Text style={styles.groupName} numberOfLines={1}>
            {group.name}
          </Text>

          <View style={styles.avatarStack}>
            {visibleMembers.map((member, index) => {
              const name =
                typeof member === "string"
                  ? member
                  : member?.name || member?.phone || "User";
              const photoUrl =
                typeof member === "string" ? "" : member?.photoUrl || "";

              return (
                <View key={index} style={[styles.avatar, { left: index * 14 }]}>
                  <MemberAvatar
                    name={name}
                    photoUrl={photoUrl}
                    size="small"
                  />
                </View>
              );
            })}

            {extra > 0 ? (
              <View style={[styles.avatarMore, { left: visibleMembers.length * 14 }]}>
                <Text style={styles.avatarMoreText}>+{extra}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.right}>
          <View style={[styles.balanceChip, chipStyle]}>
            <Text style={styles.balanceText}>{balanceText}</Text>
          </View>
          <Text style={styles.activityText}>{formatTimeAgo(group.lastActivity)}</Text>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: "rgba(30, 41, 59, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  iconEmoji: {
    fontSize: 20,
  },
  center: {
    flex: 1,
  },
  groupName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  avatarStack: {
    marginTop: 9,
    height: 22,
  },
  avatar: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#121A29",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMore: {
    position: "absolute",
    width: 24,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#64748B",
    borderWidth: 1.5,
    borderColor: "#121A29",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMoreText: {
    color: "#F8FAFC",
    fontSize: 9,
    fontWeight: "700",
  },
  right: {
    alignItems: "flex-end",
    marginLeft: spacing.sm,
  },
  balanceChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 8,
  },
  balanceText: {
    fontSize: 11,
    fontWeight: "800",
  },
  positiveChip: {
    backgroundColor: "rgba(16,185,129,0.14)",
  },
  negativeChip: {
    backgroundColor: "rgba(239,68,68,0.14)",
  },
  settledChip: {
    backgroundColor: "rgba(100,116,139,0.16)",
  },
  activityText: {
    marginTop: 8,
    color: "#64748B",
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
});
