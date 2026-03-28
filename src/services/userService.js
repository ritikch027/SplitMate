import { supabase } from "../config/supabaseConfig";

const USERS_TABLE = "users";

const getUserServiceErrorMessage = (
  error,
  fallback = "User service request failed.",
) => {
  if (error?.code === "PGRST205") {
    return "The Supabase 'users' table is missing. Create public.users and refresh the schema cache.";
  }

  return error?.message || fallback;
};

const ALLOWED_PROFILE_FIELDS = new Set([
  "name",
  "photoUrl",
  "profileCompleted",
  "phone",
  "groups",
  "upiId",
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

    if (key === "upiId") {
      const upiId = String(value || "").trim();
      if (upiId && !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) {
        throw new Error("UPI ID must look like name@bank.");
      }
      sanitized.upiId = upiId;
      return;
    }

    if (key === "profileCompleted") {
      sanitized.profileCompleted = Boolean(value);
      return;
    }

    if (key === "groups") {
      sanitized.groups = Array.isArray(value)
        ? [...new Set(value.filter(Boolean))]
        : [];
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
| Supabase table: users
*/
export const createUser = async (userId, phoneNumber) => {
  try {
    // Check if user already exists — don't overwrite returning users
    const { data: existingUser, error: fetchError } = await supabase
      .from(USERS_TABLE)
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 is "not found"
      throw fetchError;
    }

    if (existingUser) {
      return {
        success: true,
        user: existingUser,
      };
    }

    const newUser = {
      id: userId,
      phone: sanitizePhone(phoneNumber),
      name: "",
      photoUrl: "",
      upiId: "",
      profileCompleted: false,
      createdAt: new Date().toISOString(),
      groups: [],
    };

    const { data, error } = await supabase
      .from(USERS_TABLE)
      .insert(newUser)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Another auth/bootstrap path may have created the same user row first.
        const { data: existingAfterConflict, error: refetchError } =
          await supabase
            .from(USERS_TABLE)
            .select("*")
            .eq("id", userId)
            .single();

        if (!refetchError && existingAfterConflict) {
          return {
            success: true,
            user: existingAfterConflict,
          };
        }
      }

      throw error;
    }

    return {
      success: true,
      user: data,
    };
  } catch (error) {
    console.error("Create user error:", error);
    return {
      success: false,
      error: getUserServiceErrorMessage(error, "Failed to create user profile"),
    };
  }
};

/*
|--------------------------------------------------------------------------
| getUser(userId)
|--------------------------------------------------------------------------
| Fetch user profile from Supabase.
*/
export const getUser = async (userId) => {
  try {
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return {
          success: false,
          error: "User not found",
        };
      }
      throw error;
    }

    return {
      success: true,
      user: data,
    };
  } catch (error) {
    console.error("Get user error:", error);
    return {
      success: false,
      error: getUserServiceErrorMessage(error, "Failed to fetch user"),
    };
  }
};

/*
|--------------------------------------------------------------------------
| updateUser(userId, data)
|--------------------------------------------------------------------------
| Updates fields for an existing user.
|
| Uses upsert so:
| - It CREATES the doc if it doesn't exist (no more "no document" error)
| - It UPDATES only the provided fields if it does exist
| - No extra get check needed → no race conditions
|
| Example usage:
| updateUser(uid, { name: "Rahul", profileCompleted: true })
*/
export const updateUser = async (userId, data) => {
  try {
    const sanitizedData = sanitizeProfileUpdate(data);

    if (Object.keys(sanitizedData).length === 0) {
      throw new Error("No valid profile fields were provided.");
    }

    const { error } = await supabase.from(USERS_TABLE).upsert({
      id: userId,
      ...sanitizedData,
      updatedAt: new Date().toISOString(),
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Update user error:", error);
    return {
      success: false,
      error: getUserServiceErrorMessage(error, "Failed to update user"),
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
| Supabase "in" query supports more than 10 items.
*/
export const getUsersByPhone = async (phoneNumbers) => {
  try {
    if (!phoneNumbers || phoneNumbers.length === 0) {
      return { success: true, users: [] };
    }

    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select("*")
      .in("phone", phoneNumbers);

    if (error) throw error;

    return { success: true, users: data || [] };
  } catch (error) {
    console.error("Get users by phone error:", error);
    return {
      success: false,
      error: getUserServiceErrorMessage(error, "Failed to fetch users"),
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

    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select("*")
      .in("id", uniqueIds);

    if (error) throw error;

    return { success: true, users: data || [] };
  } catch (error) {
    console.error("Get users by ids error:", error);
    return {
      success: false,
      error: getUserServiceErrorMessage(error, "Failed to fetch users"),
    };
  }
};
