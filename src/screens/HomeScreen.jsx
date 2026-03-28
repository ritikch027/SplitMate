import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedBackdrop from "../components/AnimatedBackdrop";
import GroupCard from "../components/GroupCard";
import MemberAvatar from "../components/MemberAvatar";
import SkeletonLoader from "../components/SkeletonLoader";
import { buttonTokens, colors, fontSize, spacing, surfaces } from "../constants/theme";
import { useAuth } from "../context/useAuth";
import {
  calculateBalances,
  formatCurrency,
  getTotalOwe,
  getTotalOwed,
} from "../services/balanceCalculator";
import {
  getUserExpenses,
  getUserExpensesOnce,
} from "../services/expenseService";
import { getUserGroups, getUserGroupsOnce } from "../services/groupService";
import { getUserNotifications } from "../services/notificationService";
import { getUsersByIds } from "../services/userService";

function StatCard({ label, value, valueStyle, delay, onPress }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.statCardWrap}>
      <TouchableOpacity activeOpacity={0.88} style={styles.statCard} onPress={onPress}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, valueStyle]}>{value}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allExpenses, setAllExpenses] = useState([]);
  const [memberProfilesById, setMemberProfilesById] = useState({});
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadLatestHomeData = React.useCallback(async () => {
    if (!user) return;

    const [groupsResult, expensesResult] = await Promise.all([
      getUserGroupsOnce(user.uid),
      getUserExpensesOnce(user.uid),
    ]);

    if (groupsResult.success) {
      setGroups(groupsResult.groups);
    }

    if (expensesResult.success) {
      setAllExpenses(expensesResult.expenses);
    }

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    const unsubscribeGroups = getUserGroups(user.uid, (data) => {
      setGroups(data);
      setLoading(false);
      setRefreshing(false);
    });

    const unsubscribeExpenses = getUserExpenses(user.uid, (expenses) => {
      setAllExpenses(expenses);
    });

    return () => {
      unsubscribeGroups();
      unsubscribeExpenses();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    const unsubscribe = getUserNotifications(user.uid, (notifications) => {
      setUnreadNotifications(
        notifications.filter((item) => !item.read).length,
      );
    });

    return unsubscribe;
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      loadLatestHomeData();
    }, [loadLatestHomeData]),
  );

  useEffect(() => {
    if (!groups.length) {
      setMemberProfilesById({});
      return;
    }

    const loadMemberProfiles = async () => {
      const memberIds = [...new Set(groups.flatMap((group) => group.members || []))];
      const result = await getUsersByIds(memberIds);

      if (!result.success) return;

      const nextProfiles = result.users.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});

      setMemberProfilesById(nextProfiles);
    };

    loadMemberProfiles();
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;

    return groups.filter((group) => group.name?.toLowerCase().includes(term));
  }, [groups, search]);

  const totals = useMemo(() => {
    if (!allExpenses.length || !groups.length) return { owed: 0, owe: 0 };

    // Aggregate all balances across groups
    const allBalances = groups.flatMap((group) => {
      const groupExpenses = allExpenses.filter((e) => e.groupId === group.id);
      return calculateBalances(groupExpenses, group.members || [], user.uid);
    });

    return {
      owed: getTotalOwed(allBalances),
      owe: getTotalOwe(allBalances),
    };
  }, [allExpenses, groups, user?.uid]);

  const renderGroup = ({ item, index }) => {
    const groupExpenses = allExpenses.filter((e) => e.groupId === item.id);
    const groupBalances = calculateBalances(
      groupExpenses,
      item.members || [],
      user.uid,
    );
    const balanceAmount = groupBalances.reduce(
      (sum, b) => sum + b.netBalance,
      0,
    );

    const groupWithProfiles = {
      ...item,
      members: (item.members || []).map(
        (memberId) => memberProfilesById[memberId] || memberId,
      ),
    };

    return (
      <Animated.View entering={FadeInDown.delay(index * 70).springify()}>
        <GroupCard
          group={groupWithProfiles}
          userBalance={balanceAmount}
          onPress={() =>
            navigation.navigate("GroupDetailsScreen", { groupId: item.id })
          }
        />
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />

      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroup}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadLatestHomeData();
            }}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          loading ? (
            <SkeletonLoader variant="home" />
          ) : (
          <>
            <Animated.View
              entering={FadeInDown.springify()}
              style={styles.header}
            >
              <View>
                <Text style={styles.kicker}>Split smarter, stay clear</Text>
                <Text style={styles.greeting}>
                  {userProfile?.name || userProfile?.phone || "SplitMate User"}
                </Text>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate("NotificationsScreen")}
                  style={styles.notificationButton}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={21}
                    color="#E2E8F0"
                  />
                  {unreadNotifications > 0 ? (
                    <View style={styles.notificationDot} />
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate("Profile")}
                  style={styles.profileButton}
                >
                  <MemberAvatar
                    name={userProfile?.name || userProfile?.phone || "User"}
                    photoUrl={userProfile?.photoUrl}
                    size="medium"
                    showOnline
                  />
                </TouchableOpacity>
              </View>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(110).springify()}
              style={styles.searchWrap}
            >
              <Ionicons name="search" size={18} color="#657188" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
                placeholder="Search groups or friends..."
                placeholderTextColor="#657188"
              />
            </Animated.View>

            <View style={styles.statsRow}>
              <StatCard
                label="You are owed"
                value={formatCurrency(totals.owed)}
                valueStyle={styles.owedValue}
                delay={170}
                onPress={() => navigation.navigate("BalanceBreakdownScreen", { mode: "owed" })}
              />
              <StatCard
                label="You owe"
                value={formatCurrency(totals.owe)}
                valueStyle={styles.oweValue}
                delay={240}
                onPress={() => navigation.navigate("BalanceBreakdownScreen", { mode: "owe" })}
              />
            </View>

            <Animated.View
              entering={FadeInDown.delay(280)}
              style={styles.sectionRow}
            >
              <Text style={styles.sectionTitle}>Your Groups</Text>
              <Text style={styles.sectionLink}>See all</Text>
            </Animated.View>
          </>
          )
        }
        ListEmptyComponent={
          loading ? (
            null
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No groups yet</Text>
              <Text style={styles.emptyText}>
                Create a group to start splitting expenses with friends.
              </Text>
            </View>
          )
        }
      />

      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.fab, { bottom: tabBarHeight + 22 }]}
        onPress={() => navigation.navigate("CreateGroupScreen")}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: surfaces.screen,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 130,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  kicker: {
    color: "#97A2B8",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  greeting: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "800",
  },
  profileButton: {
    padding: 2,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(124,58,237,0.28)",
    backgroundColor: surfaces.muted,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    backgroundColor: surfaces.card,
  },
  notificationDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#0F172A",
  },
  searchWrap: {
    height: 42,
    borderRadius: 10,
    backgroundColor: surfaces.card,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: fontSize.md,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent:"space-around",
    gap: 14,
    marginBottom: 26,
  },
  statCardWrap: {
    width:"48%"
  },
  statCard: {
    minHeight: 74,
    backgroundColor: surfaces.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    padding: 14,
    justifyContent: "center",
  },
  statLabel: {
    color: "#97A2B8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  owedValue: {
    color: "#34D399",
  },
  oweValue: {
    color: "#F87171",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "800",
  },
  sectionLink: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyState: {
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
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  fab: {
    position: "absolute",
    right: "10%",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: buttonTokens.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: buttonTokens.shadowColor,
    shadowOpacity: buttonTokens.shadowOpacity,
    shadowRadius: buttonTokens.shadowRadius,
    shadowOffset: buttonTokens.shadowOffset,
    elevation: buttonTokens.elevation,
  },
});
