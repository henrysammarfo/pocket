import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { LiveQr } from "@/components/pocket-ui/LiveQr";

export const Route = createFileRoute("/app/receive")({ component: ReceivePage });

function ReceivePage() {
  const { data, isLoading, error } = useWallet();
  const [copied, setCopied] = useState(false);
  const address = data?.address ?? null;
  const short = data?.shortAddress ?? (isLoading ? "…" : "Sign in");

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const share = async () => {
    if (!address) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "POCKET wallet", text: address });
        return;
      } catch {
        /* fall through */
      }
    }
    await copy();
  };

  return (
    <div className="bb-money bb-receive">
      <p className="bb-receive-lead">Share your qr code or wallet address with the sender</p>

      <button type="button" className="bb-addr-chip" onClick={() => void copy()} disabled={!address}>
        <span>{short}</span>
        <img src="/brand/ui/copy.svg" alt="" width={14} height={14} />
      </button>

      {address ? (
        <LiveQr value={address} size={245} />
      ) : (
        <div className="bb-qr-frame">
          <img src="/brand/ui/qr-demo.png" alt="Receive QR" width={245} height={245} />
        </div>
      )}

      {error && (
        <p className="pk-error" role="alert">
          {error.message}
        </p>
      )}
      {copied && <p className="bb-hint">Address copied</p>}

      <div className="bb-receive-foot">
        <button type="button" className="pk-btn-primary" disabled={!address} onClick={() => void share()}>
          {copied ? "Copied" : "Share"}
        </button>
      </div>
    </div>
  );
}
