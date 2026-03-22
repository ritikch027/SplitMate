import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "../config/firebaseConfig";

const ALLOWED_PROFILE_FIELDS = new Set([
  "name",
  "photoUrl",
  "profileCompleted",
  "phone",
  "groups",
]);

const sanitizeName = (name) => {
  const cleaned = String(name || "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > 60) {
    throw new Error("Name must be 60 characters or fewer.");
  }

  return cleaned;
};

const sanitizePhone = (phone) => {
  if (!phone) return "";

  const digits = String(phone).replace(/\D/g, "");
  const localDigits = digits.length > 10 ? digits.slice(-10) : digits;

  if (!/^\d{10}$/.test(localDigits)) {
    throw new Error("Phone number must be a valid 10-digit number.");
  }

  return `+91${localDigits}`;
};

const sanitizeProfileUpdate = (data = {}) => {
  const sanitized = {};

  Object.entries(data).forEach(([key, value]) => {
    if (!ALLOWED_PROFILE_FIELDS.has(key)) return;

    if (key === "name") {
      sanitized.name = sanitizeName(value);
      return;
    }

    if (key === "phone") {
      sanitized.phone = sanitizePhone(value);
      return;
    }

    if (key === "photoUrl") {
      const url = String(value || "").trim();
      if (url && !/^https?:\/\//i.test(url)) {
        throw new Error("Photo URL must be a valid http(s) URL.");
      }
      sanitized.photoUrl = url;
      return;
    }

    if (key === "profileCompleted") {
      sanitized.profileCompleted = Boolean(value);
      return;
    }

    if (key === "groups") {
      sanitized.groups = Array.isArray(value) ? [...new Set(value.filter(Boolean))] : [];
    }
  });

  return sanitized;
};

/*
|--------------------------------------------------------------------------
| createUser(userId, phoneNumber)
|--------------------------------------------------------------------------
| Creates a new user document if it does not already exist.
|
| Firestore path:
| users/{userId}
*/
export const createUser = async (userId, phoneNumber) => {
  try {
    const userRef = doc(db, "users", userId);

    // Check if user already exists — don't overwrite returning users
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
      return {
        success: true,
        user: snapshot.data(),
      };
    }

    const newUser = {
      id: userId,
      phone: sanitizePhone(phoneNumber),
      name: "",
      photoUrl: "",
      profileCompleted: false,
      createdAt: serverTimestamp(),
      groups: [],
    };

    await setDoc(userRef, newUser);

    return {
      success: true,
      user: newUser,
    };
  } catch (error) {
    console.error("Create user error:", error);
    return {
      success: false,
      error: error.message || "Failed to create user profile",
    };
  }
};

/*
|--------------------------------------------------------------------------
| getUser(userId)
|--------------------------------------------------------------------------
| Fetch user profile from Firestore.
*/
export const getUser = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      return {
        success: false,
        error: "User not found",
      };
    }

    return {
      success: true,
      user: snapshot.data(),
    };
  } catch (error) {
    console.error("Get user error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch user",
    };
  }
};

/*
|--------------------------------------------------------------------------
| updateUser(userId, data)
|--------------------------------------------------------------------------
| Updates fields for an existing user.
|
| Uses setDoc with merge: true so:
| - It CREATES the doc if it doesn't exist (no more "no document" error)
| - It UPDATES only the provided fields if it does exist
| - No extra getDoc check needed → no race conditions
|
| Example usage:
| updateUser(uid, { name: "Rahul", profileCompleted: true })
*/
export const updateUser = async (userId, data) => {
  try {
    const userRef = doc(db, "users", userId);
    const sanitizedData = sanitizeProfileUpdate(data);

    if (Object.keys(sanitizedData).length === 0) {
      throw new Error("No valid profile fields were provided.");
    }

    // setDoc with merge: true is safer than updateDoc
    // because it works whether or not the doc exists
    await setDoc(
      userRef,
      {
        ...sanitizedData,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return { success: true };
  } catch (error) {
    console.error("Update user error:", error);
    return {
      success: false,
      error: error.message || "Failed to update user",
    };
  }
};

/*
|--------------------------------------------------------------------------
| getUsersByPhone(phoneNumbers)
|--------------------------------------------------------------------------
| Fetch multiple users by phone numbers.
|
| Used when adding members to a group.
| Firestore "in" query supports max 10 items.
*/
export const getUsersByPhone = async (phoneNumbers) => {
  try {
    if (!phoneNumbers || phoneNumbers.length === 0) {
      return { success: true, users: [] };
    }

    // Firestore allows max 10 values in "in" queries
    const limitedNumbers = phoneNumbers.slice(0, 10);

    const q = query(
      collection(db, "users"),
      where("phone", "in", limitedNumbers),
    );

    const snapshot = await getDocs(q);

    const users = [];
    snapshot.forEach((doc) => users.push(doc.data()));

    return { success: true, users };
  } catch (error) {
    console.error("Get users by phone error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch users",
    };
  }
};

/*
|--------------------------------------------------------------------------
| getUsersByIds(userIds)
|--------------------------------------------------------------------------
| Fetch multiple users by their user IDs.
|
| Used when loading group member profiles.
| Deduplicates IDs before fetching.
*/
export const getUsersByIds = async (userIds) => {
  try {
    if (!userIds || userIds.length === 0) {
      return { success: true, users: [] };
    }

    const uniqueIds = [...new Set(userIds)];

    const users = [];

    for (const userId of uniqueIds) {
      const snapshot = await getDoc(doc(db, "users", userId));
      if (snapshot.exists()) {
        users.push(snapshot.data());
      }
    }

    return { success: true, users };
  } catch (error) {
    console.error("Get users by ids error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch users",
    };
  }
};
