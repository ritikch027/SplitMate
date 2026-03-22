import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { radius, spacing } from "../constants/theme";

/*
|--------------------------------------------------------------------------
| SkeletonLoader Component
|--------------------------------------------------------------------------
*/

export default function SkeletonLoader({
  variant = "card",
  count = 1,
  width = 120,
}) {
  /*
  |--------------------------------------------------------------------------
  | Shared shimmer animation value
  |--------------------------------------------------------------------------
  */

  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
  }, [shimmer]);

  /*
  |--------------------------------------------------------------------------
  | Animated shimmer style
  |--------------------------------------------------------------------------
  */

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmer.value, [0, 1], [-200, 200]);

    return {
      transform: [{ translateX }],
    };
  });

  /*
  |--------------------------------------------------------------------------
  | Render skeleton variants
  |--------------------------------------------------------------------------
  */

  const renderSkeleton = (key) => {
    if (variant === "avatar") {
      return (
        <View key={key} style={styles.avatar}>
          <Animated.View style={[styles.shimmer, shimmerStyle]} />
        </View>
      );
    }

    if (variant === "text") {
      return (
        <View key={key} style={[styles.text, { width }]}>
          <Animated.View style={[styles.shimmer, shimmerStyle]} />
        </View>
      );
    }

    if (variant === "expense") {
      return (
        <View key={key} style={styles.expenseRow}>
          {/* Left circle */}
          <View style={styles.expenseIcon}>
            <Animated.View style={[styles.shimmer, shimmerStyle]} />
          </View>

          {/* Center text lines */}
          <View style={styles.expenseCenter}>
            <View style={styles.line}>
              <Animated.View style={[styles.shimmer, shimmerStyle]} />
            </View>

            <View style={[styles.line, { width: "60%" }]}>
              <Animated.View style={[styles.shimmer, shimmerStyle]} />
            </View>
          </View>

          {/* Right amount */}
          <View style={styles.expenseRight}>
            <Animated.View style={[styles.shimmer, shimmerStyle]} />
          </View>
        </View>
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Default: card skeleton
    |--------------------------------------------------------------------------
    */

    return (
      <View key={key} style={styles.card}>
        <Animated.View style={[styles.shimmer, shimmerStyle]} />
      </View>
    );
  };

  return <>{Array.from({ length: count }).map((_, i) => renderSkeleton(i))}</>;
}

/*
|--------------------------------------------------------------------------
| Styles
|--------------------------------------------------------------------------
*/

const styles = StyleSheet.create({
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#374151",
    opacity: 0.4,
  },

  card: {
    height: 70,
    width: "100%",
    borderRadius: radius.md,
    backgroundColor: "#1F2937",
    overflow: "hidden",
    marginBottom: spacing.md,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: "#1F2937",
    overflow: "hidden",
  },

  text: {
    height: 14,
    borderRadius: radius.sm,
    backgroundColor: "#1F2937",
    overflow: "hidden",
    marginBottom: spacing.sm,
  },

  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: "#1F2937",
    overflow: "hidden",
    marginRight: spacing.md,
  },

  expenseCenter: {
    flex: 1,
  },

  line: {
    height: 12,
    backgroundColor: "#1F2937",
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },

  expenseRight: {
    width: 60,
    height: 16,
    borderRadius: radius.sm,
    backgroundColor: "#1F2937",
    overflow: "hidden",
  },
});
