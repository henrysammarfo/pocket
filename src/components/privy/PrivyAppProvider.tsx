import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { monadTestnet } from "@/lib/monad/config";
import { PrivySessionBridge } from "./PrivySessionBridge";
import { EnsureEmbeddedWallet } from "./EnsureEmbeddedWallet";
import { PrivySessionContext } from "./PrivySessionContext";

const appId = import.meta.env["VITE_PRIVY_APP_ID"] as string | undefined;

const emptySession = {
  ready: true,
  authenticated: false,
  userId: null,
  email: null,
  accessToken: null,
  logout: async () => undefined,
  getAccessToken: async () => null,
};

export function PrivyAppProvider({ children }: { children: ReactNode }) {
  if (!appId) {
    return <PrivySessionContext.Provider value={emptySession}>{children}</PrivySessionContext.Provider>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google", "apple"],
        appearance: {
          theme: "light",
          accentColor: "#111111",
          logo: "/favicon.svg",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
      }}
    >
      <EnsureEmbeddedWallet />
      <PrivySessionBridge>{children}</PrivySessionBridge>
    </PrivyProvider>
  );
}
