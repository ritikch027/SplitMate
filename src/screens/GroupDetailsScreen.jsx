import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import AnimatedBackdrop from "../components/AnimatedBackdrop";
import MemberAvatar from "../components/MemberAvatar";
import ScreenHeader from "../components/ScreenHeader";
import { colors, fontSize } from "../constants/theme";
import { useAuth } from "../context/useAuth";
import { calculateBalances } from "../services/balanceCalculator";
import { deleteExpense, getGroupExpenses } from "../services/expenseService";
import { getGroup } from "../services/groupService";
import { getUsersByIds } from "../services/userService";

function SummaryCard({ label, value, valueStyle }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueStyle]}>{value}</Text>
    </View>
  );
}

export default function GroupDetailsScreen({ navigation, route }) {
  const { groupId } = route.params;
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    const loadGroup = async () => {
      const response = await getGroup(groupId);
      if (!response.success) return;

      setGroup(response.group);

      const memberIds = response.group.members || [];
      const membersResponse = await getUsersByIds(memberIds);

      if (membersResponse.success) {
        setMembers(membersResponse.users);
      }
    };

    loadGroup();
  }, [groupId]);

  useEffect(() => {
    const unsubscribe = getGroupExpenses(groupId, (data) => {
      setExpenses(data);
    });

    return unsubscribe;
  }, [groupId]);

  const balances = useMemo(() => {
    if (!user || !members.length) return [];
    return calculateBalances(expenses, members, user.uid);
  }, [expenses, members, user]);

  const totals = useMemo(() => {
    let owed = 0;
    let owe = 0;

    balances.forEach((item) => {
      if (item.netBalance > 0) owed += item.netBalance;
      if (item.netBalance < 0) owe += Math.abs(item.netBalance);
    });

    return { owed, owe };
  }, [balances]);

  const confirmDelete = (expenseId) => {
    Alert.alert("Delete Expense", "Are you sure you want to delete this expense?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteExpense(expenseId);
        },
      },
    ]);
  };

  if (!group) {
    return (
      <View style={styles.loading}>
        <AnimatedBackdrop />
        <Text style={styles.loadingText}>Loading group...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />

      <Animated.View entering={FadeInDown.springify()}>
        <ScreenHeader
          title={group.name}
          subtitle={`${members.length} Members • Active`}
          onBack={() => navigation.goBack()}
          right={
            <TouchableOpacity activeOpacity={0.85} style={styles.iconButton}>
              <Ionicons name="ellipsis-vertical" size={18} color="#F8FAFC" />
            </TouchableOpacity>
          }
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.membersRow}>
        {members.slice(0, 5).map((member, index) => (
          <View key={member.id} style={[styles.memberBubble, { marginLeft: index === 0 ? 0 : -10 }]}>
            <MemberAvatar name={member.name || member.phone || "User"} size="medium" />
          </View>
        ))}
        {members.length > 5 ? (
          <View style={[styles.memberBubble, styles.memberExtra]}>
            <Text style={styles.memberExtraText}>+{members.length - 5}</Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.section}>
        <Text style={styles.sectionHeader}>Settlement Summary</Text>
        <View style={styles.summaryRow}>
          <SummaryCard label="You are owed" value={`Rs ${totals.owed.toFixed(2)}`} valueStyle={styles.owed} />
          <SummaryCard label="You owe" value={`Rs ${totals.owe.toFixed(2)}`} valueStyle={styles.owe} />
        </View>

        <View style={styles.balanceCard}>
          {balances.length ? (
            balances.slice(0, 3).map((balance, index) => (
              <View key={balance.userId} style={[styles.balanceRow, index > 0 && styles.balanceDivider]}>
                <View style={styles.balanceUser}>
                  <View style={styles.initialBadge}>
                    <Text style={styles.initialText}>{balance.name?.charAt(0)?.toUpperCase() || "U"}</Text>
                  </View>
                  <Text style={styles.balanceName}>{balance.name}</Text>
                </View>
                <Text
                  style={[
                    styles.balanceAmount,
                    balance.netBalance > 0 ? styles.owed : balance.netBalance < 0 ? styles.owe : styles.settled,
                  ]}
                >
                  {balance.netBalance > 0
                    ? `+Rs ${balance.netBalance.toFixed(2)}`
                    : balance.netBalance < 0
                    ? `-Rs ${Math.abs(balance.netBalance).toFixed(2)}`
                    : "Settled"}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyBalanceText}>Add an expense to generate balances.</Text>
          )}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.expenseHeaderRow}>
        <Text style={styles.sectionHeader}>Recent Expenses</Text>
        <Text style={styles.viewAll}>View All</Text>
      </Animated.View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const share = Number(item.amount || 0) / (item.splitBetween?.length || 1);
          const youPaid = item.paidBy === user?.uid;

          return (
            <Animated.View entering={FadeInDown.delay(index * 60)}>
              <View style={styles.expenseCard}>
                <View style={styles.expenseLeft}>
                  <View style={styles.expenseIcon}>
                    <Text style={styles.expenseIconText}>{item.category?.charAt(0) || "R"}</Text>
                  </View>
                  <View style={styles.expenseMeta}>
                    <Text style={styles.expenseName}>{item.description}</Text>
                    <Text style={styles.expenseSub}>
                      Paid by {item.paidByName || "Unknown"} •{" "}
                      {item.createdAt?.toDate?.().toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      }) || "Recently"}
                    </Text>
                  </View>
                </View>

                <View style={styles.expenseRight}>
                  <Text style={styles.expenseAmount}>Rs {Number(item.amount || 0).toFixed(2)}</Text>
                  <Text style={[styles.expenseShare, youPaid ? styles.owed : styles.shareMuted]}>
                    {youPaid ? `Others owe Rs ${(item.amount - share).toFixed(2)}` : `Your share: Rs ${share.toFixed(2)}`}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.deleteButton}
                  onPress={() => confirmDelete(item.id)}
                >
                  <Ionicons name="trash-outline" size={16} color="#F87171" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyExpenses}>
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptyText}>Tap the button below to add the first one.</Text>
          </View>
        }
      />

      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.addButton}
        onPress={() =>
          navigation.navigate("AddExpenseScreen", {
            groupId,
            groupName: group.name,
            members,
          })
        }
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.addText}>Add New Expense</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#10182B",
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10182B",
  },
  loadingText: {
    color: "#94A3B8",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30,41,59,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  membersRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 26,
  },
  memberBubble: {
    borderWidth: 2,
    borderColor: "#10182B",
    borderRadius: 999,
  },
  memberExtra: {
    width: 40,
    height: 40,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  memberExtraText: {
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "700",
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 10,
    backgroundColor: "rgba(30,41,59,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  owed: {
    color: "#34D399",
  },
  owe: {
    color: "#FB7185",
  },
  settled: {
    color: "#94A3B8",
  },
  balanceCard: {
    borderRadius: 10,
    backgroundColor: "rgba(30,41,59,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceDivider: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  balanceUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  initialBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.18)",
  },
  initialText: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 12,
  },
  balanceName: {
    color: "#F8FAFC",
    fontSize: 15,
  },
  balanceAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyBalanceText: {
    color: "#94A3B8",
    fontSize: 14,
  },
  expenseHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewAll: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    paddingBottom: 120,
  },
  expenseCard: {
    borderRadius: 10,
    backgroundColor: "rgba(30,41,59,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  expenseLeft: {
    flexDirection: "row",
    flex: 1,
    marginRight: 12,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  expenseIconText: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
  },
  expenseMeta: {
    flex: 1,
  },
  expenseName: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
  },
  expenseSub: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 4,
  },
  expenseRight: {
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 24,
  },
  expenseAmount: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "800",
  },
  expenseShare: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: "600",
  },
  shareMuted: {
    color: "#94A3B8",
  },
  deleteButton: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  emptyExpenses: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyTitle: {
    color: "#F8FAFC",
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 8,
  },
  addButton: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 24,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
