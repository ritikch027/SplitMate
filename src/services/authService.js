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

const OTP_SEND_COOLDOWN_MS = 45 * 1000;
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

const sendOTPphone = (phoneNum) => {
  return `+${phoneNum}`;
};

/*
|--------------------------------------------------------------------------
| sendOTP(phoneNumber)
|--------------------------------------------------------------------------
| Sends OTP to user using Supabase Phone Authentication.
|
| Steps:
| 1. Ensure phone number is formatted to E.164 (+91XXXXXXXXXX)
| 2. Call Supabase signInWithOtp
| 3. Return success response
|
| Note: No recaptchaVerifier needed - Supabase handles verification automatically
*/
export const sendOTP = async (phoneNumber) => {
  try {
    const formattedNumber = normalizePhoneNumber(phoneNumber);
    const verifyNum = sendOTPphone(formattedNumber);

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

    // Call Supabase phone auth
    const { error } = await supabase.auth.signInWithOtp({
      phone: verifyNum,
    });

    if (error) {
      throw error;
    }

    lastOtpPhoneNumber = verifyNum;
    verifyAttemptCount = 0;

    console.log("OTP sent successfully to", verifyNum);
    return { success: true };
  } catch (error) {
    console.error("Send OTP Error:", error);

    return {
      success: false,
      error: error.message || "Failed to send OTP",
    };
  }
};

/*
|--------------------------------------------------------------------------
| verifyOTP(phoneNumber, otp)
|--------------------------------------------------------------------------
| Verifies the OTP entered by the user.
|
| Steps:
| 1. Format phone number
| 2. Call Supabase verifyOtp
| 3. Supabase signs user in automatically
| 4. Create user profile in database (upsert so safe for returning users)
| 5. Return authenticated user
*/
export const verifyOTP = async (phoneNumber, otp) => {
  try {
    // Backward compatibility: allow older call sites that passed only the OTP.
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

    // Verify OTP with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      phone: sendOTPphone(formattedNumber),
      token: code,
      type: "sms",
    });

    if (error) {
      throw error;
    }

    const user = data.user;

    // Create user profile if this is first login.
    // Uses upsert so it won't overwrite existing user data for returning users.
    await createUser(user.id, user.phone);
    clearRateLimit(`otp-cooldown:${lastOtpPhoneNumber}`);
    verifyAttemptCount = 0;

    console.log("OTP verified successfully for user:", user.id);
    return {
      success: true,
      user,
    };
  } catch (error) {
    console.error("Verify OTP Error:", error);

    return {
      success: false,
      error: error.message || "Invalid OTP",
    };
  }
};

/*
|--------------------------------------------------------------------------
| signOut()
|--------------------------------------------------------------------------
| Logs the current user out of Supabase authentication.
|
| Steps:
| 1. Call Supabase signOut
| 2. Clear stored state
*/
export const signOut = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      await unregisterPushTokenForUser(user.id);
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    // Clear stored state
    lastOtpPhoneNumber = null;
    verifyAttemptCount = 0;

    console.log("User signed out successfully");
    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);

    return {
      success: false,
      error: error.message || "Failed to sign out",
    };
  }
};

/*
|--------------------------------------------------------------------------
| getCurrentUser()
|--------------------------------------------------------------------------
| Returns currently authenticated Supabase user.
| If user is not logged in, returns null.
*/
export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return user || null;
  } catch (error) {
    console.error("Get current user error:", error);
    return null;
  }
};

/*
|--------------------------------------------------------------------------
| onAuthStateChanged(callback)
|--------------------------------------------------------------------------
| Wrapper for Supabase auth listener.
|
| Allows app to listen for login/logout events.
| Returns unsubscribe function for cleanup.
*/
export const onAuthStateChanged = (callback) => {
  try {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null);
    });

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  } catch (error) {
    console.error("Auth state listener error:", error);
    return () => {};
  }
};
