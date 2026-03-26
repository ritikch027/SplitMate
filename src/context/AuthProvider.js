import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "../config/supabaseConfig";
import { colors } from "../constants/theme";
import { initializePushNotifications } from "../services/pushNotificationService";
import { createUser } from "../services/userService";
import { getReadableError } from "../utils/appError";
import { AlertContext } from "./AlertContext";
import { AuthContext } from "./AuthContext";

const getProfileCacheKey = (uid) => `splitmate:user-profile:${uid}`;

const normalizeAuthUser = (supabaseUser) => {
  if (!supabaseUser) return null;

  return {
    ...supabaseUser,
    uid: supabaseUser.id,
    phoneNumber: supabaseUser.phone || "",
  };
};

const AuthProvider = ({ children }) => {
  const { showAlert } = useContext(AlertContext);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const lastProfileErrorRef = useRef("");

  const fetchUserProfile = useCallback(
    async (uid, phoneNumber = "") => {
      try {
        setProfileLoading(true);
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", uid)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data) {
          setUserProfile(data);
          await AsyncStorage.setItem(
            getProfileCacheKey(uid),
            JSON.stringify(data),
          );
        } else {
          const result = await createUser(uid, phoneNumber);
          if (result.success) {
            setUserProfile(result.user);
            await AsyncStorage.setItem(
              getProfileCacheKey(uid),
              JSON.stringify(result.user),
            );
          } else {
            setUserProfile(null);
          }
        }
      } catch (e) {
        console.error("Error fetching profile:", e);
        const friendlyError = getReadableError(
          e,
          "We couldn't load your profile right now.",
        );

        if (
          lastProfileErrorRef.current !==
          friendlyError.title + friendlyError.message
        ) {
          lastProfileErrorRef.current =
            friendlyError.title + friendlyError.message;
          showAlert({
            ...friendlyError,
            duration: 3500,
          });
        }

        const fallbackProfile = {
          id: uid,
          phone: phoneNumber || "",
          name: "",
          photoUrl: "",
          groups: [],
          profileCompleted: true,
        };

        let hasCachedProfile = false;

        setUserProfile((current) => {
          hasCachedProfile = Boolean(current);
          return current || fallbackProfile;
        });

        try {
          if (!hasCachedProfile) {
            const cachedProfile = await AsyncStorage.getItem(
              getProfileCacheKey(uid),
            );
            if (cachedProfile) {
              setUserProfile(JSON.parse(cachedProfile));
            } else {
              await AsyncStorage.setItem(
                getProfileCacheKey(uid),
                JSON.stringify(fallbackProfile),
              );
            }
          }
        } catch (_cacheError) {
          // Ignore cache failures and keep fallback profile in memory.
        }
      } finally {
        setProfileLoading(false);
      }
    },
    [showAlert],
  );

  const refreshUserProfile = async () => {
    if (user) await fetchUserProfile(user.uid, user.phoneNumber || "");
  };

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      const supabaseUser = session?.user;

      if (supabaseUser) {
        const normalizedUser = normalizeAuthUser(supabaseUser);
        setUser(normalizedUser);
        try {
          const cachedProfile = await AsyncStorage.getItem(
            getProfileCacheKey(supabaseUser.id),
          );

          if (cachedProfile && isMounted) {
            setUserProfile(JSON.parse(cachedProfile));
          } else if (isMounted) {
            setUserProfile({
              id: supabaseUser.id,
              phone: normalizedUser.phoneNumber,
              name: "",
              photoUrl: "",
              groups: [],
              profileCompleted: true,
            });
          }
        } catch (_cacheError) {
          if (isMounted) {
            setUserProfile({
              id: supabaseUser.id,
              phone: normalizedUser.phoneNumber,
              name: "",
              photoUrl: "",
              groups: [],
              profileCompleted: true,
            });
          }
        }

        if (isMounted) setLoading(false);
        fetchUserProfile(normalizedUser.uid, normalizedUser.phoneNumber);
        initializePushNotifications(normalizedUser.uid);
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const value = {
    user,
    userProfile,
    loading,
    profileLoading,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
