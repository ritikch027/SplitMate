import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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
    const translateX = interpolate(shimmer.value, [0, 1], [-220, 260]);

    return {
      transform: [{ translateX }],
    };
  });

  const renderShimmer = () => (
    <Animated.View style={[styles.shimmerTrack, shimmerStyle]}>
      <LinearGradient
        colors={[
          "rgba(255,255,255,0)",
          "rgba(148,163,184,0.08)",
          "rgba(255,255,255,0.18)",
          "rgba(148,163,184,0.08)",
          "rgba(255,255,255,0)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.shimmerGradient}
      />
    </Animated.View>
  );

  /*
  |--------------------------------------------------------------------------
  | Render skeleton variants
  |--------------------------------------------------------------------------
  */

  const renderSkeleton = (key) => {
    if (variant === "avatar") {
      return (
        <View key={key} style={styles.avatar}>
          {renderShimmer()}
        </View>
      );
    }

    if (variant === "text") {
      return (
        <View key={key} style={[styles.text, { width }]}>
          {renderShimmer()}
        </View>
      );
    }

    if (variant === "home") {
      return (
        <View key={key} style={styles.homeWrap}>
          <View style={styles.homeHeader}>
            <View style={styles.homeHeaderText}>
              <View style={[styles.text, styles.homeKicker]}>
                {renderShimmer()}
              </View>
              <View style={[styles.text, styles.homeGreeting]}>
                {renderShimmer()}
              </View>
            </View>
            <View style={styles.homeAvatar}>
              {renderShimmer()}
            </View>
          </View>

          <View style={styles.homeSearch}>
            {renderShimmer()}
          </View>

          <View style={styles.homeStatsRow}>
            <View style={styles.homeStatCard}>
              {renderShimmer()}
            </View>
            <View style={styles.homeStatCard}>
              {renderShimmer()}
            </View>
          </View>

          <View style={[styles.text, styles.homeSectionTitle]}>
            {renderShimmer()}
          </View>

          {Array.from({ length: 4 }).map((_, index) => (
            <View key={`home-card-${index}`} style={styles.card}>
              {renderShimmer()}
            </View>
          ))}
        </View>
      );
    }

    if (variant === "expense") {
      return (
        <View key={key} style={styles.expenseRow}>
          {/* Left circle */}
          <View style={styles.expenseIcon}>
            {renderShimmer()}
          </View>

          {/* Center text lines */}
          <View style={styles.expenseCenter}>
            <View style={styles.line}>
              {renderShimmer()}
            </View>

            <View style={[styles.line, { width: "60%" }]}>
              {renderShimmer()}
            </View>
          </View>

          {/* Right amount */}
          <View style={styles.expenseRight}>
            {renderShimmer()}
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
        {renderShimmer()}
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
  shimmerTrack: {
    ...StyleSheet.absoluteFillObject,
    width: "55%",
  },
  shimmerGradient: {
    flex: 1,
  },

  card: {
    height: 70,
    width: "100%",
    borderRadius: radius.md,
    backgroundColor: "rgba(15,23,42,0.88)",
    overflow: "hidden",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: "rgba(15,23,42,0.88)",
    overflow: "hidden",
  },

  text: {
    height: 14,
    borderRadius: radius.sm,
    backgroundColor: "rgba(15,23,42,0.88)",
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  homeWrap: {
    paddingBottom: 4,
  },
  homeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  homeHeaderText: {
    flex: 1,
    marginRight: 16,
  },
  homeKicker: {
    width: "44%",
  },
  homeGreeting: {
    width: "72%",
    height: 24,
    marginBottom: 0,
  },
  homeAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.88)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    overflow: "hidden",
  },
  homeSearch: {
    height: 42,
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.88)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    overflow: "hidden",
    marginBottom: 20,
  },
  homeStatsRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 26,
  },
  homeStatCard: {
    flex: 1,
    minHeight: 74,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.88)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    overflow: "hidden",
  },
  homeSectionTitle: {
    width: 110,
    height: 16,
    marginBottom: 16,
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
    backgroundColor: "rgba(15,23,42,0.88)",
    overflow: "hidden",
    marginRight: spacing.md,
  },

  expenseCenter: {
    flex: 1,
  },

  line: {
    height: 12,
    backgroundColor: "rgba(15,23,42,0.88)",
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },

  expenseRight: {
    width: 60,
    height: 16,
    borderRadius: radius.sm,
    backgroundColor: "rgba(15,23,42,0.88)",
    overflow: "hidden",
  },
});
