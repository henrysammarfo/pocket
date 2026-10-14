import { createFileRoute, Link } from "@tanstack/react-router";
import { readLastPlanId } from "@/lib/pocket/plan-session";

export const Route = createFileRoute("/app/wallet")({ component: WalletPage });

const COINS = [
  { sym: "BNB", name: "Binance", bal: "$5,906.86", chg: "+3.56%" },
  { sym: "USDT", name: "Tether", bal: "$1,240.00", chg: "+0.12%" },
  { sym: "DAI", name: "Dai", bal: "$853.14", chg: "+0.04%" },
];

function WalletPage() {
  const hasPlan = Boolean(typeof window !== "undefined" && readLastPlanId());

  return (
    <div className="bb-money">
      <section className="bb-wallet-hero">
        <span className="bb-bal-label">Total balance</span>
        <strong className="bb-bal">$8,000.00</strong>
        <span>{hasPlan ? "Plan linked · Keep buffer live" : "Approve a plan to unlock spend rules"}</span>
      </section>

      <div className="bb-wallet-actions">
        <Link to="/app/receive">
          <img src="/brand/icon-receive.svg" alt="" width={22} height={22} />
          Receive
        </Link>
        <Link to="/app/send">
          <img src="/brand/icon-send.svg" alt="" width={22} height={22} />
          Send
        </Link>
        <Link to="/app/swap">
          <img src="/brand/icon-swap.svg" alt="" width={22} height={22} />
          Swap
        </Link>
      </div>

      {!hasPlan && (
        <section className="bb-settings-card">
          <strong>Pending approvals</strong>
          <span>Approve your pending plan before large spends unlock.</span>
          <Link to="/app" className="bb-text-link">
            Open chat
          </Link>
        </section>
      )}

      <section className="bb-coin-list" aria-label="Top coin">
        <div className="bb-coin-head">
          <span>Top coin</span>
          <a href="#history">See all</a>
        </div>
        {COINS.map((c) => (
          <div key={c.sym} className="bb-coin-row">
            <span className="bb-asset-ico">{c.sym.slice(0, 2)}</span>
            <div>
              <strong>{c.name}</strong>
              <span>{c.sym}</span>
            </div>
            <div>
              <b>{c.bal}</b>
              <small>{c.chg}</small>
            </div>
          </div>
        ))}
      </section>

      <section className="bb-tx-list" id="history" aria-label="Transaction history">
        <div className="bb-coin-head">
          <span>Transaction history</span>
          <span style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 500 }}>See all</span>
        </div>
        <div className="bb-tx-row">
          <span className="bb-tx-ico">WB</span>
          <div>
            <strong>Monthly rent</strong>
            <span>Sent to wema bank · Today</span>
          </div>
          <b style={{ color: "var(--pk-danger)" }}>-$300.00</b>
        </div>
      </section>
    </div>
  );
}
