import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
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
import SkeletonLoader from "../components/SkeletonLoader";
import { colors, spacing } from "../constants/theme";
import { useAuth } from "../context/useAuth";
import { getExpenseShareForUser } from "../services/balanceCalculator";
import { getUserExpenses } from "../services/expenseService";
import {
  formatActivitySectionLabel,
  formatRecentTimestamp,
  parseDateTime,
} from "../utils/dateTime";

const filters = ["All", "This Week", "This Month"];

const categoryColors = {
  Food: "#7C3AED",
  Transport: "#3B82F6",
  Rent: "#F59E0B",
  Shopping: "#EC4899",
  Entertainment: "#06B6D4",
  Other: "#10B981",
};

function SummaryCard({ label, value, highlight }) {
  return (
    <View style={[styles.summaryCard, highlight && styles.summaryCardHighlight]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryValueHighlight]}>{value}</Text>
    </View>
  );
}

export default function ActivityScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [expenses, setExpenses] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return undefined;

    const unsubscribe = getUserExpenses(user.uid, (data) => {
      setExpenses(data);
      setLoading(false);
      setRefreshing(false);
    });

    return unsubscribe;
  }, [user]);

  const filtered = useMemo(() => {
    if (selectedFilter === "All") return expenses;

    const now = new Date();
    const days = selectedFilter === "This Week" ? 7 : 30;

    return expenses.filter((expense) => {
      const date = parseDateTime(expense.createdAt);
      if (!date) return false;

      const diff = (now - date) / (1000 * 60 * 60 * 24);
      return diff <= days;
    });
  }, [expenses, selectedFilter]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc, item) => {
      const key = formatActivitySectionLabel(item.createdAt);

      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [filtered]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, item) => {
        const totalAmount = Number(item.amount || 0);
        const userShare = getExpenseShareForUser(item, user?.uid);

        acc.tracked += totalAmount;

        if (item.paidBy === user?.uid) {
          acc.owed += Math.max(totalAmount - userShare, 0);
        } else {
          acc.owe += userShare;
        }

        return acc;
      },
      { tracked: 0, owed: 0, owe: 0 },
    );
  }, [filtered, user?.uid]);

  const sections = Object.entries(grouped);

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 6 }]}>
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />

      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Activity</Text>
          <Text style={styles.headerSubtitle}>SplitMate Ledger</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity activeOpacity={0.85} style={styles.iconButton}>
            <Ionicons name="search-outline" size={20} color="#F8FAFC" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} style={styles.iconButton}>
            <Ionicons name="options-outline" size={20} color="#F8FAFC" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(110).springify()} style={styles.filtersRow}>
        {filters.map((filter) => {
          const selected = selectedFilter === filter;

          return (
            <TouchableOpacity key={filter} activeOpacity={0.85} onPress={() => setSelectedFilter(filter)}>
              <View style={[styles.filterChip, selected && styles.filterChipActive]}>
                <Text style={[styles.filterText, selected && styles.filterTextActive]}>{filter}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.summaryRow}>
        <SummaryCard label="You Are Owed" value={`Rs ${totals.owed.toFixed(2)}`} highlight />
        <SummaryCard label="You Owe" value={`Rs ${totals.owe.toFixed(2)}`} />
      </Animated.View>

      {loading ? (
        <SkeletonLoader variant="expense" count={5} />
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>
            Expenses you split will appear here with live updates.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={([title]) => title}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(true)}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item: [title, items] }) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{title}</Text>
              {items.map((expense, index) => {
                const color = categoryColors[expense.category] || categoryColors.Other;
                const youPaid = expense.paidBy === user?.uid;
                const share = getExpenseShareForUser(expense, user?.uid);
                const othersShare = Math.max(Number(expense.amount || 0) - share, 0);

                return (
                  <Animated.View
                    key={expense.id}
                    entering={FadeInDown.delay(index * 70)}
                    style={styles.timelineItem}
                  >
                    <View style={styles.timelineLine} />
                    <View style={[styles.timelineIcon, { backgroundColor: color }]}>
                      <Ionicons name="receipt-outline" size={16} color="#fff" />
                    </View>

                    <View style={[styles.activityCard, youPaid && styles.activityCardPositive]}>
                      <View style={styles.activityTop}>
                        <Text style={styles.activityName}>{expense.description}</Text>
                        <Text style={[styles.activityAmount, youPaid && styles.positiveAmount]}>
                          {youPaid ? "+" : "-"}Rs {(youPaid ? othersShare : share).toFixed(2)}
                        </Text>
                      </View>

                      <Text style={styles.activityMeta}>
                        {youPaid
                          ? `You paid in ${expense.groupName || "your group"}`
                          : `Paid by ${expense.paidByName || "your group"}`}
                      </Text>

                      <View style={styles.activityBottom}>
                        <Text style={styles.activityTime}>
                          {formatRecentTimestamp(expense.createdAt)}
                        </Text>
                        <Text style={styles.activityGroup}>{expense.groupName || "Group"}</Text>
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 3,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(30,41,59,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  filtersRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(30,41,59,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  filterChipActive: {
    backgroundColor: "rgba(124,58,237,0.18)",
    borderColor: "rgba(124,58,237,0.32)",
  },
  filterText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#F8FAFC",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    minHeight: 76,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    justifyContent: "center",
  },
  summaryCardHighlight: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  summaryLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  summaryValue: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryValueHighlight: {
    color: "#9a5cc7",
  },
  listContent: {
    paddingBottom: 120,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 12,
    paddingLeft: 48,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 18,
  },
  timelineLine: {
    position: "absolute",
    left: 18,
    top: 0,
    bottom: -18,
    width: 2,
    backgroundColor: "rgba(59,130,246,0.22)",
  },
  timelineIcon: {
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  activityCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(30,41,59,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
  },
  activityCardPositive: {
    borderColor: "rgba(16,185,129,0.35)",
  },
  activityTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  activityName: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
  },
  activityAmount: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "800",
  },
  positiveAmount: {
    color: "#34D399",
  },
  activityMeta: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 4,
  },
  activityBottom: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  activityTime: {
    color: "#64748B",
    fontSize: 12,
  },
  activityGroup: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
