import { createContext } from "react";
export const AuthContext = createContext({
  user: null,
  userProfile: null,
  loading: true,
  profileLoading: false,
  refreshUserProfile: async () => {},
});
