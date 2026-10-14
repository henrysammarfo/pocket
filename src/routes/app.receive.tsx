import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export const Route = createFileRoute("/app/receive")({ component: ReceivePage });

function ReceivePage() {
  const { session } = useAuth();
  const address = session?.user.email ? "xg56…78c · Privy embedded" : "Sign in to receive";
  const [copied, setCopied] = useState(false);

  return (
    <div className="bb-money bb-receive">
      <div className="bb-qr-card">
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Receive money</h2>
        <p className="bb-hint">Share your QR code or wallet address with the sender</p>
        <div className="bb-qr-placeholder" aria-hidden>
          <img src="/brand/logo.svg" alt="" width={88} height={78} />
        </div>
        <code>{address}</code>
        <div className="bb-inline-actions" style={{ width: "100%" }}>
          <button
            type="button"
            className="pk-btn-primary"
            onClick={() => {
              void navigator.clipboard.writeText(address).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              });
            }}
          >
            {copied ? "Copied" : "Share"}
          </button>
          <button
            type="button"
            className="bb-btn-ghost"
            onClick={() => {
              void navigator.clipboard.writeText(address).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              });
            }}
          >
            Copy details
          </button>
        </div>
      </div>
      <p className="bb-hint">Approve your pending plan before large receives unlock spending rules.</p>
    </div>
  );
}
