import {
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut,
  getAuth,
  signInWithPhoneNumber,
} from "firebase/auth";

import { auth } from "../config/firebaseConfig";
import { clearRateLimit, enforceCooldown, enforceRateLimit } from "../utils/rateLimit";
import { createUser } from "./userService";

let confirmationResult = null;
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

  return `+91${localDigits}`;
};

/*
|--------------------------------------------------------------------------
| sendOTP(phoneNumber, recaptchaVerifier)
|--------------------------------------------------------------------------
| Sends OTP to user using Firebase Phone Authentication.
|
| Steps:
| 1. Ensure phone number is formatted to E.164 (+91XXXXXXXXXX)
| 2. Call Firebase signInWithPhoneNumber with recaptcha verifier
| 3. Store confirmation result
| 4. Return success response
|
| Note: recaptchaVerifier comes from FirebaseRecaptchaVerifierModal
*/
export const sendOTP = async (phoneNumber, recaptchaVerifier) => {
  try {
    const formattedNumber = normalizePhoneNumber(phoneNumber);

    // Check if recaptcha verifier is provided
    if (!recaptchaVerifier) {
      throw new Error("Recaptcha verifier not initialized. Please try again.");
    }

    const cooldown = enforceCooldown(`otp-cooldown:${formattedNumber}`, OTP_SEND_COOLDOWN_MS);
    if (!cooldown.allowed) {
      const seconds = Math.ceil(cooldown.retryAfterMs / 1000);
      throw new Error(`Please wait ${seconds}s before requesting another OTP.`);
    }

    const sendWindow = enforceRateLimit(`otp-window:${formattedNumber}`, {
      limit: OTP_SEND_LIMIT,
      windowMs: OTP_SEND_WINDOW_MS,
    });
    if (!sendWindow.allowed) {
      const minutes = Math.ceil(sendWindow.retryAfterMs / (60 * 1000));
      throw new Error(`Too many OTP requests. Try again in ${minutes} minute(s).`);
    }

    // Call Firebase phone auth with recaptcha verifier
    const confirmation = await signInWithPhoneNumber(
      auth,
      formattedNumber,
      recaptchaVerifier,
    );

    // Store confirmation result for later OTP verification
    confirmationResult = confirmation;
    lastOtpPhoneNumber = formattedNumber;
    verifyAttemptCount = 0;

    console.log("OTP sent successfully to", formattedNumber);
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
| verifyOTP(otp)
|--------------------------------------------------------------------------
| Verifies the OTP entered by the user.
|
| Steps:
| 1. Check confirmation result exists
| 2. Call confirmation.confirm(otp)
| 3. Firebase signs user in automatically
| 4. Create Firestore user doc (setDoc merge so safe for returning users)
| 5. Return authenticated user
*/
export const verifyOTP = async (otp) => {
  try {
    if (!confirmationResult) {
      return {
        success: false,
        error: "OTP session expired. Please request a new OTP.",
      };
    }

    const code = String(otp || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return {
        success: false,
        error: "Enter a valid 6-digit OTP.",
      };
    }

    verifyAttemptCount += 1;
    if (verifyAttemptCount > OTP_VERIFY_LIMIT) {
      confirmationResult = null;
      lastOtpPhoneNumber = null;
      throw new Error("Too many failed attempts. Please request a new OTP.");
    }

    // Confirm OTP with Firebase
    const result = await confirmationResult.confirm(code);
    const user = result.user;

    // Create Firestore user doc if this is first login.
    // Uses setDoc with merge: true internally so it won't
    // overwrite existing user data for returning users.
    await createUser(user.uid, user.phoneNumber);
    clearRateLimit(`otp-cooldown:${lastOtpPhoneNumber}`);
    verifyAttemptCount = 0;

    console.log("OTP verified successfully for user:", user.uid);
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
| Logs the current user out of Firebase authentication.
|
| Steps:
| 1. Call Firebase signOut
| 2. Clear confirmation result
*/
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);

    // Clear stored confirmation result
    confirmationResult = null;
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
| Returns currently authenticated Firebase user.
| If user is not logged in, returns null.
*/
export const getCurrentUser = () => {
  try {
    return getAuth().currentUser || null;
  } catch (error) {
    console.error("Get current user error:", error);
    return null;
  }
};

/*
|--------------------------------------------------------------------------
| onAuthStateChanged(callback)
|--------------------------------------------------------------------------
| Wrapper for Firebase auth listener.
|
| Allows app to listen for login/logout events.
| Returns unsubscribe function for cleanup.
*/
export const onAuthStateChanged = (callback) => {
  try {
    const unsubscribe = firebaseOnAuthStateChanged(auth, callback);
    return unsubscribe;
  } catch (error) {
    console.error("Auth state listener error:", error);
    return () => {};
  }
};
