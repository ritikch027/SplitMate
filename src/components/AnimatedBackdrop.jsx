import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";

import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

function GlowOrb({ color, size, top, left, delay = 0, drift = "y" }) {
  const opacity = useSharedValue(0.18);
  const offset = useSharedValue(0);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.34, {
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
      <GlowOrb color="#7C3AED" size={260} top={-70} left={-90} delay={0} />
      <GlowOrb
        color="#06B6D4"
        size={220}
        top={height * 0.2}
        left={width - 140}
        delay={700}
        drift="x"
      />
      <GlowOrb
        color="#8B5CF6"
        size={180}
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
    opacity: 0.2,
    shadowColor: "#7C3AED",
    shadowOpacity: 0.35,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});
