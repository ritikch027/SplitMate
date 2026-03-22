import React from "react";
import AuthProvider from "../src/context/AuthProvider";
import RootNavigation from "../src/navigation/index";

export default function App() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}