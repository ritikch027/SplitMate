import React, { useCallback, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppAlertHost from "../components/AppAlertHost";
import { AlertContext } from "./AlertContext";

export default function AlertProvider({ children }) {
  const insets = useSafeAreaInsets();
  const timeoutRef = useRef(null);
  const [alertState, setAlertState] = useState({
    visible: false,
    title: "",
    message: "",
    variant: "info",
  });

  const hideAlert = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setAlertState((current) => ({ ...current, visible: false }));
  }, []);

  const showAlert = useCallback(
    ({
      title,
      message = "",
      variant = "info",
      duration = 3000,
    }) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setAlertState({
        visible: true,
        title,
        message,
        variant,
      });

      if (duration > 0) {
        timeoutRef.current = setTimeout(() => {
          hideAlert();
        }, duration);
      }
    },
    [hideAlert],
  );

  const value = useMemo(
    () => ({
      showAlert,
      hideAlert,
    }),
    [hideAlert, showAlert],
  );

  return (
    <AlertContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 10, left: 0, right: 0 }}>
          <AppAlertHost {...alertState} onClose={hideAlert} />
        </View>
      </View>
    </AlertContext.Provider>
  );
}
