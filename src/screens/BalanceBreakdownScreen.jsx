import React, { useEffect, useMemo, useState } from "react";
import { FlatList, StatusBar, StyleSheet, Text, View } from "react-native";

import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedBackdrop from "../components/AnimatedBackdrop";
import ScreenHeader from "../components/ScreenHeader";
import SkeletonLoader from "../components/SkeletonLoader";
import { useAuth } from "../context/useAuth";
import { getExpenseShareForUser } from "../services/balanceCalculator";
import { getUserExpenses } from "../services/expenseService";

const categoryColors = {
  Food: "#7C3AED",
  Transport: "#3B82F6",
  Rent: "#F59E0B",
  Shopping: "#EC4899",
  Entertainment: "#06B6D4",
  Other: "#10B981",
};

export default function BalanceBreakdownScreen({ navigation, route }) {
  const { mode = "owe" } = route.params || {};
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return undefined;

    const unsubscribe = getUserExpenses(user.uid, (data) => {
      setExpenses(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const meta = mode === "owed"
    ? {
        title: "You Are Owed",
        subtitle: "Expenses where others owe you back",
        accent: "#34D399",
      }
    : {
        title: "You Owe",
        subtitle: "Expenses where you still owe someone",
        accent: "#F87171",
      };

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        const userShare = getExpenseShareForUser(expense, user?.uid);
        const othersShare = Number(expense.amount || 0) - userShare;

        if (mode === "owed") {
          return expense.paidBy === user?.uid && othersShare > 0;
        }

        return expense.paidBy !== user?.uid && userShare > 0;
      }),
    [expenses, mode, user?.uid],
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 6 }]}>
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />

      <Animated.View entering={FadeInDown.springify()}>
        <ScreenHeader
          title={meta.title}
          subtitle={meta.subtitle}
          onBack={() => navigation.goBack()}
        />
      </Animated.View>

      {loading ? (
        <SkeletonLoader variant="expense" count={5} />
      ) : (
        <FlatList
          data={filteredExpenses}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyText}>
                {mode === "owed"
                  ? "Expenses where others owe you will appear here."
                  : "Expenses you still owe will appear here."}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const color = categoryColors[item.category] || categoryColors.Other;
            const userShare = getExpenseShareForUser(item, user?.uid);
            const amount = mode === "owed" ? Number(item.amount || 0) - userShare : userShare;

            return (
              <Animated.View entering={FadeInDown.delay(index * 60)} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: color }]}>
                  <Text style={styles.iconText}>{item.category?.charAt(0) || "R"}</Text>
                </View>

                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.name}>{item.description}</Text>
                    <Text style={[styles.amount, { color: meta.accent }]}>
                      Rs {amount.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.metaText}>
                    {mode === "owed"
                      ? `Paid by you in ${item.groupName || "your group"}`
                      : `Paid by ${item.paidByName || "a group member"}`}
                  </Text>
                  <View style={styles.cardBottom}>
                    <Text style={styles.time}>
                      {item.createdAt?.toDate?.().toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      }) || "Recently"}
                    </Text>
                    <Text style={styles.group}>{item.groupName || "Group"}</Text>
                  </View>
                </View>
              </Animated.View>
            );
          }}
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
  listContent: {
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    marginBottom: 16,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconText: {
    color: "#fff",
    fontWeight: "800",
  },
  card: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(30,41,59,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  name: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
  },
  amount: {
    fontSize: 14,
    fontWeight: "800",
  },
  metaText: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 4,
  },
  cardBottom: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  time: {
    color: "#64748B",
    fontSize: 12,
  },
  group: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: 24,
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
