import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BlockScreen } from "@/components/pocket-ui/BlockScreen";
import { authHeader } from "@/hooks/useAuth";
import { readLastPlanId } from "@/lib/pocket/plan-session";

export const Route = createFileRoute("/app/send")({ component: SendPage });

const ASSETS = [
  { id: "usdc", name: "USD Coin", sym: "USDC" },
  { id: "sol", name: "Solana", sym: "SOL" },
  { id: "eth", name: "Ethereum", sym: "ETH" },
  { id: "btc", name: "Bitcoin", sym: "BTC" },
  { id: "xrp", name: "XRP", sym: "XRP" },
];

function SendPage() {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("0");
  const [asset, setAsset] = useState(ASSETS[0]!);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [block, setBlock] = useState<{ message: string; bufferCents: number; planCatch?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = ASSETS.filter(
    (a) => a.name.toLowerCase().includes(query.toLowerCase()) || a.sym.toLowerCase().includes(query.toLowerCase()),
  );

  const continueSend = async () => {
    setBusy(true);
    setErr(null);
    try {
      const text = `Send the rest to ${to || "recipient"}`;
      const planId = typeof window !== "undefined" ? readLastPlanId() : null;
      const res = await fetch("/api/settle", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ text, source: "typed", planId: planId || undefined }),
      });
      const body = (await res.json()) as {
        blocked?: boolean;
        screen?: { message: string; bufferCents: number; planCatch?: string };
        error?: string;
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bb-money">
      {block && (
        <BlockScreen
          message={block.message}
          bufferCents={block.bufferCents}
          {...(block.planCatch ? { planCatch: block.planCatch } : {})}
          onDismiss={() => setBlock(null)}
        />
      )}

      <label className="bb-field">
        <span className="bb-field-prefix">To</span>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient address" />
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
          <button type="button" className="bb-amount-asset" onClick={() => setPicker(true)}>
            {asset.sym}
          </button>
        </div>
        <p className="bb-plan-note">POCKET will check this against your approved plan before anything moves.</p>
      </div>

      <div className="bb-asset-row">
        <div>
          <strong>{asset.name}</strong>
          <span>Checked against Keep buffer</span>
        </div>
        <button type="button" className="bb-chip-btn" onClick={() => setPicker(true)}>
          Change
        </button>
      </div>

      {err && (
        <p className="pk-error" role="alert">
          {err}
        </p>
      )}

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
            {k}
          </button>
        ))}
      </div>

      <button type="button" className="pk-btn-primary" disabled={busy} onClick={() => void continueSend()}>
        Continue
      </button>

      {picker && (
        <div className="bb-sheet-scrim" role="dialog" aria-modal="true" aria-label="Select crypto asset">
          <div className="bb-sheet">
            <h2>Select crypto asset</h2>
            <div className="bb-sheet-search">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                autoFocus
              />
            </div>
            <div className="bb-asset-list">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`bb-asset-item ${asset.id === a.id ? "is-active" : ""}`}
                  onClick={() => {
                    setAsset(a);
                    setPicker(false);
                    setQuery("");
                  }}
                >
                  <span className="bb-asset-ico">{a.sym.slice(0, 2)}</span>
                  <div>
                    <strong>{a.name}</strong>
                    <span>{a.sym}</span>
                  </div>
                </button>
              ))}
            </div>
            <button type="button" className="bb-btn-ghost" style={{ marginTop: 12 }} onClick={() => setPicker(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
