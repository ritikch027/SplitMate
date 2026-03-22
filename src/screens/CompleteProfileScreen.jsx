import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import MemberAvatar from "../components/MemberAvatar";
import { colors, fontSize } from "../constants/theme";
import { useAuth } from "../context/useAuth";
import { uploadProfilePhoto } from "../services/storageService";
import { updateUser } from "../services/userService";

export default function CompleteProfileScreen() {
  const { user, userProfile, refreshUserProfile } = useAuth();

  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [saving, setSaving] = useState(false);

  const displayPhone = userProfile?.phone || user?.phoneNumber || "";
  const previewPhoto = photoUri || userProfile?.photoUrl || "";
  const previewName = useMemo(() => name.trim() || "Your Name", [name]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to choose a profile picture.");
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
      Alert.alert("Missing name", "Please enter your name to continue.");
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
        Alert.alert("Unable to save", result.error || "Please try again.");
        return;
      }

      await refreshUserProfile();
    } catch (error) {
      Alert.alert("Unable to save", error.message || "Please try again.");
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
    backgroundColor: "#0A1020",
    paddingHorizontal: 20,
  },
  content: {
    paddingTop: 96,
    paddingBottom: 40,
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
    backgroundColor: "rgba(20, 28, 45, 0.84)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
    backgroundColor: "rgba(124,58,237,0.12)",
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
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    color: "#F8FAFC",
    paddingHorizontal: 14,
    fontSize: 15,
  },
  phonePill: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: "rgba(31,41,55,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
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
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
