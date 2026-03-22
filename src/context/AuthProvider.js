import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth, db } from "../config/firebaseConfig";
import { colors } from "../constants/theme";
import { createUser } from "../services/userService";
import { AuthContext } from "./AuthContext"; // Create this file if it doesn't exist

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (uid, phoneNumber = "") => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      } else {
        const result = await createUser(uid, phoneNumber);
        setUserProfile(result.success ? result.user : null);
      }
    } catch (e) {
      console.error("Error fetching profile:", e);
    }
  };

  const refreshUserProfile = async () => {
    if (user) await fetchUserProfile(user.uid, user.phoneNumber || "");
  };

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchUserProfile(firebaseUser.uid, firebaseUser.phoneNumber || "");
      } else {
        setUser(null);
        setUserProfile(null);
      }

      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

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

  const value = { user, userProfile, refreshUserProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
