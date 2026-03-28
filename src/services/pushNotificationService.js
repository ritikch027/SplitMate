import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { navigationRef } from "../navigation/navigationRef";
import { supabase } from "../config/supabaseConfig";
import { navigateFromRootNotification } from "../utils/notificationRouting";

const PUSH_TOKEN_CACHE_KEY = "splitmate:expo-push-token";
let lastHandledNotificationId = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const getPushServiceErrorMessage = (
  error,
  fallback = "Push notification request failed.",
) => error?.message || fallback;

const getFunctionErrorDetails = async (error) => {
  if (!error?.context) {
    return null;
  }

  try {
    return await error.context.json();
  } catch (_jsonError) {
    try {
      const text = await error.context.text();
      return { error: text };
    } catch (_textError) {
      return null;
    }
  }
};

const getProjectId = () =>
  Constants?.expoConfig?.extra?.eas?.projectId ??
  Constants?.easConfig?.projectId ??
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

const getNotificationResponseData = (response) =>
  response?.notification?.request?.content?.data || {};

const handleNotificationResponse = (response) => {
  const notificationId = response?.notification?.request?.identifier;

  if (notificationId && notificationId === lastHandledNotificationId) {
    return;
  }

  lastHandledNotificationId = notificationId || null;
  navigateFromRootNotification(navigationRef, getNotificationResponseData(response));
};

export const registerPushTokenForUser = async (
  userId,
  expoPushToken,
  deviceName = "",
) => {
  try {
    if (!userId || !expoPushToken) {
      return { success: false, error: "User ID and push token are required." };
    }

    const { error } = await supabase.rpc("claim_push_token", {
      p_token: expoPushToken,
      p_platform: Platform.OS,
      p_device_name: deviceName,
    });

    if (error) throw error;

    await AsyncStorage.setItem(PUSH_TOKEN_CACHE_KEY, expoPushToken);

    return { success: true, token: expoPushToken };
  } catch (error) {
    console.error("Register push token error:", error);
    return {
      success: false,
      error: getPushServiceErrorMessage(error, "Failed to register push token"),
    };
  }
};

export const unregisterPushTokenForUser = async (userId) => {
  try {
    const cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_CACHE_KEY);
    if (!userId || !cachedToken) {
      return { success: true };
    }

    const { error } = await supabase.rpc("release_push_token", {
      p_token: cachedToken,
    });

    if (error) throw error;

    await AsyncStorage.removeItem(PUSH_TOKEN_CACHE_KEY);

    return { success: true };
  } catch (error) {
    console.error("Unregister push token error:", error);
    return {
      success: false,
      error: getPushServiceErrorMessage(
        error,
        "Failed to unregister push token",
      ),
    };
  }
};

export const initializePushNotifications = async (userId) => {
  try {
    if (!Device.isDevice) {
      return {
        success: false,
        error: "Push notifications require a physical device.",
      };
    }

    const projectId = getProjectId();
    if (!projectId) {
      return {
        success: false,
        error:
          "Expo projectId not found. Set the EAS projectId before testing push notifications.",
      };
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#7C3AED",
      });
    }

    const permissionStatus = await Notifications.getPermissionsAsync();
    let finalStatus = permissionStatus.status;

    if (finalStatus !== "granted") {
      const request = await Notifications.requestPermissionsAsync();
      finalStatus = request.status;
    }

    if (finalStatus !== "granted") {
      return {
        success: false,
        error: "Notification permission was not granted.",
      };
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    return registerPushTokenForUser(
      userId,
      token,
      Device.deviceName || Device.modelName || "",
    );
  } catch (error) {
    console.error("Initialize push notifications error:", error);
    return {
      success: false,
      error: getPushServiceErrorMessage(
        error,
        "Failed to initialize push notifications",
      ),
    };
  }
};

export const sendPushNotificationsToUsers = async (
  userIds,
  notificationPayload,
) => {
  try {
    const recipients = [...new Set((userIds || []).filter(Boolean))];

    if (!recipients.length) {
      return { success: true, count: 0 };
    }

    const { error } = await supabase.functions.invoke("send-push-notifications", {
      body: {
        userIds: recipients,
        notification: notificationPayload,
      },
    });

    if (error) throw error;

    return { success: true, count: recipients.length };
  } catch (error) {
    const details = await getFunctionErrorDetails(error);
    console.error("Send push notifications error:", error, details);
    return {
      success: false,
      error:
        details?.error ||
        getPushServiceErrorMessage(
          error,
          "Failed to send push notifications",
        ),
    };
  }
};

export const setupPushNotificationNavigation = () => {
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    })
    .catch((error) => {
      console.warn("Unable to restore last notification response:", error);
    });

  const subscription = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse,
  );

  return () => {
    subscription.remove();
  };
};
