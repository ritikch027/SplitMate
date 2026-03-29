import React, { useCallback, useEffect, useRef, useState } from "react";
import Clipboard from "react-native/Libraries/Components/Clipboard/Clipboard";
import {
  Alert,
  AppState,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Linking from "expo-linking";

import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedBackdrop from "../components/AnimatedBackdrop";
import MemberAvatar from "../components/MemberAvatar";
import ScreenHeader from "../components/ScreenHeader";
import SkeletonLoader from "../components/SkeletonLoader";
import {
  buttonTokens,
  fontSize,
  radius,
  spacing,
  surfaces,
} from "../constants/theme";
import { useAlert } from "../context/useAlert";
import { useAuth } from "../context/useAuth";
import {
  getUserBalancesAcrossAllGroups,
  recordSettlement,
  sendBalanceReminder,
} from "../services/balanceService";
import {
  formatCurrency,
  getNetTotal,
  getTotalOwe,
  getTotalOwed,
} from "../utils/balanceCalculator";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "owed", label: "Owed" },
  { key: "owe", label: "Owe" },
];

const getInitialFilter = (mode) => {
  if (mode === "owed" || mode === "owe") return mode;
  return "all";
};

const buildSettlementPlan = (balance) => {
  const groupBalances = Array.isArray(balance?.groupBalances) ? balance.groupBalances : [];
  const plan = groupBalances
    .filter((groupBalance) => Number(groupBalance?.netBalance || 0) < 0)
    .map((groupBalance) => ({
      groupId: groupBalance.groupId,
      groupName: groupBalance.groupName || "your group",
      amount: Math.abs(Number(groupBalance.netBalance || 0)),
    }))
    .filter((item) => item.groupId && item.amount > 0);

  if (plan.length > 0) {
    return plan;
  }

  const fallbackGroupId = balance?.latestGroupId || balance?.sharedGroups?.[0]?.id || null;
  const fallbackAmount = Math.abs(Number(balance?.netBalance || 0));
  if (!fallbackGroupId || fallbackAmount <= 0) {
    return [];
  }

  return [
    {
      groupId: fallbackGroupId,
      groupName: balance?.latestGroupName || balance?.sharedGroups?.[0]?.name || "your group",
      amount: fallbackAmount,
    },
  ];
};

const buildReminderPlan = (balance) => {
  const groupBalances = Array.isArray(balance?.groupBalances) ? balance.groupBalances : [];
  const plan = groupBalances
    .filter((groupBalance) => Number(groupBalance?.netBalance || 0) > 0)
    .map((groupBalance) => ({
      groupId: groupBalance.groupId,
      groupName: groupBalance.groupName || "your group",
      amount: Number(groupBalance.netBalance || 0),
    }))
    .filter((item) => item.groupId && item.amount > 0);

  if (plan.length > 0) {
    return plan;
  }

  const fallbackGroupId = balance?.latestGroupId || balance?.sharedGroups?.[0]?.id || null;
  const fallbackAmount = Number(balance?.netBalance || 0);
  if (!fallbackGroupId || fallbackAmount <= 0) {
    return [];
  }

  return [
    {
      groupId: fallbackGroupId,
      groupName: balance?.latestGroupName || balance?.sharedGroups?.[0]?.name || "your group",
      amount: fallbackAmount,
    },
  ];
};

function SummaryCard({ label, value, tone = "neutral" }) {
  const valueStyle =
    tone === "positive"
      ? styles.summaryValuePositive
      : tone === "negative"
        ? styles.summaryValueNegative
        : styles.summaryValue;

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function ActionButton({ icon, label, tone, onPress }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 18, stiffness: 220 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.actionPressable}
    >
      <Animated.View
        style={[
          styles.actionButton,
          tone === "positive" ? styles.remindButton : styles.payButton,
          animatedStyle,
        ]}
      >
        <Ionicons name={icon} size={15} color="#F8FAFC" />
        <Text style={styles.actionText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function BalanceRow({ item, index, onRemind, onPay }) {
  const statusText =
    item.netBalance > 0
      ? `owes you ${formatCurrency(item.netBalance)}`
      : item.netBalance < 0
        ? `you owe ${formatCurrency(Math.abs(item.netBalance))}`
        : "settled up ✓";

  const statusStyle =
    item.netBalance > 0
      ? styles.statusPositive
      : item.netBalance < 0
        ? styles.statusNegative
        : styles.statusNeutral;

  return (
    <Animated.View entering={FadeInDown.delay(index * 55).springify()}>
      <View style={styles.rowCard}>
        <View style={styles.rowTop}>
          <View style={styles.rowIdentity}>
            <MemberAvatar
              name={item.name || item.phone || "User"}
              photoUrl={item.photoUrl}
              size="medium"
            />
            <View style={styles.rowMeta}>
              <Text style={styles.rowName}>{item.name || item.phone || "User"}</Text>
              <Text style={[styles.rowStatus, statusStyle]}>{statusText}</Text>
            </View>
          </View>

          {item.netBalance > 0 ? (
            <ActionButton
              icon="notifications-outline"
              label="Remind"
              tone="positive"
              onPress={() => onRemind(item)}
            />
          ) : item.netBalance < 0 ? (
            <ActionButton
              icon={item.upiId ? "arrow-up-circle-outline" : "copy-outline"}
              label={item.upiId ? "Pay" : "Copy amount"}
              tone="negative"
              onPress={() => onPay(item)}
            />
          ) : null}
        </View>

        <View style={styles.chipsWrap}>
          {item.sharedGroups.map((group) => (
            <View key={group.id} style={styles.groupChip}>
              <Text style={styles.groupChipEmoji}>{group.emoji || "👥"}</Text>
              <Text style={styles.groupChipText}>{group.name}</Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

export default function BalanceBreakdownScreen({ navigation, route }) {
  const { mode } = route.params || {};
  const { user, userProfile } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState(getInitialFilter(mode));
  const [manualSheet, setManualSheet] = useState(null);
  const pendingSettlementRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const loadBalances = useCallback(async () => {
    if (!user?.uid) {
      setBalances([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await getUserBalancesAcrossAllGroups(user.uid);

    if (!result.success) {
      showAlert({
        title: "Unable to load balances",
        message: result.error || "Please try again.",
        variant: "error",
      });
      setBalances([]);
      setLoading(false);
      return;
    }

    setBalances(result.balances || []);
    setLoading(false);
  }, [showAlert, user?.uid]);

  useEffect(() => {
    const run = async () => {
      await loadBalances();
    };

    run();
  }, [loadBalances]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasInactive = appStateRef.current.match(/inactive|background/);
      appStateRef.current = nextState;

      if (!wasInactive || nextState !== "active" || !pendingSettlementRef.current) {
        return;
      }

      const pending = pendingSettlementRef.current;
      pendingSettlementRef.current = null;

      Alert.alert(
        "Confirm payment",
        `Did you complete the payment to ${pending.name}?`,
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes",
            onPress: async () => {
              for (const settlement of pending.settlementsPlan || []) {
                const result = await recordSettlement(
                  settlement.groupId,
                  user.uid,
                  pending.userId,
                  settlement.amount,
                  {
                    payerName:
                      userProfile?.name || userProfile?.phone || user?.phoneNumber || "Someone",
                    groupName: settlement.groupName,
                  },
                );

                if (!result.success) {
                  showAlert({
                    title: "Unable to record payment",
                    message: result.error || "Please try again.",
                    variant: "error",
                  });
                  return;
                }
              }

              showAlert({
                title: "Settlement recorded",
                message: `Marked ${formatCurrency(pending.amount)} as paid.`,
                variant: "success",
              });
              await loadBalances();
            },
          },
        ],
      );
    });

    return () => {
      subscription.remove();
    };
  }, [loadBalances, showAlert, user?.phoneNumber, user?.uid, userProfile?.name, userProfile?.phone]);

  const totals = {
    owed: getTotalOwed(balances),
    owe: getTotalOwe(balances),
    net: getNetTotal(balances),
  };

  const filteredBalances = balances.filter((balance) => {
    if (selectedFilter === "owed") return balance.netBalance > 0;
    if (selectedFilter === "owe") return balance.netBalance < 0;
    return true;
  });

  const allSettled = balances.length > 0 && balances.every((item) => item.netBalance === 0);

  const handleSendReminder = async (balance) => {
    try {
      const reminderPlan = buildReminderPlan(balance);
      const totalAmount = reminderPlan.reduce((sum, item) => sum + item.amount, 0);
      let needsSmsFallback = false;

      for (const reminder of reminderPlan) {
        const result = await sendBalanceReminder(
          balance,
          {
            uid: user?.uid,
            name: userProfile?.name,
            phone: userProfile?.phone,
            phoneNumber: user?.phoneNumber,
          },
          reminder.amount,
          reminder.groupId,
          reminder.groupName,
        );

        if (!result.success) {
          showAlert({
            title: "Unable to send reminder",
            message: result.error || "Please try again.",
            variant: "error",
          });
          return;
        }

        needsSmsFallback = needsSmsFallback || result.needsSmsFallback;
      }

      if (needsSmsFallback && balance.phone) {
        const smsBody = `Hey! You owe me ${formatCurrency(totalAmount)} on SplitMate. Please settle up.`;
        const smsUrl = `sms:${balance.phone}?body=${encodeURIComponent(smsBody)}`;
        await Linking.openURL(smsUrl);
      }

      showAlert({
        title: "Reminder sent",
        message: `Reminder sent to ${balance.name || balance.phone || "member"}.`,
        variant: "success",
      });
    } catch (_error) {
      showAlert({
        title: "Unable to open SMS",
        message: "Push was unavailable and this device could not open the SMS app.",
        variant: "error",
      });
    }
  };

  const copyAmount = (amount) => {
    Clipboard.setString(String(Number(amount || 0).toFixed(2)));
    showAlert({
      title: "Amount copied",
      message: `${formatCurrency(amount)} copied to clipboard.`,
      variant: "success",
    });
  };

  const handlePay = async (balance) => {
    try {
      const settlementsPlan = buildSettlementPlan(balance);
      const amount = settlementsPlan.reduce((sum, item) => sum + item.amount, 0);

      if (!balance.upiId) {
        setManualSheet({
          name: balance.name,
          amount,
          upiId: "",
        });
        return;
      }

      const upiUrl = `upi://pay?pa=${encodeURIComponent(
        balance.upiId,
      )}&am=${amount.toFixed(2)}&tn=SplitMate%20Settlement&cu=INR`;

      const supported = await Linking.canOpenURL(upiUrl);

      if (!supported) {
        setManualSheet({
          name: balance.name,
          amount,
          upiId: balance.upiId,
        });
        return;
      }

      pendingSettlementRef.current = {
        userId: balance.userId,
        name: balance.name || balance.phone || "member",
        amount,
        settlementsPlan,
      };

      await Linking.openURL(upiUrl);
    } catch (_error) {
      setManualSheet({
        name: balance.name,
        amount: Math.abs(Number(balance.netBalance || 0)),
        upiId: balance.upiId || "",
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

      <ScreenHeader
        title="Balances"
        subtitle="Across all groups"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.summaryStrip}>
        <SummaryCard
          label="You are owed"
          value={formatCurrency(totals.owed)}
          tone="positive"
        />
        <SummaryCard
          label="You owe"
          value={formatCurrency(totals.owe)}
          tone="negative"
        />
        <SummaryCard
          label="Net balance"
          value={formatCurrency(Math.abs(totals.net))}
          tone={totals.net >= 0 ? "positive" : "negative"}
        />
      </View>

      <View style={styles.filtersRow}>
        {FILTERS.map((filter) => {
          const selected = filter.key === selectedFilter;

          return (
            <TouchableOpacity
              key={filter.key}
              activeOpacity={0.86}
              style={[styles.filterChip, selected && styles.filterChipActive]}
              onPress={() => setSelectedFilter(filter.key)}
            >
              <Text
                style={[styles.filterText, selected && styles.filterTextActive]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <SkeletonLoader variant="card" count={5} />
      ) : allSettled ? (
        <View style={styles.emptyState}>
          <Ionicons name="sparkles-outline" size={34} color="#34D399" />
          <Text style={styles.emptyTitle}>All settled up! 🎉</Text>
          <Text style={styles.emptyText}>
            Every shared expense is balanced right now.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBalances}
          keyExtractor={(item) => item.userId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nothing in this view</Text>
              <Text style={styles.emptyText}>
                Try another filter to see your balances.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <BalanceRow
              item={item}
              index={index}
              onRemind={handleSendReminder}
              onPay={handlePay}
            />
          )}
        />
      )}

      <Modal
        transparent
        visible={Boolean(manualSheet)}
        animationType="fade"
        onRequestClose={() => setManualSheet(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {manualSheet?.upiId ? "UPI app not available" : "Manual settlement"}
            </Text>
            <Text style={styles.modalBody}>
              Pay {manualSheet?.name || "this member"} {manualSheet ? formatCurrency(manualSheet.amount) : ""}
              {manualSheet?.upiId ? ` to ${manualSheet.upiId}` : ""}.
            </Text>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.modalPrimaryButton}
              onPress={() => copyAmount(manualSheet?.amount || 0)}
            >
              <Ionicons name="copy-outline" size={18} color="#F8FAFC" />
              <Text style={styles.modalPrimaryText}>Copy Amount</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.modalSecondaryButton}
              onPress={() => setManualSheet(null)}
            >
              <Text style={styles.modalSecondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: surfaces.screen,
    paddingHorizontal: 20,
  },
  summaryStrip: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 16,
    backgroundColor: surfaces.card,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: "space-between",
  },
  summaryLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryValue: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  summaryValuePositive: {
    color: "#34D399",
  },
  summaryValueNegative: {
    color: "#FB7185",
  },
  filtersRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: surfaces.input,
    borderWidth: 1,
    borderColor: surfaces.border,
  },
  filterChipActive: {
    backgroundColor: "rgba(124,58,237,0.18)",
    borderColor: "rgba(124,58,237,0.35)",
  },
  filterText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#F8FAFC",
  },
  listContent: {
    paddingBottom: 32,
    gap: 12,
  },
  rowCard: {
    borderRadius: 18,
    backgroundColor: surfaces.card,
    borderWidth: 1,
    borderColor: surfaces.border,
    padding: 16,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  rowIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowMeta: {
    flex: 1,
  },
  rowName: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "800",
  },
  rowStatus: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  statusPositive: {
    color: "#34D399",
  },
  statusNegative: {
    color: "#FB7185",
  },
  statusNeutral: {
    color: "#94A3B8",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  groupChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: surfaces.muted,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
  },
  groupChipEmoji: {
    fontSize: 12,
  },
  groupChipText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  actionPressable: {
    alignSelf: "flex-start",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 42,
    borderRadius: buttonTokens.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  remindButton: {
    backgroundColor: buttonTokens.primaryBg,
    borderColor: buttonTokens.primaryBg,
  },
  payButton: {
    backgroundColor: surfaces.input,
    borderColor: surfaces.border,
  },
  actionText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 90,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: "#F8FAFC",
    fontSize: fontSize.lg,
    fontWeight: "800",
    marginTop: 14,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: surfaces.overlay,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: surfaces.cardStrong,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: "rgba(148,163,184,0.24)",
    marginBottom: 18,
  },
  modalTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
  },
  modalBody: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 22,
  },
  modalPrimaryButton: {
    height: buttonTokens.height,
    borderRadius: buttonTokens.radius,
    backgroundColor: buttonTokens.primaryBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  modalPrimaryText: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "800",
  },
  modalSecondaryButton: {
    height: buttonTokens.height,
    borderRadius: buttonTokens.radius,
    borderWidth: 1,
    borderColor: buttonTokens.secondaryBorder,
    backgroundColor: buttonTokens.secondaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "700",
  },
});
