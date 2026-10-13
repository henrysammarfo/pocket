import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { usePrivyLink } from "@/hooks/usePrivyLink";
import { PrivyLoginButton } from "@/components/privy/PrivyLoginButton";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — POCKET" },
      { name: "description", content: "Sign in to talk to POCKET and build money plans." },
      { property: "og:title", content: "Sign in to POCKET" },
      { property: "og:description", content: "Your personal money assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session } = useAuth();
  const { privyEnabled, authenticated: privyAuthed, link } = usePrivyLink();
  const navigate = useNavigate();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (session || (privyAuthed && link?.userId)) navigate({ to: "/app" });
  }, [session, privyAuthed, link?.userId, navigate]);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <BrandLogo compact />
        <h1>Welcome back.</h1>
        <p>Tell POCKET a goal. Get a plan that can't overspend.</p>
        {privyEnabled ? (
          <PrivyLoginButton onError={setMsg} />
        ) : (
          <button
            type="button"
            className="auth-privy"
            disabled
            onClick={() => setMsg("Set VITE_PRIVY_APP_ID + PRIVY_APP_SECRET for login.")}
          >
            Continue — invisible wallet
          </button>
        )}
        {msg && (
          <p className="auth-msg" role="status">
            {msg}
          </p>
        )}
        <p className="auth-switch">Sign in with email or Google via Privy. No crypto UI — wallets stay under the hood.</p>
      </div>
    </main>
  );
}
