import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { usePrivyLink } from "@/hooks/usePrivyLink";
import { PrivyLoginButton } from "@/components/privy/PrivyLoginButton";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Continue — Pocket" },
      { name: "description", content: "Save your plan and return to it on this device." },
      { property: "og:title", content: "Continue to use Pocket" },
      { property: "og:description", content: "Save your plan and return to it on this device." },
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
    <main className="auth-beebah">
      <header className="auth-beebah-top">
        <Link to="/" className="auth-back" aria-label="Back to home">
          <ArrowLeft size={20} />
        </Link>
        <BrandLogo compact />
      </header>
      <div className="auth-beebah-body">
        <h1>Continue to use Pocket</h1>
        <p className="auth-beebah-sub">Save your plan and return to it on this device</p>
        {privyEnabled ? (
          <div className="auth-beebah-cta">
            <PrivyLoginButton onError={setMsg} />
          </div>
        ) : (
          <button
            type="button"
            className="pk-btn-primary auth-beebah-continue"
            disabled
            onClick={() => setMsg("Set VITE_PRIVY_APP_ID + PRIVY_APP_SECRET for login.")}
          >
            Continue
          </button>
        )}
        {msg && (
          <p className="auth-msg" role="status">
            {msg}
          </p>
        )}
        <p className="auth-beebah-note">Email or Google via Privy. Wallets stay under the hood.</p>
      </div>
    </main>
  );
}
