export const EXPENSE_NOTIFICATION_TYPES = new Set([
  "expense_added",
  "expense_updated",
  "expense_deleted",
  "payment_reminder",
  "settlement",
]);

export const GROUP_NOTIFICATION_TYPES = new Set([
  "group_created",
  "group_member_added",
  "group_member_joined",
  "group_member_removed",
  "group_member_left",
]);

const getNotificationData = (notification = {}) => notification?.data || {};

export const getNotificationTarget = (notification = {}) => {
  const data = getNotificationData(notification);
  const type = notification.type || data.type || "";
  const groupId = notification.groupId || data.groupId || null;

  if (
    groupId &&
    (GROUP_NOTIFICATION_TYPES.has(type) || EXPENSE_NOTIFICATION_TYPES.has(type))
  ) {
    return {
      name: "GroupDetailsScreen",
      params: { groupId },
    };
  }

  return {
    name: "Activity",
    params: undefined,
  };
};

export const getNotificationDeepLink = (notification = {}) => {
  const target = getNotificationTarget(notification);

  if (target.name === "GroupDetailsScreen" && target.params?.groupId) {
    return `splitmate://group/${target.params.groupId}`;
  }

  return "splitmate://activity";
};

export const navigateToNotificationTarget = (navigation, notification = {}) => {
  const target = getNotificationTarget(notification);

  if (target.name === "GroupDetailsScreen") {
    navigation.navigate(target.name, target.params);
    return;
  }

  navigation.navigate("Activity");
};

export const navigateFromRootNotification = (
  navigationRef,
  notification = {},
  attempt = 0,
) => {
  if (!navigationRef?.isReady?.()) {
    if (attempt < 10) {
      setTimeout(() => {
        navigateFromRootNotification(navigationRef, notification, attempt + 1);
      }, 250);
    }
    return false;
  }

  const target = getNotificationTarget(notification);

  if (target.name === "GroupDetailsScreen") {
    navigationRef.navigate(target.name, target.params);
    return true;
  }

  navigationRef.navigate("MainTabs", { screen: "Activity" });
  return true;
};
