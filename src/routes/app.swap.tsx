import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BlockScreen } from "@/components/pocket-ui/BlockScreen";
import { authHeader } from "@/hooks/useAuth";
import { readLastPlanId } from "@/lib/pocket/plan-session";
import { useWallet } from "@/hooks/useWallet";

export const Route = createFileRoute("/app/swap")({ component: SwapPage });

const RATE_USD: Record<string, number> = { SOL: 200, BTC: 47400, AUSD: 1, USDC: 1 };

function SwapPage() {
  const wallet = useWallet();
  const [fromAmt, setFromAmt] = useState("300.56");
  const [toAmt, setToAmt] = useState("10.56");
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [block, setBlock] = useState<{ message: string; bufferCents: number; planCatch?: string } | null>(null);

  const from = flipped
    ? { name: "Bitcoin", sym: "BTC", bal: "15.40 BTC", icon: "/brand/coins/btc.svg", amt: toAmt, set: setToAmt }
    : { name: "Solana", sym: "SOL", bal: "500.10 SOL", icon: "/brand/coins/sol-swap.svg", amt: fromAmt, set: setFromAmt };
  const to = flipped
    ? { name: "Solana", sym: "SOL", bal: "500.10 SOL", icon: "/brand/coins/sol-swap.svg", amt: fromAmt, set: setFromAmt }
    : { name: "Bitcoin", sym: "BTC", bal: "15.40 BTC", icon: "/brand/coins/btc.svg", amt: toAmt, set: setToAmt };

  const fromUsd = useMemo(() => {
    const n = Number(from.amt) || 0;
    return (n * (RATE_USD[from.sym] ?? 0)).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [from.amt, from.sym]);
  const toUsd = useMemo(() => {
    const n = Number(to.amt) || 0;
    return (n * (RATE_USD[to.sym] ?? 0)).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [to.amt, to.sym]);

  const runSwap = async () => {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const text = `Swap ${from.amt} ${from.sym} to ${to.sym}`;
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
      if (!res.ok) setErr(body.error ?? "Swap blocked by policy or network");
      else setOk("Swap path checked against your plan");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bb-money bb-swap">
      {block && (
        <BlockScreen
          message={block.message}
          bufferCents={block.bufferCents}
          {...(block.planCatch ? { planCatch: block.planCatch } : {})}
          onDismiss={() => setBlock(null)}
        />
      )}

      <div className="bb-swap-stack">
        <div className="bb-swap-pane">
          <div className="bb-swap-token">
            <img src={from.icon} alt="" width={34} height={34} />
            <div>
              <strong>{from.name}</strong>
              <span>{from.bal}</span>
            </div>
          </div>
          <input
            className="bb-swap-amt"
            value={from.amt}
            onChange={(e) => from.set(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            aria-label="From amount"
          />
          <p className="bb-swap-usd">=${fromUsd}</p>
        </div>

        <button type="button" className="bb-swap-flip" aria-label="Flip assets" onClick={() => setFlipped((f) => !f)}>
          <img src="/brand/ui/exchange-white.svg" alt="" width={24} height={24} />
        </button>

        <div className="bb-swap-pane">
          <div className="bb-swap-token">
            <img src={to.icon} alt="" width={34} height={34} />
            <div>
              <strong>{to.name}</strong>
              <span>{to.bal}</span>
            </div>
          </div>
          <input
            className="bb-swap-amt"
            value={to.amt}
            onChange={(e) => to.set(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            aria-label="To amount"
          />
          <p className="bb-swap-usd">=${toUsd}</p>
        </div>
      </div>

      <div className="bb-swap-meta">
        <div>
          <span>Fee</span>
          <strong>$1.00</strong>
        </div>
        <div>
          <span>Rate</span>
          <strong>
            1 {from.sym} = ${(RATE_USD[from.sym] ?? 0).toFixed(2)}
          </strong>
        </div>
        <div>
          <span>Arrives</span>
          <strong>Instantly</strong>
        </div>
      </div>

      <p className="bb-plan-note">
        Swaps stay inside your approved plan
        {wallet.data?.plan ? ` · Keep $${(wallet.data.plan.reserveFloorCents / 100).toFixed(0)}` : ""}. Anything that
        breaks Keep is blocked.
      </p>
      {err && (
        <p className="pk-error" role="alert">
          {err}
        </p>
      )}
      {ok && <p className="bb-hint">{ok}</p>}
      <button type="button" className="pk-btn-primary" disabled={busy} onClick={() => void runSwap()}>
        {busy ? "Checking plan…" : "Swap"}
      </button>
    </div>
  );
}
