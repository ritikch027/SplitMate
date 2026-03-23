import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AlertProvider from "../src/context/AlertProvider";
import AuthProvider from "../src/context/AuthProvider";
import RootNavigation from "../src/navigation/index";

export default function App() {
  return (
    <SafeAreaProvider>
      <AlertProvider>
        <AuthProvider>
          <RootNavigation />
        </AuthProvider>
      </AlertProvider>
    </SafeAreaProvider>
  );
}
