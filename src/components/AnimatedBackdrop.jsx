import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";

import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors, surfaces } from "../constants/theme";

const { width, height } = Dimensions.get("window");

function GlowOrb({ color, size, top, left, delay = 0, drift = "y" }) {
  const opacity = useSharedValue(0.12);
  const offset = useSharedValue(0);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.22, {
        duration: 3200 + delay,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );

    offset.value = withRepeat(
      withTiming(18, {
        duration: 4200 + delay,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [delay, offset, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      drift === "x"
        ? { translateX: offset.value }
        : { translateY: offset.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        {
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function AnimatedBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.backdropVeil} />
      <View style={styles.softMist} />
      <GlowOrb color={colors.accent} size={300} top={-90} left={-110} delay={0} />
      <GlowOrb
        color={colors.cyan}
        size={250}
        top={height * 0.2}
        left={width - 150}
        delay={700}
        drift="x"
      />
      <GlowOrb
        color="#8B5CF6"
        size={210}
        top={height * 0.62}
        left={30}
        delay={1300}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    opacity: 0.14,
    shadowColor: colors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 64,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  backdropVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,15,30,0.28)",
  },
  softMist: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: surfaces.screen,
    opacity: 0.18,
  },
});
