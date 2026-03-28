import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/useAuth";

/* Screens */
import ActivityScreen from "../screens/ActivityScreen";
import AddExpenseScreen from "../screens/AddExpenseScreen";
import BalanceBreakdownScreen from "../screens/BalanceBreakdownScreen";
import CompleteProfileScreen from "../screens/CompleteProfileScreen";
import CreateGroupScreen from "../screens/CreateGroupScreen.jsx";
import GroupDetailsScreen from "../screens/GroupDetailsScreen";
import HomeScreen from "../screens/HomeScreen";
import LoginScreen from "../screens/LoginScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import OTPScreen from "../screens/OTPScreen";
import ProfileScreen from "../screens/ProfileScreen";

/*──────────────────────────────────────────────────────────────
  Navigators
──────────────────────────────────────────────────────────────*/
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/*──────────────────────────────────────────────────────────────
  Auth Stack
  Shown when user is NOT logged in
──────────────────────────────────────────────────────────────*/
const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: "fade",
    }}
  >
    <Stack.Screen name="LoginScreen" component={LoginScreen} />
    <Stack.Screen name="OTPScreen" component={OTPScreen} />
  </Stack.Navigator>
);

/*──────────────────────────────────────────────────────────────
  Profile Setup Stack
  Shown after OTP if profile is not completed yet
──────────────────────────────────────────────────────────────*/
const ProfileSetupStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: "fade",
    }}
  >
    <Stack.Screen
      name="CompleteProfileScreen"
      component={CompleteProfileScreen}
    />
  </Stack.Navigator>
);

/*──────────────────────────────────────────────────────────────
  Home Tab Stack
  Stack inside the Home tab for nested navigation
──────────────────────────────────────────────────────────────*/
const HomeTab = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: "slide_from_right",
    }}
  >
    <Stack.Screen name="HomeScreen" component={HomeScreen} />
  </Stack.Navigator>
);

/*──────────────────────────────────────────────────────────────
  Main Tabs
  Bottom tab bar shown to logged-in users
──────────────────────────────────────────────────────────────*/
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarActiveTintColor: "#7C3AED",
      tabBarInactiveTintColor: "#6B7280",
      tabBarLabelStyle: styles.label,
      tabBarIcon: ({ color, focused }) => {
        let iconName;

        if (route.name === "HomeTab")
          iconName = focused ? "home" : "home-outline";
        if (route.name === "Activity")
          iconName = focused ? "time" : "time-outline";
        if (route.name === "Profile")
          iconName = focused ? "person" : "person-outline";

        return (
          <Ionicons name={iconName} size={focused ? 26 : 22} color={color} />
        );
      },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeTab}
        options={{ tabBarLabel: "Home" }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ tabBarLabel: "Activity" }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
        }}
      />
    </Tab.Navigator>
  );
};

/*──────────────────────────────────────────────────────────────
  Main Stack
  Wraps tabs + screens pushed on top of tabs
──────────────────────────────────────────────────────────────*/
const MainStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: "slide_from_right",
    }}
  >
    {/* Tab navigator lives here */}
    <Stack.Screen name="MainTabs" component={MainTabs} />

    {/* These screens push on top of the tab bar */}
    <Stack.Screen name="GroupDetailsScreen" component={GroupDetailsScreen} />
    <Stack.Screen name="CreateGroupScreen" component={CreateGroupScreen} />
    <Stack.Screen name="AddExpenseScreen" component={AddExpenseScreen} />
    <Stack.Screen name="BalanceBreakdownScreen" component={BalanceBreakdownScreen} />
    <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
  </Stack.Navigator>
);

/*──────────────────────────────────────────────────────────────
  Root Navigation
  Decides which stack to show based on auth + profile state
──────────────────────────────────────────────────────────────*/
const RootNavigation = () => {
  const { user, userProfile, loading, profileLoading, profileResolved } =
    useAuth();

  // Don't render anything while auth state is loading
  // Prevents flashing the wrong screen
  if (loading) return null;

  // Not logged in → show auth screens
  if (!user) return <AuthStack />;

  // Logged in but profile still not resolved on first pass → wait
  if (!profileResolved || (!userProfile && profileLoading)) return null;

  // Logged in but profile not completed → show profile setup
  if (!userProfile?.profileCompleted) return <ProfileSetupStack />;

  // Fully authenticated → show main app
  return <MainStack />;
};

/*──────────────────────────────────────────────────────────────
  Styles
──────────────────────────────────────────────────────────────*/
const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    height: 72,
    borderTopWidth: 0,
    borderRadius: 22,
    backgroundColor: "rgba(23, 33, 53, 0.96)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
  },
  label: {
    fontSize: 11,
    marginBottom: 8,
    fontWeight: "600",
  },
});

export default RootNavigation;
