import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedBackdrop from "../components/AnimatedBackdrop";
import MemberAvatar from "../components/MemberAvatar";
import { buttonTokens, colors, fontSize, surfaces } from "../constants/theme";
import { useAlert } from "../context/useAlert";
import { useAuth } from "../context/useAuth";
import { uploadProfilePhoto } from "../services/storageService";
import { updateUser } from "../services/userService";
import { getReadableError } from "../utils/appError";

export default function CompleteProfileScreen() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [saving, setSaving] = useState(false);

  const displayPhone = userProfile?.phone || user?.phoneNumber || "";
  const previewPhoto = photoUri || userProfile?.photoUrl || "";
  const previewName = useMemo(() => name.trim() || "Your Name", [name]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showAlert({
        title: "Permission needed",
        message: "Allow photo access to choose a profile picture.",
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

  const handleContinue = async () => {
    if (!user) return;

    if (!name.trim()) {
      showAlert({
        title: "Name required",
        message: "Please enter your name to continue.",
        variant: "error",
      });
      return;
    }

    try {
      setSaving(true);

      let photoUrl = userProfile?.photoUrl || "";

      if (photoUri) {
        photoUrl = await uploadProfilePhoto(user.uid, photoUri);
      }

      const result = await updateUser(user.uid, {
        phone: displayPhone,
        name: name.trim(),
        photoUrl,
        profileCompleted: true,
      });

      if (!result.success) {
        showAlert({
          title: "Unable to save",
          message: result.error || "Please try again.",
          variant: "error",
        });
        return;
      }

      await refreshUserProfile();
      showAlert({
        title: "Profile saved",
        message: "You’re all set to use SplitMate.",
        variant: "success",
      });
    } catch (error) {
      showAlert(getReadableError(error, "We couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <AnimatedBackdrop />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 20) + 44, paddingBottom: Math.max(insets.bottom, 20) + 20 },
        ]}
      >
        <Animated.View entering={FadeInDown.springify()} style={styles.header}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Add your name and photo before entering SplitMate.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(90).springify()} style={styles.previewCard}>
          <View style={styles.avatarWrap}>
            <MemberAvatar name={previewName} photoUrl={previewPhoto} size="large" showOnline={false} />
          </View>

          <TouchableOpacity activeOpacity={0.88} style={styles.photoButton} onPress={pickImage}>
            <Ionicons name="image-outline" size={16} color={colors.accent} />
            <Text style={styles.photoButtonText}>
              {previewPhoto ? "Change Photo" : "Add Photo"}
            </Text>
          </TouchableOpacity>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              placeholderTextColor="#64748B"
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phonePill}>
              <Text style={styles.phoneText}>{displayPhone || "No number available"}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).springify()}>
          <TouchableOpacity activeOpacity={0.9} style={styles.button} onPress={handleContinue} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save And Continue</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: surfaces.screenSoft,
    paddingHorizontal: 20,
  },
  content: {
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: fontSize.md,
    marginTop: 10,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  previewCard: {
    borderRadius: 16,
    backgroundColor: surfaces.card,
    borderWidth: 1,
    borderColor: surfaces.border,
    padding: 20,
  },
  avatarWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  photoButton: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaces.glowAccent,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.24)",
    marginBottom: 20,
  },
  photoButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  fieldBlock: {
    marginBottom: 16,
  },
  label: {
    color: "#D9E1EE",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 10,
    backgroundColor: surfaces.input,
    borderWidth: 1,
    borderColor: surfaces.border,
    color: "#F8FAFC",
    paddingHorizontal: 14,
    fontSize: 15,
  },
  phonePill: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: surfaces.input,
    borderWidth: 1,
    borderColor: surfaces.border,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  phoneText: {
    color: "#CBD5E1",
    fontSize: 15,
    fontWeight: "500",
  },
  button: {
    marginTop: 20,
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
