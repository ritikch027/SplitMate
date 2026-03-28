import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedBackdrop from "../components/AnimatedBackdrop";
import ScreenHeader from "../components/ScreenHeader";
import { colors, fontSize, spacing } from "../constants/theme";
import { useAlert } from "../context/useAlert";
import { useAuth } from "../context/useAuth";
import {
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notificationService";
import { navigateToNotificationTarget } from "../utils/notificationRouting";

const NOTIFICATION_ICON = {
  expense_added: "receipt-outline",
  expense_updated: "create-outline",
  expense_deleted: "trash-outline",
  group_created: "people-outline",
  group_member_added: "person-add-outline",
  group_member_joined: "people-outline",
  group_member_removed: "person-remove-outline",
  group_member_left: "exit-outline",
};

const formatRelativeTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "Just now";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

function NotificationItem({ item, index, onPress }) {
  const iconName = NOTIFICATION_ICON[item.type] || "notifications-outline";

  return (
    <Animated.View entering={FadeInDown.delay(index * 45).springify()}>
      <TouchableOpacity
        activeOpacity={0.88}
        style={[styles.itemCard, !item.read && styles.itemCardUnread]}
        onPress={() => onPress(item)}
      >
        <View style={styles.itemIconWrap}>
          <Ionicons name={iconName} size={18} color={colors.accent} />
        </View>
        <View style={styles.itemBody}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {!item.read ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={styles.itemMessage}>{item.message}</Text>
          <Text style={styles.itemTime}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function NotificationsScreen({ navigation }) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) return undefined;

    const unsubscribe = getUserNotifications(user.uid, setNotifications);
    return unsubscribe;
  }, [user]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const handleOpenNotification = async (notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    navigateToNotificationTarget(navigation, notification);
  };

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;

    const result = await markAllNotificationsAsRead(user.uid);
    if (!result.success) {
      showAlert({
        title: "Unable to update",
        message: result.error || "Please try again.",
        variant: "error",
      });
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 16) + 6,
          paddingBottom: Math.max(insets.bottom, 20),
        },
      ]}
    >
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />

      <View style={styles.content}>
        <ScreenHeader
          title="Notifications"
          subtitle={
            unreadCount > 0
              ? `${unreadCount} unread update${unreadCount > 1 ? "s" : ""}`
              : "You're all caught up"
          }
          onBack={() => navigation.goBack()}
        />

        <TouchableOpacity
          activeOpacity={0.88}
          style={[styles.markAllButton, unreadCount === 0 && styles.markAllDisabled]}
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0}
        >
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <NotificationItem
              item={item}
              index={index}
              onPress={handleOpenNotification}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="notifications-off-outline"
                size={32}
                color="#64748B"
              />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>
                Group activity and expense updates will appear here.
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050816",
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
  },
  markAllButton: {
    alignSelf: "flex-end",
    marginTop: 8,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.24)",
    backgroundColor: "rgba(124,58,237,0.12)",
  },
  markAllDisabled: {
    opacity: 0.5,
  },
  markAllText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    paddingBottom: 28,
    gap: 12,
  },
  itemCard: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
  },
  itemCardUnread: {
    borderColor: "rgba(124,58,237,0.32)",
    backgroundColor: "rgba(30,41,59,0.96)",
  },
  itemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.12)",
  },
  itemBody: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  itemTitle: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: fontSize.md,
    fontWeight: "800",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  itemMessage: {
    color: "#CBD5E1",
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: 6,
  },
  itemTime: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 72,
  },
  emptyTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 14,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
});
