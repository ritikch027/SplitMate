import { supabase } from "../config/supabaseConfig";
import {
  clearRateLimit,
  enforceCooldown,
  enforceRateLimit,
} from "../utils/rateLimit";
import { unregisterPushTokenForUser } from "./pushNotificationService";
import { createUser } from "./userService";

let lastOtpPhoneNumber = null;
let verifyAttemptCount = 0;

const OTP_SEND_COOLDOWN_MS = 59 * 1000;
const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
const OTP_SEND_LIMIT = 5;
const OTP_VERIFY_LIMIT = 6;

const normalizePhoneNumber = (phoneNumber) => {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  const localDigits = digits.length > 10 ? digits.slice(-10) : digits;

  if (!/^\d{10}$/.test(localDigits)) {
    throw new Error("Enter a valid 10-digit phone number.");
  }

  return `91${localDigits}`;
};

export const sendOTP = async (phoneNumber) => {
  try {
    const formattedNumber = normalizePhoneNumber(phoneNumber);

    const verifyNum = `+${formattedNumber}`;

    const cooldown = enforceCooldown(
      `otp-cooldown:${verifyNum}`,
      OTP_SEND_COOLDOWN_MS,
    );
    if (!cooldown.allowed) {
      const seconds = Math.ceil(cooldown.retryAfterMs / 1000);
      throw new Error(`Please wait ${seconds}s before requesting another OTP.`);
    }

    const sendWindow = enforceRateLimit(`otp-window:${verifyNum}`, {
      limit: OTP_SEND_LIMIT,
      windowMs: OTP_SEND_WINDOW_MS,
    });
    if (!sendWindow.allowed) {
      const minutes = Math.ceil(sendWindow.retryAfterMs / (60 * 1000));
      throw new Error(
        `Too many OTP requests. Try again in ${minutes} minute(s).`,
      );
    }

    const { error } = await supabase.auth.signInWithOtp({
      phone: verifyNum,
    });

    if (error) throw error;

    lastOtpPhoneNumber = verifyNum;
    verifyAttemptCount = 0;

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to send OTP",
    };
  }
};

export const verifyOTP = async (phoneNumber, otp) => {
  try {
    if (otp === undefined && /^\d{6}$/.test(String(phoneNumber || "").trim())) {
      otp = phoneNumber;
      phoneNumber = lastOtpPhoneNumber;
    }

    if (!phoneNumber) {
      phoneNumber = lastOtpPhoneNumber;
    }

    if (!phoneNumber) {
      return {
        success: false,
        error: "Phone number not provided. Please request OTP again.",
      };
    }

    const formattedNumber = normalizePhoneNumber(phoneNumber);
    const code = String(otp || "").trim();

    if (!/^\d{6}$/.test(code)) {
      return {
        success: false,
        error: "Enter a valid 6-digit OTP.",
      };
    }

    verifyAttemptCount += 1;
    if (verifyAttemptCount > OTP_VERIFY_LIMIT) {
      lastOtpPhoneNumber = null;
      throw new Error("Too many failed attempts. Please request a new OTP.");
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+${formattedNumber}`,
      token: code,
      type: "sms",
    });

    if (error) throw error;

    const user = data.user;

    // 🔥 CRITICAL FIX: wait for session to be ready
    let session = null;
    let attempts = 0;

    while (!session && attempts < 5) {
      const res = await supabase.auth.getSession();
      session = res.data.session;

      if (!session) {
        await new Promise((r) => setTimeout(r, 300));
        attempts++;
      }
    }

    if (!session) {
      throw new Error("Session not ready after OTP verification");
    }

    await createUser(user.id, user.phone);
    clearRateLimit(`otp-cooldown:${lastOtpPhoneNumber}`);
    verifyAttemptCount = 0;

    return {
      success: true,
      user,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Invalid OTP",
    };
  }
};

export const signOut = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      await unregisterPushTokenForUser(user.id);
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    lastOtpPhoneNumber = null;
    verifyAttemptCount = 0;

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to sign out",
    };
  }
};

export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) throw error;

    return user || null;
  } catch {
    return null;
  }
};

export const onAuthStateChanged = (callback) => {
  try {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      callback(session); // ✅ pass full session (not just user)
    });

    return () => {
      subscription.unsubscribe();
    };
  } catch {
    return () => {};
  }
};
