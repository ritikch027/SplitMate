import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedBackdrop from "../components/AnimatedBackdrop";
import MemberAvatar from "../components/MemberAvatar";
import { buttonTokens, colors, surfaces } from "../constants/theme";
import { useAlert } from "../context/useAlert";
import { useAuth } from "../context/useAuth";
import {
  calculateBalances,
  getExpenseShareForUser,
} from "../services/balanceCalculator";
import {
  deleteExpenseByActor,
  getGroupExpenses,
} from "../services/expenseService";
import {
  addMemberToGroup,
  getGroup,
  removeMemberFromGroup,
} from "../services/groupService";
import { getUsersByIds, getUsersByPhone } from "../services/userService";
import { formatRecentTimestamp } from "../utils/dateTime";

/*──────────────────────────────────────────────────────────────
  Category color map
──────────────────────────────────────────────────────────────*/
const CATEGORY_COLORS = {
  F: { bg: "rgba(251,146,60,0.15)", color: "#FB923C" }, // Food
  T: { bg: "rgba(96,165,250,0.15)", color: "#60A5FA" }, // Transport
  R: { bg: "rgba(167,139,250,0.15)", color: "#A78BFA" }, // Rent
  S: { bg: "rgba(244,114,182,0.15)", color: "#F472B6" }, // Shopping
  E: { bg: "rgba(52,211,153,0.15)", color: "#34D399" }, // Entertainment
  default: { bg: "rgba(148,163,184,0.12)", color: "#94A3B8" },
};

const getCategoryStyle = (category) =>
  CATEGORY_COLORS[category?.charAt(0)?.toUpperCase()] ||
  CATEGORY_COLORS.default;

/*──────────────────────────────────────────────────────────────
  ExpenseCard
──────────────────────────────────────────────────────────────*/
function ExpenseCard({ item, userId, onEdit, onDelete, index }) {
  const share = getExpenseShareForUser(item, userId);
  const youPaid = item.paidBy === userId;
  const canEdit = item.createdBy === userId;
  const catStyle = getCategoryStyle(item.category);

  const dateStr = formatRecentTimestamp(item.createdAt);

  return (
    <Animated.View entering={FadeInDown.delay(index * 55).springify()}>
      <View style={styles.expenseCard}>
        {/* Category icon */}
        <View style={[styles.expenseCatIcon, { backgroundColor: catStyle.bg }]}>
          <Text style={[styles.expenseCatText, { color: catStyle.color }]}>
            {item.category?.charAt(0)?.toUpperCase() || "?"}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.expenseInfo}>
          <Text style={styles.expenseTitle} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.expenseMeta}>
            {youPaid ? "You paid" : `${item.paidByName || "Someone"} paid`} •{" "}
            {dateStr}
          </Text>
        </View>

        {/* Amounts */}
        <View style={styles.expenseAmounts}>
          <Text style={styles.expenseTotal}>
            ₹{Number(item.amount || 0).toLocaleString("en-IN")}
          </Text>
          <Text
            style={[
              styles.expenseShare,
              youPaid ? styles.colorGreen : styles.colorMuted,
            ]}
          >
            {youPaid
              ? `+₹${(item.amount - share).toFixed(0)} back`
              : `−₹${share.toFixed(0)} yours`}
          </Text>
        </View>

        {/* Actions */}
        {canEdit && (
          <View style={styles.expenseActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onEdit}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={14} color="#A78BFA" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnRed]}
              onPress={onDelete}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={14} color="#F87171" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

/*──────────────────────────────────────────────────────────────
  GroupDetailsScreen
──────────────────────────────────────────────────────────────*/
export default function GroupDetailsScreen({ navigation, route }) {
  const { groupId } = route.params;
  const { user, userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [manageVisible, setManageVisible] = useState(false);
  const [memberPhone, setMemberPhone] = useState("");
  const [memberSaving, setMemberSaving] = useState(false);

  /* Load group + members */
  useEffect(() => {
    const load = async () => {
      const res = await getGroup(groupId);
      if (!res.success) return;
      setGroup(res.group);

      const membersRes = await getUsersByIds(res.group.members || []);
      if (membersRes.success) setMembers(membersRes.users);
    };
    load();
  }, [groupId]);

  /* Real-time expenses */
  useEffect(() => {
    const unsubscribe = getGroupExpenses(groupId, setExpenses);
    return unsubscribe;
  }, [groupId]);

  /* Balance calculations */
  const balances = useMemo(() => {
    if (!user || !members.length) return [];
    return calculateBalances(expenses, members, user.uid);
  }, [expenses, members, user]);

  const totals = useMemo(() => {
    let owed = 0,
      owe = 0;
    balances.forEach((b) => {
      if (b.netBalance > 0) owed += b.netBalance;
      if (b.netBalance < 0) owe += Math.abs(b.netBalance);
    });
    return { owed, owe };
  }, [balances]);

  const canManage = group?.createdBy === user?.uid;

  /* Delete expense */
  const confirmDelete = (expenseId) => {
    Alert.alert("Delete Expense", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const result = await deleteExpenseByActor(expenseId, user.uid);
          showAlert({
            title: result.success ? "Deleted" : "Error",
            message: result.success ? "Expense removed." : result.error,
            variant: result.success ? "success" : "error",
          });
        },
      },
    ]);
  };

  /* Add member */
  const handleAddMember = async () => {
    if (!memberPhone.trim()) return;
    setMemberSaving(true);

    try {
      const normalized = memberPhone.startsWith("+91")
        ? memberPhone.trim()
        : `+91${memberPhone.replace(/\D/g, "").slice(-10)}`;

      const lookup = await getUsersByPhone([normalized]);
      if (!lookup.success || !lookup.users.length) {
        showAlert({
          title: "Not found",
          message: "This number isn't registered.",
          variant: "error",
        });
        return;
      }

      const newMember = lookup.users[0];
      const result = await addMemberToGroup(
        groupId,
        newMember.id,
        user.uid,
        userProfile?.name || userProfile?.phone || "Someone",
      );

      if (!result.success) {
        showAlert({ title: "Error", message: result.error, variant: "error" });
        return;
      }

      setMembers((curr) =>
        curr.some((m) => m.id === newMember.id) ? curr : [...curr, newMember],
      );
      setGroup((curr) =>
        curr
          ? {
              ...curr,
              members: [...new Set([...(curr.members || []), newMember.id])],
            }
          : curr,
      );
      setMemberPhone("");
      showAlert({
        title: "Added!",
        message: `${newMember.name || newMember.phone} joined.`,
        variant: "success",
      });
    } finally {
      setMemberSaving(false);
    }
  };

  /* Remove member */
  const handleRemoveMember = async (memberId) => {
    const result = await removeMemberFromGroup(
      groupId,
      memberId,
      user.uid,
      userProfile?.name || userProfile?.phone || "Someone",
    );
    if (!result.success) {
      showAlert({ title: "Error", message: result.error, variant: "error" });
      return;
    }
    setMembers((curr) => curr.filter((m) => m.id !== memberId));
    setGroup((curr) =>
      curr
        ? {
            ...curr,
            members: (curr.members || []).filter((id) => id !== memberId),
          }
        : curr,
    );
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
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 16) }]}>
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />

      {/* ── Header ── */}
      <Animated.View
        entering={FadeInDown.springify()}
        style={styles.headerWrap}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color="#F8FAFC" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>{group.emoji || "👥"}</Text>
          <Text style={styles.headerTitle}>{group.name}</Text>
          <Text style={styles.headerSub}>{members.length} members</Text>
        </View>

        <TouchableOpacity
          style={styles.manageBtn}
          onPress={() => canManage && setManageVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="people-outline" size={18} color="#F8FAFC" />
        </TouchableOpacity>
      </Animated.View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <ExpenseCard
            item={item}
            userId={user?.uid}
            index={index}
            onEdit={() =>
              navigation.navigate("AddExpenseScreen", {
                groupId,
                groupName: group.name,
                members,
                expense: item,
              })
            }
            onDelete={() => confirmDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          <Animated.View
            entering={FadeInDown.delay(300)}
            style={styles.emptyWrap}
          >
            <LinearGradient
              colors={["rgba(124,58,237,0.15)", "rgba(6,182,212,0.08)"]}
              style={styles.emptyIcon}
            >
              <Ionicons
                name="receipt-outline"
                size={32}
                color={colors.accent}
              />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptySub}>Add the first expense below</Text>
          </Animated.View>
        }
        ListHeaderComponent={
          <>
            {/* ── Members strip ── */}
            <Animated.View
              entering={FadeInDown.delay(80).springify()}
              style={styles.membersStrip}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {members.map((member, index) => (
                  <View key={member.id} style={styles.memberChip}>
                    <MemberAvatar
                      name={member.name || member.phone || "U"}
                      photoUrl={member.photoUrl}
                      size="small"
                    />
                    <Text style={styles.memberChipName} numberOfLines={1}>
                      {member.name?.split(" ")[0] || "User"}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>

            {/* ── Balance summary ── */}
            <Animated.View
              entering={FadeInDown.delay(140).springify()}
              style={styles.balanceSection}
            >
              {/* Totals row */}
              <View style={styles.totalsRow}>
                <View style={styles.totalCard}>
                  <Text style={styles.totalLabel}>You are owed</Text>
                  <Text style={[styles.totalAmount, styles.colorGreen]}>
                    ₹{totals.owed.toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={styles.totalDivider} />
                <View style={styles.totalCard}>
                  <Text style={styles.totalLabel}>You owe</Text>
                  <Text style={[styles.totalAmount, styles.colorRed]}>
                    ₹{totals.owe.toLocaleString("en-IN")}
                  </Text>
                </View>
              </View>

              {/* Per-member balances */}
              {balances.length > 0 && (
                <View style={styles.balanceList}>
                  {balances.map((b, index) => (
                    <View
                      key={b.userId}
                      style={[
                        styles.balanceRow,
                        index > 0 && styles.balanceRowBorder,
                      ]}
                    >
                      <View style={styles.balanceLeft}>
                        <View style={styles.balanceInitial}>
                          <Text style={styles.balanceInitialText}>
                            {b.name?.charAt(0)?.toUpperCase() || "U"}
                          </Text>
                        </View>
                        <Text style={styles.balanceName}>{b.name}</Text>
                      </View>
                      <View style={styles.balanceRight}>
                        <Text
                          style={[
                            styles.balanceAmt,
                            b.netBalance > 0
                              ? styles.colorGreen
                              : b.netBalance < 0
                                ? styles.colorRed
                                : styles.colorMuted,
                          ]}
                        >
                          {b.netBalance > 0
                            ? `owes you ₹${b.netBalance.toFixed(0)}`
                            : b.netBalance < 0
                              ? `you owe ₹${Math.abs(b.netBalance).toFixed(0)}`
                              : "Settled ✓"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>

            {/* ── Expenses header ── */}
            <Animated.View
              entering={FadeInDown.delay(200)}
              style={styles.expensesHeader}
            >
              <Text style={styles.sectionLabel}>Expenses</Text>
              <View style={styles.expenseCountChip}>
                <Text style={styles.expenseCountText}>{expenses.length}</Text>
              </View>
            </Animated.View>
          </>
        }
      />

      {/* ── Add expense button ── */}
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.addBtn}
        onPress={() =>
          navigation.navigate("AddExpenseScreen", {
            groupId,
            groupName: group.name,
            members,
          })
        }
      >
        <LinearGradient
          colors={[buttonTokens.primaryBg, buttonTokens.primaryBg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.addBtnGradient}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add Expense</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Manage Members Modal ── */}
      <Modal visible={manageVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeInUp.springify()}
            style={styles.modalSheet}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Manage Members</Text>
            <Text style={styles.modalSub}>
              Add by phone number or remove members
            </Text>

            <View style={styles.modalInputRow}>
              <TextInput
                value={memberPhone}
                onChangeText={setMemberPhone}
                placeholder="Enter phone number"
                placeholderTextColor="#6B7280"
                style={styles.modalInput}
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={styles.modalAddBtn}
                onPress={handleAddMember}
                disabled={memberSaving}
                activeOpacity={0.85}
              >
                <Text style={styles.modalAddText}>
                  {memberSaving ? "..." : "Add"}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.memberScroll}
              showsVerticalScrollIndicator={false}
            >
              {members.map((member) => {
                const isOwner = member.id === group?.createdBy;
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <MemberAvatar
                      name={member.name || member.phone || "U"}
                      photoUrl={member.photoUrl}
                      size="small"
                    />
                    <View style={styles.memberRowInfo}>
                      <Text style={styles.memberRowName}>
                        {member.name || member.phone || "User"}
                      </Text>
                      {isOwner && <Text style={styles.ownerBadge}>Owner</Text>}
                    </View>
                    {!isOwner && (
                      <TouchableOpacity
                        onPress={() => handleRemoveMember(member.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setManageVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/*──────────────────────────────────────────────────────────────
  Styles
──────────────────────────────────────────────────────────────*/
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: surfaces.screen,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: surfaces.screen,
  },
  loadingText: { color: "#94A3B8" },

  /* Header */
  headerWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: surfaces.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerEmoji: {
    fontSize: 28,
    marginBottom: 2,
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSub: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  manageBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: surfaces.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
  },

  /* Members strip */
  membersStrip: {
    paddingHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    borderRadius: 14,
    backgroundColor: surfaces.card,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
  },
  memberChip: {
    alignItems: "center",
    marginRight: 14,
  },
  memberChipName: {
    color: "#CBD5E1",
    fontSize: 11,
    marginTop: 4,
    maxWidth: 48,
    textAlign: "center",
  },

  /* Balance section */
  balanceSection: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: surfaces.card,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
    overflow: "hidden",
  },
  totalsRow: {
    flexDirection: "row",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  totalCard: {
    flex: 1,
    alignItems: "center",
  },
  totalDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  totalLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  balanceList: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  balanceRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  balanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  balanceInitial: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(124,58,237,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceInitialText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  balanceName: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "600",
  },
  balanceRight: {},
  balanceAmt: {
    fontSize: 13,
    fontWeight: "700",
  },

  /* Expenses section */
  expensesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  expenseCountChip: {
    backgroundColor: "rgba(124,58,237,0.14)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.24)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  expenseCountText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },

  /* Expense card */
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  expenseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: surfaces.cardStrong,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  expenseCatIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  expenseCatText: {
    fontSize: 16,
    fontWeight: "800",
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  expenseMeta: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 3,
  },
  expenseAmounts: {
    alignItems: "flex-end",
  },
  expenseTotal: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  expenseShare: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  expenseActions: {
    flexDirection: "column",
    gap: 6,
  },
  actionBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnRed: {
    backgroundColor: "rgba(239,68,68,0.12)",
  },

  /* Colors */
  colorGreen: { color: "#34D399" },
  colorRed: { color: "#FB7185" },
  colorMuted: { color: "#94A3B8" },

  /* Empty */
  emptyWrap: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 20,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: "#F8FAFC",
    fontSize: 17,
    fontWeight: "700",
  },
  emptySub: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 6,
  },

  /* Add button */
  addBtn: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: buttonTokens.radius,
    backgroundColor: buttonTokens.primaryBg,
    shadowColor: buttonTokens.shadowColor,
    shadowOpacity: buttonTokens.shadowOpacity,
    shadowRadius: buttonTokens.shadowRadius,
    shadowOffset: buttonTokens.shadowOffset,
    elevation: buttonTokens.elevation,
  },
  addBtnGradient: {
    height: buttonTokens.height,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: surfaces.overlay,
  },
  modalSheet: {
    backgroundColor: surfaces.cardStrong,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  modalSub: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  modalInputRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  modalInput: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: surfaces.inputStrong,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    color: "#F8FAFC",
    paddingHorizontal: 14,
    fontSize: 15,
  },
  modalAddBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: buttonTokens.primaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  modalAddText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  memberScroll: {
    maxHeight: 220,
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.08)",
  },
  memberRowInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberRowName: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "600",
  },
  ownerBadge: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: "rgba(124,58,237,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  removeText: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "700",
  },
  modalCloseBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: buttonTokens.secondaryBg,
    borderWidth: 1,
    borderColor: buttonTokens.secondaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    color: "#CBD5E1",
    fontWeight: "700",
    fontSize: 15,
  },
});
