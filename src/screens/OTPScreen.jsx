import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
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

import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import AnimatedBackdrop from "../components/AnimatedBackdrop";
import { firebaseConfig } from "../config/firebaseConfig";
import { colors, fontSize, spacing } from "../constants/theme";
import { sendOTP, verifyOTP } from "../services/authService";

export default function OTPScreen({ route }) {
  const { phone } = route.params;

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(59);
  const [statusText, setStatusText] = useState("");

  const inputs = useRef([]);
  const recaptchaRef = useRef(null);
  const shake = useSharedValue(0);

  const maskedPhone = `${phone.slice(0, 3)} ••• ••• ${phone.slice(phone.length - 4)}`;

  useEffect(() => {
    if (timer === 0) return undefined;

    const interval = setInterval(() => {
      setTimer((current) => current - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  const animatedStyle = useAnimatedStyle(() => ({
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

  const verify = async (code) => {
    if (code.length !== 6) return;

    try {
      setLoading(true);
      setError("");
      setStatusText("");

      const result = await verifyOTP(code);

      if (!result.success) {
        setError(result.error || "Invalid OTP");
        triggerShake();
        return;
      }

      setStatusText("Verified. Taking you inside...");
    } catch {
      setError("Invalid OTP");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    if (timer > 0) return;

    setError("");
    const result = await sendOTP(phone, recaptchaRef.current);

    if (!result.success) {
      setError(result.error || "Failed to resend OTP");
      return;
    }

    setTimer(59);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />

      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={firebaseConfig}
      />

      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed-outline" size={30} color={colors.accent} />
        </View>
        <Text style={styles.title}>Verify Identity</Text>
        <Text style={styles.subtitle}>
          We&apos;ve sent a 6-digit verification code to{" "}
          <Text style={styles.subtitleStrong}>{maskedPhone}</Text>
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).springify()} style={animatedStyle}>
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

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}

      <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.buttonWrap}>
        <TouchableOpacity disabled={loading} activeOpacity={0.9} onPress={() => verify(otp.join(""))}>
          <View style={styles.button}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify Account</Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220)} style={styles.footer}>
        <Text style={styles.timerText}>
          Resend code in <Text style={styles.timerValue}>00:{String(timer).padStart(2, "0")}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 34,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.16)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.22)",
    marginBottom: 26,
  },
  title: {
    color: "#F3F4F6",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#8B93A7",
    fontSize: fontSize.md,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  subtitleStrong: {
    color: "#F3F4F6",
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
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    textAlign: "center",
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700",
  },
  otpFilled: {
    borderColor: "rgba(124,58,237,0.6)",
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
    color: "#8B93A7",
    fontSize: fontSize.sm,
  },
  timerValue: {
    color: colors.accent,
    fontWeight: "700",
  },
  resend: {
    marginTop: spacing.lg,
    color: "#B7C0D2",
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  resendDisabled: {
    color: "#5D6677",
  },
});
