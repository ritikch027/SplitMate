const includesAny = (value, patterns) =>
  patterns.some((pattern) => value.includes(pattern));

export const getReadableError = (
  error,
  fallbackMessage = "Something went wrong. Please try again.",
) => {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  const combined = `${code} ${message}`;

  if (
    includesAny(combined, [
      "offline",
      "unavailable",
      "network-request-failed",
      "client is offline",
    ])
  ) {
    return {
      title: "You’re offline",
      message: "Check your internet connection and try again.",
      variant: "info",
    };
  }

  if (
    includesAny(combined, [
      "permission-denied",
      "insufficient permissions",
      "unauthorized",
    ])
  ) {
    return {
      title: "Access denied",
      message:
        "This action is not allowed right now. Check your Supabase RLS policies or sign-in state.",
      variant: "error",
    };
  }

  if (
    includesAny(combined, [
      "storage/unknown",
      "unknown error occurred",
      "unknown error occured",
      "cloudinary",
    ])
  ) {
    return {
      title: "Upload failed",
      message:
        "Image upload could not finish. Check your Cloudinary config, preset, and network connection.",
      variant: "error",
    };
  }

  return {
    title: "Something went wrong",
    message: error?.message || fallbackMessage,
    variant: "error",
  };
};
