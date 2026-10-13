import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { monadTestnet } from "@/lib/monad/config";
import { PrivySessionBridge } from "./PrivySessionBridge";

const appId = import.meta.env["VITE_PRIVY_APP_ID"] as string | undefined;

export function PrivyAppProvider({ children }: { children: ReactNode }) {
  if (!appId) {
    // Provider absent until key is wired — children still render (Supabase auth path).
    return <>{children}</>;
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
      <PrivySessionBridge />
      {children}
    </PrivyProvider>
  );
}
