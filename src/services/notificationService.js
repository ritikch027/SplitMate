import { supabase } from "../config/supabaseConfig";
import { sendPushNotificationsToUsers } from "./pushNotificationService";

const NOTIFICATIONS_TABLE = "notifications";

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

    await sendPushNotificationsToUsers(recipients, {
      title: payload.title,
      body: payload.message,
      data: {
        type: payload.type,
        groupId: payload.groupId || null,
        expenseId: payload.expenseId || null,
      },
    });

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

    refetchNotifications(userId, onUpdate);

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error("Notifications listener error:", error);
    return () => {};
  }
};

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
