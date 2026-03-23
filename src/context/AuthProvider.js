import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../config/firebaseConfig";
import { colors } from "../constants/theme";
import { AlertContext } from "./AlertContext";
import { createUser } from "../services/userService";
import { getReadableError } from "../utils/appError";
import { AuthContext } from "./AuthContext"; // Create this file if it doesn't exist

const getProfileCacheKey = (uid) => `splitmate:user-profile:${uid}`;

const AuthProvider = ({ children }) => {
  const { showAlert } = useContext(AlertContext);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const lastProfileErrorRef = useRef("");

  const fetchUserProfile = useCallback(async (uid, phoneNumber = "") => {
    try {
      setProfileLoading(true);
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const profileData = docSnap.data();
        setUserProfile(profileData);
        await AsyncStorage.setItem(
          getProfileCacheKey(uid),
          JSON.stringify(profileData),
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

      if (lastProfileErrorRef.current !== friendlyError.title + friendlyError.message) {
        lastProfileErrorRef.current = friendlyError.title + friendlyError.message;
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
          const cachedProfile = await AsyncStorage.getItem(getProfileCacheKey(uid));
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
  }, [showAlert]);

  const refreshUserProfile = async () => {
    if (user) await fetchUserProfile(user.uid, user.phoneNumber || "");
  };

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const cachedProfile = await AsyncStorage.getItem(
            getProfileCacheKey(firebaseUser.uid),
          );

          if (cachedProfile && isMounted) {
            setUserProfile(JSON.parse(cachedProfile));
          } else if (isMounted) {
            setUserProfile({
              id: firebaseUser.uid,
              phone: firebaseUser.phoneNumber || "",
              name: "",
              photoUrl: "",
              groups: [],
              profileCompleted: true,
            });
          }
        } catch (_cacheError) {
          if (isMounted) {
            setUserProfile({
              id: firebaseUser.uid,
              phone: firebaseUser.phoneNumber || "",
              name: "",
              photoUrl: "",
              groups: [],
              profileCompleted: true,
            });
          }
        }

        if (isMounted) setLoading(false);
        fetchUserProfile(firebaseUser.uid, firebaseUser.phoneNumber || "");
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
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
