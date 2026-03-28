import React, { useEffect } from "react";
import {
  NavigationContainer,
  NavigationIndependentTree,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AlertProvider from "../src/context/AlertProvider";
import AuthProvider from "../src/context/AuthProvider";
import RootNavigation from "../src/navigation/index";
import { navigationRef } from "../src/navigation/navigationRef";
import { setupPushNotificationNavigation } from "../src/services/pushNotificationService";

export default function App() {
  useEffect(() => {
    const cleanup = setupPushNotificationNavigation();
    return cleanup;
  }, []);

  return (
    <SafeAreaProvider>
      <AlertProvider>
        <NavigationIndependentTree>
          <NavigationContainer ref={navigationRef}>
            <AuthProvider>
              <RootNavigation />
            </AuthProvider>
          </NavigationContainer>
        </NavigationIndependentTree>
      </AlertProvider>
    </SafeAreaProvider>
  );
}
