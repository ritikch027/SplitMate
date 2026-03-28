import React, { useState } from "react";
import {
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

import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedBackdrop from "../components/AnimatedBackdrop";
import ScreenHeader from "../components/ScreenHeader";
import { buttonTokens, fontSize, surfaces } from "../constants/theme";
import { useAlert } from "../context/useAlert";
import { useAuth } from "../context/useAuth";
import { createGroup } from "../services/groupService";
import { getUsersByPhone } from "../services/userService";
import { getReadableError } from "../utils/appError";

const emojiOptions = ["🏠", "✈️", "🍽️", "🎉", "🧳", "💼"];

export default function CreateGroupScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🏠");
  const [phones, setPhones] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      showAlert({
        title: "Group name missing",
        message: "Please enter a group name.",
        variant: "error",
      });
      return;
    }

    setLoading(true);

    try {
      const phoneNumbers = phones
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => (value.startsWith("+91") ? value : `+91${value}`));

      const lookup = await getUsersByPhone(phoneNumbers);

      if (!lookup.success) {
        showAlert({
          title: "Unable to find members",
          message: lookup.error || "Please try again.",
          variant: "error",
        });
        return;
      }

      const memberIds = [...new Set([user.uid, ...lookup.users.map((item) => item.id)])];
      const result = await createGroup(
        name.trim(),
        emoji,
        memberIds,
        user.uid,
        userProfile?.name || userProfile?.phone || "Someone",
      );

      if (!result.success) {
        showAlert({
          title: "Unable to create group",
          message: result.error || "Please try again.",
          variant: "error",
        });
        return;
      }

      showAlert({
        title: "Group created",
        message: "Your group is ready to start splitting.",
        variant: "success",
      });
      navigation.replace("GroupDetailsScreen", { groupId: result.groupId });
    } catch (error) {
      showAlert({
        ...getReadableError(error, "We couldn't create the group right now."),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 6 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.springify()}>
          <ScreenHeader
            title="Create Group"
            subtitle={`Signed in as ${userProfile?.name || userProfile?.phone || "you"}`}
            onBack={() => navigation.goBack()}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.card}>
          <Text style={styles.label}>Group Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Trip to Goa"
            placeholderTextColor="#6B7280"
            style={styles.input}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.card}>
          <Text style={styles.label}>Pick an Emoji</Text>
          <View style={styles.emojiGrid}>
            {emojiOptions.map((item) => (
              <TouchableOpacity
                key={item}
                activeOpacity={0.85}
                style={[styles.emojiChip, emoji === item && styles.emojiSelected]}
                onPress={() => setEmoji(item)}
              >
                <Text style={styles.emojiText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.card}>
          <Text style={styles.label}>Invite Members</Text>
          <Text style={styles.helper}>
            Add phone numbers separated by commas. Leave blank to create a solo group.
          </Text>
          <TextInput
            value={phones}
            onChangeText={setPhones}
            placeholder="9876543210, 9123456789"
            placeholderTextColor="#6B7280"
            style={[styles.input, styles.multiInput]}
            multiline
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280).springify()}>
          <TouchableOpacity activeOpacity={0.9} onPress={handleCreate} style={styles.button} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? "Creating..." : "Create Group"}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: surfaces.screen,
    paddingHorizontal: 20,
  },
  content: {
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    backgroundColor: surfaces.card,
    borderWidth: 1,
    borderColor: surfaces.border,
    padding: 16,
    marginBottom: 14,
  },
  label: {
    color: "#F8FAFC",
    fontSize: fontSize.md,
    fontWeight: "700",
    marginBottom: 10,
  },
  helper: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  input: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: surfaces.input,
    borderWidth: 1,
    borderColor: surfaces.border,
    color: "#F8FAFC",
    paddingHorizontal: 14,
    fontSize: 15,
  },
  multiInput: {
    minHeight: 100,
    paddingVertical: 14,
    textAlignVertical: "top",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  emojiChip: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: surfaces.input,
    borderWidth: 1,
    borderColor: surfaces.border,
  },
  emojiSelected: {
    borderColor: "rgba(139,92,246,0.38)",
    backgroundColor: "rgba(124,58,237,0.16)",
  },
  emojiText: {
    fontSize: 24,
  },
  button: {
    marginTop: 8,
    height: buttonTokens.height,
    borderRadius: buttonTokens.radius,
    backgroundColor: buttonTokens.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: buttonTokens.shadowColor,
    shadowOpacity: buttonTokens.shadowOpacity,
    shadowRadius: buttonTokens.shadowRadius,
    shadowOffset: buttonTokens.shadowOffset,
    elevation: buttonTokens.elevation,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
