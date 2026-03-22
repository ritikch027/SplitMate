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

import AnimatedBackdrop from "../components/AnimatedBackdrop";
import GroupCard from "../components/GroupCard";
import MemberAvatar from "../components/MemberAvatar";
import SkeletonLoader from "../components/SkeletonLoader";
import { colors, fontSize, spacing } from "../constants/theme";
import { useAuth } from "../context/useAuth";
import { getUserGroups } from "../services/groupService";

function StatCard({ label, value, valueStyle, delay }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueStyle]}>{value}</Text>
    </Animated.View>
  );
}

export default function HomeScreen({ navigation }) {
  const { user, userProfile } = useAuth();

  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return undefined;

    const unsubscribe = getUserGroups(user.uid, (data) => {
      setGroups(data);
      setLoading(false);
      setRefreshing(false);
    });

    return unsubscribe;
  }, [user]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;

    return groups.filter((group) => group.name?.toLowerCase().includes(term));
  }, [groups, search]);

  const totals = useMemo(() => {
    let owed = 0;
    let owe = 0;

    groups.forEach((group) => {
      const marker = group.id.charCodeAt(0) % 2 === 0 ? 1 : -1;
      const amount = ((group.members?.length || 1) * 210) / 10;

      if (marker > 0) owed += amount;
      else owe += amount;
    });

    return { owed, owe };
  }, [groups]);

  const renderGroup = ({ item, index }) => {
    const simulatedBalance = (item.id.charCodeAt(0) % 3) - 1;
    const balanceAmount = simulatedBalance === 0 ? 0 : simulatedBalance * 85;

    return (
      <Animated.View entering={FadeInDown.delay(index * 70).springify()}>
        <GroupCard
          group={item}
          userBalance={balanceAmount}
          onPress={() => navigation.navigate("GroupDetailsScreen", { groupId: item.id })}
        />
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
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
            onRefresh={() => setRefreshing(true)}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <>
            <Animated.View entering={FadeInDown.springify()} style={styles.header}>
              <View>
                <Text style={styles.kicker}>Good morning,</Text>
                <Text style={styles.greeting}>
                  {userProfile?.name || userProfile?.phone || "SplitMate User"}
                </Text>
              </View>

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
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(110).springify()} style={styles.searchWrap}>
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
                value={`Rs ${totals.owed.toFixed(2)}`}
                valueStyle={styles.owedValue}
                delay={170}
              />
              <StatCard
                label="You owe"
                value={`Rs ${totals.owe.toFixed(2)}`}
                valueStyle={styles.oweValue}
                delay={240}
              />
            </View>

            <Animated.View entering={FadeInDown.delay(280)} style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Your Groups</Text>
              <Text style={styles.sectionLink}>See all</Text>
            </Animated.View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonLoader variant="card" count={4} />
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
        style={styles.fab}
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
    backgroundColor: "#10182B",
    paddingHorizontal: 20,
    paddingTop: 28,
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
  kicker: {
    color: "#97A2B8",
    fontSize: 16,
    fontWeight: "500",
  },
  greeting: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  profileButton: {
    padding: 2,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: "rgba(124,58,237,0.12)",
  },
  searchWrap: {
    height: 42,
    borderRadius: 10,
    backgroundColor: "rgba(30,41,59,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
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
    gap: 14,
    marginBottom: 26,
  },
  statCard: {
    flex: 1,
    minHeight: 74,
    backgroundColor: "rgba(30, 41, 59, 0.76)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
    alignSelf: "center",
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
});
