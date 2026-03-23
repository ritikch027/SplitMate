import { getReadableError } from "../utils/appError";

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_FOLDER =
  process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER || "splitmate/profile-photos";

export const uploadProfilePhoto = async (userId, localUri) => {
  try {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      throw new Error(
        "Cloudinary is not configured. Add cloud name and upload preset to your environment variables.",
      );
    }

    const fileName = `${userId}-${Date.now()}.jpg`;
    const formData = new FormData();

    formData.append("file", {
      uri: localUri,
      type: "image/jpeg",
      name: fileName,
    });
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", CLOUDINARY_FOLDER);
    formData.append("public_id", `${userId}-${Date.now()}`);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    const result = await response.json();

    if (!response.ok || !result.secure_url) {
      throw new Error(
        result?.error?.message || "Cloudinary could not upload your image.",
      );
    }

    return result.secure_url;
  } catch (error) {
    console.error("Profile photo upload error:", {
      code: error?.code || "cloudinary/upload-failed",
      message: error?.message,
      serverResponse: error?.serverResponse || null,
    });

    const friendlyError = getReadableError(
      error,
      "We couldn't upload your profile photo.",
    );

    throw new Error(friendlyError.message);
  }
};
