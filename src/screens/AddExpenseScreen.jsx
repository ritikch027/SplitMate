import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { colors } from "../constants/theme";
import { useAuth } from "../context/useAuth";
import { addExpense } from "../services/expenseService";

const categories = [
  { name: "Food", icon: "book-outline" },
  { name: "Transport", icon: "flash-outline" },
  { name: "Entertainment", icon: "videocam-outline" },
  { name: "Shopping", icon: "cart-outline" },
];

export default function AddExpenseScreen({ navigation, route }) {
  const { groupId, groupName, members = [] } = route.params;
  const { user, userProfile } = useAuth();

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food");
  const [paidBy, setPaidBy] = useState(user?.uid || "");
  const [splitType, setSplitType] = useState("equal");
  const [customSplits, setCustomSplits] = useState({});
  const [loading, setLoading] = useState(false);

  const equalSplitPreview = useMemo(() => {
    const value = Number(amount);
    if (!value || !members.length) return 0;
    return value / members.length;
  }, [amount, members.length]);

  const updateCustomSplit = (memberId, value) => {
    setCustomSplits((current) => ({
      ...current,
      [memberId]: value,
    }));
  };

  const buildSplitData = () => {
    const totalAmount = Number(amount);

    if (splitType === "equal") {
      return members.reduce((acc, member) => {
        acc[member.id] = Number((totalAmount / members.length).toFixed(2));
        return acc;
      }, {});
    }

    const parsedSplits = members.reduce((acc, member) => {
      acc[member.id] = Number(customSplits[member.id] || 0);
      return acc;
    }, {});

    const totalCustom = Object.values(parsedSplits).reduce((sum, value) => sum + value, 0);

    if (Number(totalCustom.toFixed(2)) !== Number(totalAmount.toFixed(2))) {
      throw new Error("Custom splits must add up to the total amount.");
    }

    return parsedSplits;
  };

  const handleAddExpense = async () => {
    const totalAmount = Number(amount);

    if (!totalAmount || totalAmount <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid expense amount.");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Missing description", "Please enter what this expense was for.");
      return;
    }

    if (!members.length) {
      Alert.alert("Missing members", "This group has no members to split with.");
      return;
    }

    try {
      setLoading(true);

      const splitData = buildSplitData();
      const expenseData = {
        description: description.trim(),
        amount: totalAmount,
        category,
        paidBy,
        paidByName: members.find((member) => member.id === paidBy)?.name || "Unknown",
        splitBetween: Object.keys(splitData),
        splits: splitData,
        createdBy: user.uid,
        createdByName: userProfile?.name || user.phoneNumber || "You",
        groupName: groupName || "Group",
      };

      const result = await addExpense(groupId, expenseData);

      if (!result.success) {
        Alert.alert("Unable to add expense", result.error || "Please try again.");
        return;
      }

      Alert.alert("Expense added", "The group has been updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert("Unable to add expense", error.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />

      <Animated.View entering={FadeInDown.springify()} style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.goBack()}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Expense</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.amountBlock}>
            <Text style={styles.amountLabel}>How much?</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currency}>Rs</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#243044"
              />
            </View>
          </Animated.View>

          <TextInput
            style={styles.description}
            placeholder="What was it for?"
            placeholderTextColor="#6B7280"
            value={description}
            onChangeText={setDescription}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.categoryRow}>
              {categories.map((item) => {
                const selected = category === item.name;

                return (
                  <TouchableOpacity
                    key={item.name}
                    activeOpacity={0.85}
                    style={styles.categoryItem}
                    onPress={() => setCategory(item.name)}
                  >
                    <View style={[styles.categoryIconWrap, selected && styles.categoryIconWrapActive]}>
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={selected ? "#fff" : "#94A3B8"}
                      />
                    </View>
                    <Text style={[styles.categoryText, selected && styles.categoryTextActive]}>
                      {item.name === "Entertainment" ? "Fun" : item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Split Strategy</Text>
              <Text style={styles.sectionLink}>Details</Text>
            </View>

            <View style={styles.toggleWrap}>
              <TouchableOpacity
                style={[styles.toggle, splitType === "equal" && styles.toggleActive]}
                onPress={() => setSplitType("equal")}
              >
                <Text style={[styles.toggleText, splitType === "equal" && styles.toggleTextActive]}>
                  Equally
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggle, splitType === "custom" && styles.toggleActive]}
                onPress={() => setSplitType("custom")}
              >
                <Text style={[styles.toggleText, splitType === "custom" && styles.toggleTextActive]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {splitType === "equal" ? (
              <Text style={styles.helperText}>
                Each member pays Rs {equalSplitPreview ? equalSplitPreview.toFixed(2) : "0.00"}
              </Text>
            ) : (
              members.map((member) => (
                <View key={member.id} style={styles.customRow}>
                  <Text style={styles.memberName}>{member.name || member.phone}</Text>
                  <TextInput
                    value={customSplits[member.id] || ""}
                    onChangeText={(value) => updateCustomSplit(member.id, value)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#6B7280"
                    style={styles.customInput}
                  />
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Splitting With</Text>
            <View style={styles.membersWrap}>
              {members.map((member) => {
                const selected = paidBy === member.id;

                return (
                  <TouchableOpacity
                    key={member.id}
                    activeOpacity={0.85}
                    style={[styles.memberChip, selected && styles.memberChipActive]}
                    onPress={() => setPaidBy(member.id)}
                  >
                    <Text style={[styles.memberChipText, selected && styles.memberChipTextActive]}>
                      {member.id === user?.uid ? "You" : member.name || member.phone}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.submit}
            onPress={handleAddExpense}
            disabled={loading}
          >
            <Text style={styles.submitText}>{loading ? "Creating..." : "Create Expense"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "96%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#111827",
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#4B5563",
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  cancel: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "500",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 48,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  amountBlock: {
    alignItems: "center",
    paddingVertical: 20,
  },
  amountLabel: {
    color: "#9CA3AF",
    fontSize: 16,
    marginBottom: 10,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  currency: {
    color: colors.accent,
    fontSize: 40,
    fontWeight: "800",
    marginRight: 10,
  },
  amountInput: {
    minWidth: 180,
    color: "#F8FAFC",
    fontSize: 52,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 0,
  },
  description: {
    height: 50,
    borderRadius: 10,
    backgroundColor: "#1F2937",
    color: "#F8FAFC",
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryItem: {
    alignItems: "center",
    width: "23%",
  },
  categoryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1F2937",
    marginBottom: 8,
  },
  categoryIconWrapActive: {
    backgroundColor: colors.accent,
  },
  categoryText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "600",
  },
  categoryTextActive: {
    color: "#F8FAFC",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionLink: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  toggleWrap: {
    flexDirection: "row",
    backgroundColor: "#1F2937",
    borderRadius: 10,
    padding: 4,
  },
  toggle: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#374151",
  },
  toggleText: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "700",
  },
  toggleTextActive: {
    color: "#F8FAFC",
  },
  helperText: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 12,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  memberName: {
    color: "#F8FAFC",
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  customInput: {
    width: 96,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#1F2937",
    color: "#F8FAFC",
    textAlign: "right",
    paddingHorizontal: 14,
    fontSize: 15,
  },
  membersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  memberChip: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "rgba(124,58,237,0.12)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
    justifyContent: "center",
  },
  memberChipActive: {
    backgroundColor: "rgba(124,58,237,0.24)",
    borderColor: "rgba(124,58,237,0.45)",
  },
  memberChipText: {
    color: "#D8B4FE",
    fontSize: 15,
    fontWeight: "600",
  },
  memberChipTextActive: {
    color: "#F8FAFC",
  },
  submit: {
    marginTop: 8,
    height: 54,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
});
