import { supabase } from "../config/supabaseConfig";
import { sendPushNotificationsToUsers } from "./pushNotificationService";
import { getNotificationDeepLink, getNotificationTarget } from "../utils/notificationRouting";

const NOTIFICATIONS_TABLE = "notifications";

/*
|--------------------------------------------------------------------------
| requireSession
|--------------------------------------------------------------------------
| Guards any Supabase function invoke call.
| If session is not ready, throws an error instead of
| sending a request with a null JWT (which causes 401).
|
| Always call this before supabase.functions.invoke()
*/
const requireSession = async () => {
  // First try to get existing session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) return session;

  // Session not ready yet — wait up to 3 seconds
  return new Promise((resolve, reject) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription.unsubscribe();
        reject(new Error("Session not ready. Cannot send notification."));
      }
    }, 3000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession?.access_token && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        subscription.unsubscribe();
        resolve(newSession);
      }
    });
  });
};

const getNotificationServiceErrorMessage = (
  error,
  fallback = "Notification service request failed.",
) => {
  if (error?.code === "PGRST205") {
    return "The Supabase 'notifications' table is missing. Create public.notifications and refresh the schema cache.";
  }
  return error?.message || fallback;
};

const refetchNotifications = async (userId, onUpdate) => {
  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .select("*")
    .eq("userId", userId)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error(
      "Error fetching notifications:",
      getNotificationServiceErrorMessage(error),
      error,
    );
    return;
  }

  onUpdate(data || []);
};

const buildPushNotificationData = (payload = {}) => {
  const target = getNotificationTarget(payload);

  return {
    type: payload.type,
    groupId: payload.groupId || null,
    expenseId: payload.expenseId || null,
    amount: payload.metadata?.amount ?? null,
    actorName: payload.metadata?.actorName ?? null,
    reason: payload.metadata?.reason ?? payload.metadata?.description ?? null,
    groupName: payload.metadata?.groupName ?? null,
    targetScreen: target.name,
    deepLink: getNotificationDeepLink(payload),
  };
};

/*
|--------------------------------------------------------------------------
| createNotificationsForUsers
|--------------------------------------------------------------------------
| Saves notification rows to DB and sends push notifications.
|
| Session guard ensures we never invoke Edge Function
| with a null JWT — which would cause 401 Invalid JWT.
*/
export const createNotificationsForUsers = async (
  userIds,
  payload,
  actorId,
) => {
  try {
    const recipients = [...new Set((userIds || []).filter(Boolean))].filter(
      (userId) => userId !== actorId,
    );

    if (!recipients.length) {
      return { success: true, count: 0 };
    }

    // ── Save notifications to DB ──
    const notifications = recipients.map((userId) => ({
      ...payload,
      userId,
      actorId,
      read: false,
      createdAt: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .insert(notifications);

    if (error) throw error;

    // ── Send push notifications ──
    // requireSession() ensures JWT is valid before invoking Edge Function
    // If session isn't ready, we skip push (DB notification is already saved)
    try {
      await requireSession();

      await sendPushNotificationsToUsers(recipients, {
        title: payload.title,
        body: payload.message,
        data: buildPushNotificationData(payload),
      });
    } catch (sessionError) {
      // Push notification failed but DB notification was saved
      // This is acceptable — user will see it in-app
      console.warn(
        "Push notification skipped — session not ready:",
        sessionError.message,
      );
    }

    return { success: true, count: notifications.length };
  } catch (error) {
    console.error("Create notifications error:", error);
    return {
      success: false,
      error: getNotificationServiceErrorMessage(
        error,
        "Failed to create notifications",
      ),
    };
  }
};

/*
|--------------------------------------------------------------------------
| getUserNotifications(userId, onUpdate)
|--------------------------------------------------------------------------
| Real-time listener for notifications belonging to a user.
| Returns unsubscribe function.
*/
export const getUserNotifications = (userId, onUpdate) => {
  try {
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: NOTIFICATIONS_TABLE,
          filter: `userId=eq.${userId}`,
        },
        () => {
          refetchNotifications(userId, onUpdate);
        },
      )
      .subscribe();

    // Initial fetch
    refetchNotifications(userId, onUpdate);

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error("Notifications listener error:", error);
    return () => {};
  }
};

/*
|--------------------------------------------------------------------------
| markNotificationAsRead(notificationId)
|--------------------------------------------------------------------------
*/
export const markNotificationAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .update({ read: true })
      .eq("id", notificationId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Mark notification read error:", error);
    return {
      success: false,
      error: getNotificationServiceErrorMessage(
        error,
        "Failed to mark notification as read",
      ),
    };
  }
};

/*
|--------------------------------------------------------------------------
| markAllNotificationsAsRead(userId)
|--------------------------------------------------------------------------
*/
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .update({ read: true })
      .eq("userId", userId)
      .eq("read", false);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return {
      success: false,
      error: getNotificationServiceErrorMessage(
        error,
        "Failed to mark all notifications as read",
      ),
    };
  }
};
