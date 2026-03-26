import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedBackdrop from "../components/AnimatedBackdrop";
import { colors, fontSize, spacing } from "../constants/theme";
import { sendOTP } from "../services/authService";

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const validatePhone = () => {
    if (!/^[0-9]{10}$/.test(phone)) {
      setError("Enter a valid 10-digit phone number");
      return false;
    }

    setError("");
    return true;
  };

  const handleContinue = async () => {
    if (!validatePhone()) return;

    try {
      setLoading(true);
      const fullPhone = `+91${phone}`;
      const result = await sendOTP(fullPhone);

      if (result.success) {
        navigation.navigate("OTPScreen", { phone: fullPhone });
      } else {
        setError(result.error || "Failed to send OTP");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <LinearGradient
          colors={[colors.accent, colors.cyan]}
          style={styles.logoWrap}
        >
          <Ionicons name="git-branch-outline" size={30} color="#fff" />
        </LinearGradient>
        <Text style={styles.logo}>SplitMate</Text>
        <Text style={styles.tagline}>Splitting bills made effortless.</Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120).springify()}
        style={styles.card}
      >
        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.prefix}>+91</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="98765 43210"
            placeholderTextColor="#5B6476"
            value={phone}
            onChangeText={setPhone}
            editable={!loading}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.buttonWrap}
          onPress={handleContinue}
          disabled={loading}
        >
          <LinearGradient
            colors={[colors.accent, colors.cyan]}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220)} style={styles.footer}>
        <Text style={styles.terms}>
          By continuing, you agree to our Terms and Privacy Policy
        </Text>
        <View style={styles.securityRow}>
          <View style={styles.securityLine} />
          <Text style={styles.securityText}>Secure Fintech Grade</Text>
          <View style={styles.securityLine} />
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1020",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  glowTop: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(124,58,237,0.18)",
  },
  glowBottom: {
    position: "absolute",
    right: -120,
    bottom: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(6,182,212,0.14)",
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logo: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "800",
  },
  tagline: {
    color: "#8B93A7",
    fontSize: fontSize.sm,
    marginTop: 8,
  },
  card: {
    padding: 28,
    borderRadius: 12,
    backgroundColor: "rgba(20, 28, 45, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  label: {
    color: "#8B93A7",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
  },
  prefix: {
    color: "#AAB3C5",
    fontSize: fontSize.md,
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: fontSize.md,
  },
  error: {
    color: "#F87171",
    marginTop: 12,
    fontSize: fontSize.sm,
  },
  buttonWrap: {
    marginTop: 22,
  },
  button: {
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  buttonText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  footer: {
    marginTop: 28,
    alignItems: "center",
  },
  terms: {
    color: "#717A8B",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  securityRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "center",
  },
  securityLine: {
    width: 28,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  securityText: {
    color: "#4F596B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginHorizontal: 14,
  },
});
