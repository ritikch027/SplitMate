import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedBackdrop from "../components/AnimatedBackdrop";
import { colors, fontSize, spacing } from "../constants/theme";
import { sendOTP, verifyOTP } from "../services/authService";

export default function OTPScreen({ navigation, route }) {
  const { phone } = route.params;
  const insets = useSafeAreaInsets();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(59);
  const [statusText, setStatusText] = useState("");

  const inputs = useRef([]);
  const shake = useSharedValue(0);

  const maskedPhone = `${phone.slice(0, 2)} •••• ${phone.slice(phone.length - 4)}`;

  /*──────────────────────────────────────────────────────────────
    Countdown timer
  ──────────────────────────────────────────────────────────────*/
  useEffect(() => {
    if (timer === 0) return;

    const interval = setInterval(() => {
      setTimer((current) => current - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  /*──────────────────────────────────────────────────────────────
    Shake animation — only transform, no entering
  ──────────────────────────────────────────────────────────────*/
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const triggerShake = () => {
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  /*──────────────────────────────────────────────────────────────
    OTP input handler
  ──────────────────────────────────────────────────────────────*/
  const handleChange = (value, index) => {
    const digit = value.replace(/\D/g, "");
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);

    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (!digit && index > 0) {
      inputs.current[index - 1]?.focus();
    }

    if (nextOtp.every((item) => item !== "")) {
      verify(nextOtp.join(""));
    }
  };

  /*──────────────────────────────────────────────────────────────
    Verify OTP
  ──────────────────────────────────────────────────────────────*/
  const verify = async (code) => {
    if (code.length !== 6) return;

    try {
      setLoading(true);
      setError("");
      setStatusText("");

      const result = await verifyOTP(phone, code);

      if (!result.success) {
        setError(result.error || "Invalid OTP");
        triggerShake();
        return;
      }

      setStatusText("Verified. Preparing your account...");
    } catch {
      setError("Invalid OTP");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  /*──────────────────────────────────────────────────────────────
    Resend OTP
  ──────────────────────────────────────────────────────────────*/
  const resendOTP = async () => {
    if (timer > 0) return;

    setError("");
    const result = await sendOTP(phone);

    if (!result.success) {
      setError(result.error || "Failed to resend OTP");
      return;
    }

    setTimer(59);
  };

  /*──────────────────────────────────────────────────────────────
    Render
  ──────────────────────────────────────────────────────────────*/
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />

      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons
            name="lock-closed-outline"
            size={30}
            color={colors.accent}
          />
        </View>
        <Text style={styles.title}>Verify Identity</Text>
        <Text style={styles.subtitle}>
          We&apos;ve sent a 6-digit verification code to{" "}
          <Text style={styles.subtitleStrong}>{maskedPhone}</Text>
        </Text>
      </Animated.View>

      {/* ── OTP inputs ──
          FIX: entering on outer wrapper, transform (shake) on inner wrapper
          Never put both on the same Animated.View
      ──────────────────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        {/* ← entering lives here  */}
        <Animated.View style={shakeStyle}>
          {/* ← transform lives here */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputs.current[index] = ref;
                }}
                style={[styles.otpBox, digit ? styles.otpFilled : null]}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(value) => handleChange(value, index)}
                placeholder="•"
                placeholderTextColor="#6B7280"
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>

      {/* ── Error / status ── */}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}

      {/* ── Verify button ── */}
      <Animated.View
        entering={FadeInDown.delay(160).springify()}
        style={styles.buttonWrap}
      >
        <TouchableOpacity
          disabled={loading}
          activeOpacity={0.9}
          onPress={() => verify(otp.join(""))}
        >
          <View style={styles.button}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify Account</Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Footer / resend ── */}
      <Animated.View entering={FadeInDown.delay(220)} style={styles.footer}>
        <Text style={styles.timerText}>
          Resend code in{" "}
          <Text style={styles.timerValue}>
            00:{String(timer).padStart(2, "0")}
          </Text>
        </Text>

        <TouchableOpacity disabled={timer > 0} onPress={resendOTP}>
          <Text style={[styles.resend, timer > 0 && styles.resendDisabled]}>
            Didn&apos;t receive code? Resend
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

/*──────────────────────────────────────────────────────────────
  Styles
──────────────────────────────────────────────────────────────*/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 34,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.82)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    marginBottom: 26,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: fontSize.md,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  subtitleStrong: {
    color: "#E2E8F0",
    fontWeight: "700",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  otpBox: {
    width: 42,
    height: 50,
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.88)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    textAlign: "center",
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700",
  },
  otpFilled: {
    backgroundColor: "rgba(30,41,59,0.88)",
    borderColor: "rgba(124,58,237,0.55)",
  },
  error: {
    color: "#F87171",
    textAlign: "center",
    marginBottom: 14,
    fontSize: fontSize.sm,
  },
  statusText: {
    color: "#34D399",
    textAlign: "center",
    marginBottom: 14,
    fontSize: fontSize.sm,
  },
  buttonWrap: {
    marginTop: 4,
  },
  button: {
    height: 50,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
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
  timerText: {
    color: "#94A3B8",
    fontSize: fontSize.sm,
  },
  timerValue: {
    color: colors.accent,
    fontWeight: "700",
  },
  resend: {
    marginTop: spacing.lg,
    color: "#CBD5E1",
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  resendDisabled: {
    color: "#64748B",
  },
});
