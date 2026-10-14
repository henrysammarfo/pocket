import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/app/swap")({ component: SwapPage });

function SwapPage() {
  const [from, setFrom] = useState("500.10");
  const [to, setTo] = useState("300.56");

  return (
    <div className="bb-money">
      <div className="bb-swap-card">
        <label>
          <span>From</span>
          <div className="bb-swap-row">
            <input value={from} onChange={(e) => setFrom(e.target.value)} inputMode="decimal" aria-label="From amount" />
            <span className="bb-chip-btn">SOL</span>
          </div>
        </label>
        <div className="bb-swap-mid" aria-hidden>
          <img src="/brand/icon-swap.svg" alt="" width={22} height={22} />
        </div>
        <label>
          <span>To</span>
          <div className="bb-swap-row">
            <input value={to} onChange={(e) => setTo(e.target.value)} inputMode="decimal" aria-label="To amount" />
            <span className="bb-chip-btn">USDC</span>
          </div>
        </label>
      </div>

      <div className="bb-swap-meta">
        <div>
          <span>Fee</span>
          <strong>$1.00</strong>
        </div>
        <div>
          <span>Rate</span>
          <strong>1 SOL = $200.00</strong>
        </div>
        <div>
          <span>Arrives</span>
          <strong>Instantly</strong>
        </div>
      </div>

      <p className="bb-plan-note">Swaps stay inside your approved plan. Anything that breaks Keep is blocked.</p>
      <button type="button" className="pk-btn-primary">
        Swap
      </button>
    </div>
  );
}
