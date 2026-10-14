import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BlockScreen } from "@/components/pocket-ui/BlockScreen";
import { authHeader } from "@/hooks/useAuth";
import { readLastPlanId } from "@/lib/pocket/plan-session";
import { useWallet } from "@/hooks/useWallet";

export const Route = createFileRoute("/app/send")({ component: SendPage });

const ASSETS = [
  { id: "ausd", name: "AUSD", sym: "AUSD", icon: "/brand/coins/ausd.svg", live: true },
  { id: "sol", name: "Solana", sym: "SOL", icon: "/brand/coins/sol.svg", live: false },
  { id: "xrp", name: "XRP", sym: "XRP", icon: "/brand/coins/xrp-mark.png", live: false },
  { id: "btc", name: "Bitcoin", sym: "BTC", icon: "/brand/coins/btc.svg", live: false },
  { id: "eth", name: "Ethereum", sym: "ETH", icon: "/brand/coins/eth.svg", live: false },
  { id: "usdc", name: "USD COIN", sym: "USDC", icon: "/brand/coins/usdc.svg", live: false },
];

type Step = "asset" | "amount";

function SendPage() {
  const wallet = useWallet();
  const [step, setStep] = useState<Step>("asset");
  const [query, setQuery] = useState("");
  const [asset, setAsset] = useState(ASSETS[0]!);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("0");
  const [err, setErr] = useState<string | null>(null);
  const [block, setBlock] = useState<{ message: string; bufferCents: number; planCatch?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      ASSETS.filter(
        (a) =>
          a.name.toLowerCase().includes(query.toLowerCase()) ||
          a.sym.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  const continueSend = async () => {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const dollars = Number(amount) || 0;
      const text =
        dollars > 0
          ? `Send $${dollars.toFixed(2)} ${asset.sym} to ${to || "recipient"}`
          : `Send the rest to ${to || "recipient"}`;
      const planId = typeof window !== "undefined" ? readLastPlanId() : null;
      const res = await fetch("/api/settle", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({
          text,
          source: "typed",
          planId: planId || wallet.data?.plan?.id || undefined,
          walletAddress: wallet.data?.address || undefined,
          walletId: wallet.data?.walletId || undefined,
        }),
      });
      const body = (await res.json()) as {
        blocked?: boolean;
        screen?: { message: string; bufferCents: number; planCatch?: string };
        error?: string;
        settlement?: { explorerUrl?: string };
      };
      if (body.blocked && body.screen) {
        setBlock({
          message: body.screen.message,
          bufferCents: body.screen.bufferCents,
          ...(body.screen.planCatch ? { planCatch: body.screen.planCatch } : {}),
        });
        return;
      }
      if (!res.ok) setErr(body.error ?? "Could not send");
      else if (body.settlement) {
        setOk(body.settlement.explorerUrl ? "Sent — receipt on chain" : "Sent");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  if (step === "asset") {
    return (
      <div className="bb-money bb-send-assets">
        <h2 className="bb-money-h">Select crypto asset</h2>
        <label className="bb-search">
          <img src="/brand/ui/search.svg" alt="" width={20} height={20} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            autoFocus
          />
        </label>
        <div className="bb-asset-stack">
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`bb-asset-tile ${asset.id === a.id ? "is-active" : ""}`}
              onClick={() => {
                setAsset(a);
                setStep("amount");
              }}
            >
              <img className="bb-coin-icon" src={a.icon} alt="" width={40} height={40} />
              <span>
                {a.name}
                {a.live && wallet.data ? (
                  <small className="bb-asset-bal">${wallet.data.balanceUsd} available</small>
                ) : null}
              </span>
              <img className="bb-asset-chevron" src="/brand/ui/arrow-right.svg" alt="" width={24} height={24} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bb-money bb-send-amount">
      {block && (
        <BlockScreen
          message={block.message}
          bufferCents={block.bufferCents}
          {...(block.planCatch ? { planCatch: block.planCatch } : {})}
          onDismiss={() => setBlock(null)}
        />
      )}

      <button type="button" className="bb-text-link" onClick={() => setStep("asset")}>
        ← {asset.name}
      </button>

      <label className="bb-field">
        <span className="bb-field-prefix">To</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Recipient address"
          autoComplete="off"
        />
      </label>

      <div className="bb-amount-card">
        <div className="bb-amount-row">
          <input
            className="bb-amount-input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            aria-label="Amount"
          />
          <button type="button" className="bb-amount-asset" onClick={() => setStep("asset")}>
            <img src={asset.icon} alt="" width={18} height={18} />
            {asset.sym}
          </button>
        </div>
        <p className="bb-plan-note">
          Available {wallet.data ? `$${wallet.data.balanceUsd} AUSD` : "…"}. POCKET checks your approved plan before
          anything moves.
        </p>
      </div>

      <div className="bb-asset-row">
        <div className="bb-asset-row-left">
          <img className="bb-coin-icon" src={asset.icon} alt="" width={32} height={32} />
          <div>
            <strong>{asset.name}</strong>
            <span>Checked against Keep buffer</span>
          </div>
        </div>
        <button type="button" className="bb-chip-btn" onClick={() => setStep("asset")}>
          Change
        </button>
      </div>

      {err && (
        <p className="pk-error" role="alert">
          {err}
        </p>
      )}
      {ok && <p className="bb-hint">{ok}</p>}

      <div className="bb-money-pad" aria-label="Keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
          <button
            key={k}
            type="button"
            className="bb-key"
            onClick={() => {
              if (k === "⌫") setAmount((a) => a.slice(0, -1) || "0");
              else if (k === "." && amount.includes(".")) return;
              else setAmount((a) => (a === "0" && k !== "." ? k : `${a}${k}`));
            }}
          >
            {k === "⌫" ? "⌫" : k}
          </button>
        ))}
      </div>

      <button type="button" className="pk-btn-primary" disabled={busy} onClick={() => void continueSend()}>
        {busy ? "Checking plan…" : "Continue"}
      </button>
    </div>
  );
}
