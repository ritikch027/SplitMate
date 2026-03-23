import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import {
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
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedBackdrop from "../components/AnimatedBackdrop";
import MemberAvatar from "../components/MemberAvatar";
import { colors, fontSize, radius, spacing } from "../constants/theme";
import { useAlert } from "../context/useAlert";
import { useAuth } from "../context/useAuth";
import { signOut } from "../services/authService";
import { getUserExpensesOnce } from "../services/expenseService";
import { getUserGroups } from "../services/groupService";
import { uploadProfilePhoto } from "../services/storageService";
import { getUser, updateUser } from "../services/userService";
import { getReadableError } from "../utils/appError";

/*──────────────────────────────────────────────────────────────
  StatCard
──────────────────────────────────────────────────────────────*/
function StatCard({ label, value, highlight = false, delay }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      style={styles.statCardWrap}
    >
      <Animated.View style={styles.statCard}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text
          style={[styles.statValue, highlight && styles.statValueHighlight]}
        >
          {value}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

/*──────────────────────────────────────────────────────────────
  SettingRow
──────────────────────────────────────────────────────────────*/
function SettingRow({
  icon,
  label,
  iconColor,
  iconBg,
  delay,
  showDot = false,
  onPress,
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.settingRow}
        onPress={onPress}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
          <Text style={styles.settingText}>{label}</Text>
        </View>
        <View style={styles.settingRight}>
          {showDot ? <View style={styles.notificationDot} /> : null}
          <Ionicons name="chevron-forward" size={18} color="#63708A" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/*──────────────────────────────────────────────────────────────
  ProfileScreen
──────────────────────────────────────────────────────────────*/
export default function ProfileScreen() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [profile, setProfile] = useState(null);
  const [groupsCount, setGroupsCount] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [editVisible, setEditVisible] = useState(false);
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  /*
  |------------------------------------------------------------------
  | Sync from context instantly (no network)
  |------------------------------------------------------------------
  */
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setName("");
      setProfileLoading(false);
      return;
    }
    if (userProfile) {
      setProfile(userProfile);
      setName(userProfile.name || "");
      setPhotoUri("");
      setProfileLoading(false);
    }
  }, [user, userProfile]);

  /*
  |------------------------------------------------------------------
  | Fetch fresh profile from Firestore
  |------------------------------------------------------------------
  | ✅ Async logic wrapped in inner function — NOT passed to useEffect
  | ✅ No return value (no Promise returned to React)
  */
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setProfileLoading(true);
      const response = await getUser(user.uid);

      if (response.success) {
        setProfile(response.user);
        setName(response.user.name || "");
        setPhotoUri("");
      } else {
        setProfile(
          (current) =>
            current ||
            userProfile || {
              id: user.uid,
              name: "",
              phone: user.phoneNumber || "",
            },
        );
      }
      setProfileLoading(false);
    };

    loadProfile(); // ← called immediately, but Promise not returned
  }, [user, userProfile]);

  /*
  |------------------------------------------------------------------
  | Real-time listener → group count
  |------------------------------------------------------------------
  | ✅ getUserGroups returns unsubscribe function → safe to return
  */
  useEffect(() => {
    if (!user) return;

    const unsubscribe = getUserGroups(user.uid, (groups) => {
      setGroupsCount(groups.length);
    });

    return unsubscribe; // ← correct: returns cleanup function
  }, [user]);

  /*
  |------------------------------------------------------------------
  | One-time fetch → expense stats
  |------------------------------------------------------------------
  | ✅ getUserExpensesOnce is async → wrapped in inner function
  | ✅ Promise NOT returned to React
  */
  useEffect(() => {
    if (!user) return;

    const loadExpenses = async () => {
      const result = await getUserExpensesOnce(user.uid);

      if (result.success) {
        const total = result.expenses.reduce(
          (sum, expense) => sum + expense.amount,
          0,
        );
        setTotalExpenses(total);
      }
    };

    loadExpenses(); // ← called immediately, Promise not returned
  }, [user]);

  /*──────────────────────────────────────────────────────────────
    Derived values
  ──────────────────────────────────────────────────────────────*/
  const profileName = profile?.name?.trim() || "Unnamed user";
  const profilePhone = profile?.phone || user?.phoneNumber || "";
  const modalPreviewName = useMemo(
    () => name.trim() || profileName,
    [name, profileName],
  );
  const modalPreviewPhoto = photoUri || profile?.photoUrl || "";
  const formatCurrency = (amount) =>
    `Rs ${Number(amount || 0).toLocaleString("en-IN")}`;

  /*──────────────────────────────────────────────────────────────
    Handlers
  ──────────────────────────────────────────────────────────────*/
  const openEditModal = () => {
    setName(profile?.name || "");
    setPhotoUri("");
    setEditVisible(true);
  };

  const closeEditModal = () => {
    setName(profile?.name || "");
    setPhotoUri("");
    setEditVisible(false);
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showAlert({
        title: "Permission needed",
        message: "Allow photo access to update your profile picture.",
        variant: "info",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);

    try {
      let photoUrl = profile?.photoUrl || "";

      if (photoUri) {
        photoUrl = await uploadProfilePhoto(user.uid, photoUri);
      }

      const result = await updateUser(user.uid, {
        name: name.trim(),
        photoUrl,
      });

      if (result.success) {
        setProfile((current) => ({
          ...current,
          name: name.trim(),
          photoUrl,
        }));
        await refreshUserProfile();
        closeEditModal();
        showAlert({
          title: "Profile updated",
          message: "Your personal information has been refreshed.",
          variant: "success",
        });
      } else {
        showAlert({
          title: "Unable to save",
          message: result.error || "Please try again.",
          variant: "error",
        });
      }
    } catch (error) {
      showAlert(getReadableError(error, "We couldn't update your profile."));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSignOutVisible(false);
    await signOut();
  };

  /*──────────────────────────────────────────────────────────────
    Loading state
  ──────────────────────────────────────────────────────────────*/
  if (profileLoading && !profile) {
    return (
      <View style={styles.loadingWrap}>
        <AnimatedBackdrop />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  /*──────────────────────────────────────────────────────────────
    Render
  ──────────────────────────────────────────────────────────────*/
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />
      <View pointerEvents="none" style={styles.topGlow} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 20) + 28 },
        ]}
      >
        {/* ── Header / Avatar ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.header}>
          <View style={styles.avatarGlow} />
          <View style={styles.avatarWrap}>
            <View style={styles.avatarOuter}>
              <MemberAvatar
                name={profileName}
                photoUrl={profile?.photoUrl}
                size="xlarge"
                showRing={true}
              />
            </View>
          </View>
          <Text style={styles.name}>{profileName}</Text>
          <Text style={styles.handle}>{profilePhone}</Text>
        </Animated.View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <StatCard label="Groups" value={groupsCount} delay={100} />
          <StatCard
            label="Tracked"
            value={formatCurrency(totalExpenses)}
            highlight
            delay={180}
          />
        </View>

        {/* ── Section title ── */}
        <Animated.View
          entering={FadeInDown.delay(220)}
          style={styles.sectionHeader}
        >
          <Text style={styles.sectionTitle}>Account Settings</Text>
        </Animated.View>

        {/* ── Settings ── */}
        <View style={styles.settingsList}>
          <SettingRow
            icon="person-outline"
            label="Personal Information"
            iconColor={colors.accent}
            iconBg="rgba(124,58,237,0.16)"
            delay={260}
            onPress={openEditModal}
          />
          <SettingRow
            icon="card-outline"
            label="Payment Methods"
            iconColor="#60A5FA"
            iconBg="rgba(59,130,246,0.14)"
            delay={320}
            onPress={() => {}}
          />
          <SettingRow
            icon="lock-closed-outline"
            label="Privacy & Security"
            iconColor="#34D399"
            iconBg="rgba(16,185,129,0.14)"
            delay={380}
            onPress={() => {}}
          />
          <SettingRow
            icon="notifications-outline"
            label="Notifications"
            iconColor="#FB923C"
            iconBg="rgba(249,115,22,0.14)"
            delay={440}
            showDot
            onPress={() => {}}
          />
        </View>

        {/* ── Sign out ── */}
        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.signOutBtn}
            onPress={() => setSignOutVisible(true)}
          >
            <Ionicons name="log-out-outline" size={18} color="#F87171" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* ── Edit name modal ── */}
      <Modal visible={editVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeInUp.springify()}
            style={styles.modalSheet}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Personal Information</Text>
            <Text style={styles.modalSubtitle}>
              Update how your profile appears across SplitMate.
            </Text>

            <View style={styles.modalAvatarSection}>
              <View style={styles.modalAvatarOuter}>
                <MemberAvatar
                  name={modalPreviewName}
                  photoUrl={modalPreviewPhoto}
                  size="large"
                  showRing={false}
                  showOnline={false}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.photoButton}
                onPress={handlePickImage}
              >
                <Ionicons
                  name="image-outline"
                  size={16}
                  color={colors.accent}
                />
                <Text style={styles.photoButtonText}>
                  {modalPreviewPhoto ? "Change Photo" : "Add Photo"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.subtext}
              style={styles.modalInput}
            />

            <Text style={styles.fieldLabel}>Phone Number</Text>
            <View style={styles.phonePill}>
              <Text style={styles.phoneText}>
                {profilePhone || "No number available"}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.cancelBtn}
                onPress={closeEditModal}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.saveBtn}
                onPress={handleSave}
              >
                <Text style={styles.saveText}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={signOutVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeInUp.springify()}
            style={styles.confirmSheet}
          >
            <View style={styles.confirmIconWrap}>
              <Ionicons name="log-out-outline" size={22} color="#F87171" />
            </View>
            <Text style={styles.confirmTitle}>Sign out of SplitMate?</Text>
            <Text style={styles.confirmSubtitle}>
              You&apos;ll need to verify your phone again to get back in.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.cancelBtn}
                onPress={() => setSignOutVisible(false)}
              >
                <Text style={styles.cancelText}>Stay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.dangerBtn}
                onPress={handleSignOut}
              >
                <Text style={styles.dangerText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
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
  root: { flex: 1, backgroundColor: "#050816" },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  loadingText: { color: colors.subtext },
  topGlow: {
    position: "absolute",
    top: -120,
    left: "50%",
    marginLeft: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(124,58,237,0.18)",
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 0 },
  },
  header: { alignItems: "center", marginBottom: 28 },
  avatarGlow: {
    position: "absolute",
    top: 9,
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: "rgba(255,244,214,0.18)",
    shadowColor: "#FDE68A",
    shadowOpacity: 0.75,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarWrap: { marginBottom: 18, paddingTop: 6 },
  avatarOuter: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.86)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
  },
  name: {
    color: "#F8FAFC",
    fontSize: 35,
    fontWeight: "800",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  handle: { marginTop: 6, color: "#7C8BA5", fontSize: 16, fontWeight: "500" },
  statsRow: { flexDirection: "row", gap: 14, marginBottom: 34 },
  statCardWrap: { flex: 1 },
  statCard: {
    minHeight: 74,
    backgroundColor: "rgba(21, 29, 48, 0.96)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  statLabel: {
    color: "#7E8A9D",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  statValue: { color: "#F8FAFC", fontSize: 19, fontWeight: "800" },
  statValueHighlight: { color: colors.accent },
  sectionHeader: { marginBottom: 14, paddingLeft: 2 },
  sectionTitle: {
    color: "#66748B",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  settingsList: { gap: 14, marginBottom: 22 },
  settingRow: {
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    backgroundColor: "rgba(21, 29, 48, 0.96)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  settingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingText: { color: "#E5E7EB", fontSize: 15, fontWeight: "600" },
  settingRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  notificationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  signOutBtn: {
    minHeight: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    backgroundColor: "rgba(127,29,29,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  signOutText: { color: "#F87171", fontSize: fontSize.md, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(2,6,23,0.72)",
  },
  modalSheet: {
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
  },
  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.45)",
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    color: "#F8FAFC",
    fontSize: fontSize.lg,
    fontWeight: "800",
    marginBottom: 6,
  },
  modalSubtitle: {
    color: "#94A3B8",
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  modalAvatarSection: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalAvatarOuter: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.86)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    marginBottom: 14,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(124,58,237,0.12)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.24)",
  },
  photoButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  fieldLabel: {
    color: "#D9E1EE",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    padding: spacing.md,
    borderRadius: radius.md,
    color: "#F8FAFC",
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
  },
  phonePill: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: "rgba(15,23,42,0.7)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  phoneText: {
    color: "#CBD5E1",
    fontSize: fontSize.md,
    fontWeight: "500",
  },
  modalActions: { flexDirection: "row", gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.7)",
  },
  cancelText: { color: "#CBD5E1", fontWeight: "600" },
  saveBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.accent,
  },
  saveText: { color: "#FFFFFF", fontWeight: "700", fontSize: fontSize.md },
  confirmSheet: {
    backgroundColor: "#0F172A",
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    marginHorizontal: 20,
  },
  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.12)",
    alignSelf: "center",
    marginBottom: 16,
  },
  confirmTitle: {
    color: "#F8FAFC",
    fontSize: fontSize.lg,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  confirmSubtitle: {
    color: "#94A3B8",
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  dangerBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.16)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.28)",
  },
  dangerText: {
    color: "#F87171",
    fontWeight: "700",
    fontSize: fontSize.md,
  },
});
