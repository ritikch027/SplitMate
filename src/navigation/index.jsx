import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet } from "react-native";

import { useAuth } from "../context/useAuth";

import { Ionicons } from "@expo/vector-icons";

/* Screens */
import ActivityScreen from "../screens/ActivityScreen";
import AddExpenseScreen from "../screens/AddExpenseScreen";
import CompleteProfileScreen from "../screens/CompleteProfileScreen";
import CreateGroupScreen from "../screens/CreateGroupScreen.jsx";
import GroupDetailsScreen from "../screens/GroupDetailsScreen";
import HomeScreen from "../screens/HomeScreen";
import LoginScreen from "../screens/LoginScreen";
import OTPScreen from "../screens/OTPScreen";
import ProfileScreen from "../screens/ProfileScreen";

/*
|--------------------------------------------------------------------------
| Navigators
|--------------------------------------------------------------------------
*/

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/*
|--------------------------------------------------------------------------
| Auth Stack
|--------------------------------------------------------------------------
| Shown when user is NOT authenticated
| Includes login + OTP verification
| Fade transition for smoother onboarding
*/

const AuthStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    >
      <Stack.Screen
        name="LoginScreen"
        component={LoginScreen}
      />
      <Stack.Screen name="OTPScreen" component={OTPScreen} />
    </Stack.Navigator>
  );
};

/*
|--------------------------------------------------------------------------
| Bottom Tabs
|--------------------------------------------------------------------------
| Main app navigation
| Glassmorphism style tab bar
*/

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        /* Tab bar style */
        tabBarStyle: styles.tabBar,

        tabBarActiveTintColor: "#7C3AED",
        tabBarInactiveTintColor: "#6B7280",

        tabBarLabelStyle: styles.label,

        /*
        |--------------------------------------------------------------------------
        | Icons for each tab
        |--------------------------------------------------------------------------
        */

        tabBarIcon: ({ color, focused }) => {
          let iconName;

          if (route.name === "Home") iconName = "home";
          if (route.name === "Activity") iconName = "time";
          if (route.name === "Profile") iconName = "person";

          return (
            <Ionicons
              name={iconName}
              size={focused ? 26 : 22} // slight scale when active
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />

      <Tab.Screen name="Activity" component={ActivityScreen} />

      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

/*
|--------------------------------------------------------------------------
| Main Stack
|--------------------------------------------------------------------------
| Contains tab navigator + deeper screens
| GroupDetails & AddExpense are pushed on top
*/

const MainStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />

      {/* Screens pushed on top of tabs */}
      <Stack.Screen name="GroupDetailsScreen" component={GroupDetailsScreen} />

      <Stack.Screen name="CreateGroupScreen" component={CreateGroupScreen} />

      <Stack.Screen name="AddExpenseScreen" component={AddExpenseScreen} />
    </Stack.Navigator>
  );
};

const ProfileSetupStack = () => {
  return (
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
};

/*
|--------------------------------------------------------------------------
| Root Navigation
|--------------------------------------------------------------------------
| Chooses which stack to show based on auth state
*/

const RootNavigation = () => {
  const { user, userProfile } = useAuth();

  if (!user) return <AuthStack />;

  return userProfile?.profileCompleted ? <MainStack /> : <ProfileSetupStack />;
};

/*
|--------------------------------------------------------------------------
| Styles
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Export Navigation Container
|--------------------------------------------------------------------------
*/

export default RootNavigation;
