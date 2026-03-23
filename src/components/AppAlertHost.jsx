import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const VARIANT_CONFIG = {
  success: {
    emoji: "🎉",
    borderColor: "rgba(52,211,153,0.38)",
    iconBg: "rgba(16,185,129,0.16)",
    titleColor: "#ECFDF5",
  },
  error: {
    emoji: "⚠️",
    borderColor: "rgba(248,113,113,0.34)",
    iconBg: "rgba(239,68,68,0.14)",
    titleColor: "#FEF2F2",
  },
  info: {
    emoji: "📡",
    borderColor: "rgba(96,165,250,0.34)",
    iconBg: "rgba(59,130,246,0.14)",
    titleColor: "#EFF6FF",
  },
};

export default function AppAlertHost({
  visible,
  title,
  message,
  variant = "info",
  onClose,
}) {
  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 18,
          bounciness: 6,
        }),
      ]).start();
      return undefined;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -24,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    return undefined;
  }, [opacity, translateY, visible]);

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <Animated.View
        style={[
          styles.card,
          {
            opacity,
            transform: [{ translateY }],
            borderColor: config.borderColor,
          },
        ]}
      >
        <View style={[styles.emojiWrap, { backgroundColor: config.iconBg }]}>
          <Text style={styles.emoji}>{config.emoji}</Text>
        </View>

        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: config.titleColor }]}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "rgba(15,23,42,0.98)",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#020617",
    shadowOpacity: 0.34,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  emojiWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  emoji: {
    fontSize: 20,
  },
  textWrap: {
    flex: 1,
    paddingTop: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  message: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  closeText: {
    color: "#64748B",
    fontSize: 22,
    lineHeight: 22,
  },
});
