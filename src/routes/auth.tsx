import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

type Step = "email" | "verify" | "password" | "success" | "create";

function AuthPage() {
  const { session } = useAuth();
  const { privyEnabled, authenticated: privyAuthed, link } = usePrivyLink();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (session || (privyAuthed && link?.userId)) navigate({ to: "/app" });
  }, [session, privyAuthed, link?.userId, navigate]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const codeValue = code.join("");

  const onOtp = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = digit;
    setCode(next);
    setCodeError(false);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const title =
    step === "email" || step === "create"
      ? step === "create"
        ? "Create your POCKET account"
        : "Continue to use Pocket"
      : step === "verify"
        ? "Check your email"
        : step === "password"
          ? "Create a password"
          : "You're in";

  const sub =
    step === "email"
      ? "Save your plan and return to it on this device"
      : step === "create"
        ? "Your plan is ready. Create an account to save it and start using POCKET."
        : step === "verify"
          ? `Enter the 6 digit code that was sent to ${email || "your email"}`
          : step === "password"
            ? "Create a strong password for your pocket to keep it secured"
            : "Your pocket account has been successfully created";

  return (
    <main className="bb-auth">
      <header className="bb-auth-top">
        <Link to="/" className="auth-back" aria-label="Back to home">
          <ArrowLeft size={20} />
        </Link>
        <BrandLogo compact />
      </header>

      <div className="bb-auth-body">
        {step === "success" ? (
          <div className="bb-auth-success">
            <BrandLogo />
            <h1>Done</h1>
            <p className="bb-auth-sub">{sub}</p>
            <button type="button" className="pk-btn-primary" onClick={() => navigate({ to: "/app" })}>
              Open Pocket
            </button>
          </div>
        ) : (
          <>
            <h1>{title}</h1>
            <p className="bb-auth-sub">{sub}</p>

            {step === "email" && (
              <>
                <p className="bb-auth-label">Email</p>
                <input
                  className="bb-auth-input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="bb-auth-foot">
                  {privyEnabled ? (
                    <PrivyLoginButton onError={setMsg} />
                  ) : (
                    <button
                      type="button"
                      className="pk-btn-primary"
                      disabled={!emailOk}
                      onClick={() => {
                        if (!emailOk) {
                          setMsg("Enter a valid email.");
                          return;
                        }
                        setStep("verify");
                      }}
                    >
                      Continue
                    </button>
                  )}
                  <button type="button" className="bb-auth-resend" onClick={() => setStep("create")}>
                    Create account instead
                  </button>
                </div>
              </>
            )}

            {step === "create" && (
              <>
                <div className="bb-auth-social">
                  {privyEnabled ? (
                    <PrivyLoginButton onError={setMsg} label="Continue with email" />
                  ) : (
                    <button type="button" className="pk-btn-primary" onClick={() => setStep("email")}>
                      Continue with email
                    </button>
                  )}
                </div>
                <div className="bb-auth-or">OR</div>
                <div className="bb-auth-social">
                  {privyEnabled ? (
                    <>
                      <PrivyLoginButton onError={setMsg} label="Continue with apple" className="bb-auth-social-btn" />
                      <PrivyLoginButton onError={setMsg} label="Continue with google" className="bb-auth-social-btn" />
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setMsg("Set Privy keys to continue with Apple.")}>
                        Continue with apple
                      </button>
                      <button type="button" onClick={() => setMsg("Set Privy keys to continue with Google.")}>
                        Continue with google
                      </button>
                    </>
                  )}
                </div>
                <div className="bb-auth-foot">
                  <button type="button" className="bb-auth-resend" onClick={() => setStep("email")}>
                    Already have an account? Sign in
                  </button>
                </div>
              </>
            )}

            {step === "verify" && (
              <>
                <p className="bb-auth-label">Verification code</p>
                <div className="bb-otp" aria-label="Verification code">
                  {code.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      className={codeError ? "is-error" : undefined}
                      onChange={(e) => onOtp(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !code[i] && i > 0) otpRefs.current[i - 1]?.focus();
                      }}
                      aria-label={`Digit ${i + 1}`}
                    />
                  ))}
                </div>
                {codeError && <p className="bb-auth-error">That code doesn&apos;t look right, check again</p>}
                <div className="bb-auth-foot">
                  <button
                    type="button"
                    className="pk-btn-primary"
                    disabled={codeValue.length < 6}
                    onClick={() => {
                      if (codeValue.length < 6) return;
                      // Demo UI path when Privy modal is not used for OTP entry
                      if (codeValue === "000000") {
                        setCodeError(true);
                        return;
                      }
                      setStep("password");
                    }}
                  >
                    Verify
                  </button>
                  <button type="button" className="bb-auth-resend" onClick={() => setMsg("Code resent.")}>
                    Resend code
                  </button>
                </div>
              </>
            )}

            {step === "password" && (
              <>
                <p className="bb-auth-label">Password</p>
                <input
                  className="bb-auth-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                />
                <div className="bb-auth-foot">
                  <button
                    type="button"
                    className="pk-btn-primary"
                    disabled={password.length < 8}
                    onClick={() => setStep("success")}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {msg && (
          <p className="auth-msg" role="status">
            {msg}
          </p>
        )}
      </div>
    </main>
  );
}
