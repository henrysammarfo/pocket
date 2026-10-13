import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { usePrivyLink } from "@/hooks/usePrivyLink";
import { PrivyLoginButton } from "@/components/privy/PrivyLoginButton";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in — POCKET" },
    { name: "description", content: "Sign in to talk to POCKET and build money plans." },
    { property: "og:title", content: "Sign in to POCKET" },
    { property: "og:description", content: "Your personal money assistant." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const { session } = useAuth();
  const { privyEnabled, authenticated: privyAuthed, link } = usePrivyLink();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (session || (privyAuthed && link?.userId)) navigate({ to: "/app" });
  }, [session, privyAuthed, link?.userId, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const { data, error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/app` } });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (mode === "up" && !data.session) setMsg("Check your email to confirm your account.");
  };
  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) setMsg(r.error.message ?? "Google sign-in failed");
  };

  return <main className="auth-page">
    <div className="auth-card">
      <BrandLogo compact />
      <h1>{mode === "in" ? "Welcome back." : "Meet your money assistant."}</h1>
      <p>Tell POCKET a goal. Get a plan that can't overspend.</p>
      {privyEnabled
        ? <PrivyLoginButton onError={setMsg} />
        : <button type="button" className="auth-privy" disabled onClick={() => setMsg("Set VITE_PRIVY_APP_ID + PRIVY_APP_SECRET for invisible wallet login.")}>Continue — invisible wallet</button>}
      <button type="button" className="auth-google" onClick={google}>Continue with Google</button>
      <div className="auth-or"><span>or</span></div>
      <form onSubmit={submit}>
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="auth-submit" disabled={busy}>{busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}</button>
      </form>
      {msg && <p className="auth-msg" role="status">{msg}</p>}
      <button type="button" className="auth-switch" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
        {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </div>
  </main>;
}
