import { createContext, useContext } from "react";

export type PrivySessionValue = {
  ready: boolean;
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  accessToken: string | null;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

const defaultValue: PrivySessionValue = {
  ready: true,
  authenticated: false,
  userId: null,
  email: null,
  accessToken: null,
  logout: async () => undefined,
  getAccessToken: async () => null,
};

export const PrivySessionContext = createContext<PrivySessionValue>(defaultValue);

export function usePrivySession() {
  return useContext(PrivySessionContext);
}
