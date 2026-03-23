import { createContext } from "react";

export const AlertContext = createContext({
  showAlert: () => {},
  hideAlert: () => {},
});
