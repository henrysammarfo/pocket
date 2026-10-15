import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useQuery } from "@tanstack/react-query";
import { authHeader } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/wallet")({ component: WalletPage });

const COINS = [
  { id: "ausd", name: "AUSD", sym: "AUSD", icon: "/brand/coins/ausd.svg", chg: 0, live: true },
  { id: "bnb", name: "Binance", sym: "BNB", icon: "/brand/coins/bnb.png", chg: 3.56, live: false },
  { id: "usdt", name: "USDT", sym: "USDT", icon: "/brand/coins/usdt.svg", chg: -3.56, live: false },
  { id: "dai", name: "DAI", sym: "DAI", icon: "/brand/coins/dai.svg", chg: -3.56, live: false },
];

function formatUsd(n: string) {
  const v = Number(n);
  if (!Number.isFinite(v)) return `$${n}`;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function WalletPage() {
  const { data, isLoading, error, refetch } = useWallet();
  const [hidden, setHidden] = useState(false);
  const receipts = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => {
      const res = await fetch("/api/receipts", { headers: await authHeader() });
      const body = (await res.json()) as { receipts?: { plain_english: string; kind: string }[] };
      if (!res.ok) return [];
      return body.receipts ?? [];
    },
  });

  const dollars = data?.balanceUsd ?? "0.00";
  const [whole, frac = "00"] = dollars.split(".");
  const hasPlan = Boolean(data?.plan);
  const displayBal = hidden ? "••••••" : null;

  return (
    <div className="bb-money bb-wallet">
      <section className="bb-wal-card">
        <div className="bb-wal-card-top">
          <div className="bb-wal-card-meta">
            <span className="bb-wal-pill">
              <img src="/brand/ui/icon-wallet-white.svg" alt="" width={18} height={18} />
              Total balance
            </span>
            <p className="bb-wal-amount" aria-live="polite">
              {displayBal ? (
                <span>{displayBal}</span>
              ) : (
                <>
                  <span>${whole}</span>
                  <span className="bb-wal-frac">.{frac}</span>
                </>
              )}
            </p>
            <p className="bb-wal-sub">
              {isLoading
                ? "Reading AUSD on Monad testnet…"
                : error
                  ? error.message
                  : hasPlan
                    ? `Keep $${((data?.plan?.reserveFloorCents ?? 0) / 100).toFixed(0)} live · ${data?.network}`
                    : data?.shortAddress
                      ? `${data.shortAddress} · ${data.network}`
                      : "Approve a plan to unlock spend rules"}
            </p>
          </div>
          <button
            type="button"
            className="bb-wal-eye"
            aria-label={hidden ? "Show balance" : "Hide balance"}
            onClick={() => setHidden((h) => !h)}
          >
            <img src="/brand/ui/view.svg" alt="" width={20} height={20} />
          </button>
        </div>
        <div className="bb-wal-card-actions">
          <img className="bb-wal-wave" src="/brand/ui/wallet-card-wave.svg" alt="" aria-hidden />
          <Link to="/app/receive" className="bb-wal-act is-primary">
            <img src="/brand/ui/icon-receive-white.svg" alt="" width={22} height={22} />
            Receive
          </Link>
          <Link to="/app/send" className="bb-wal-act">
            <img src="/brand/icon-send.svg" alt="" width={22} height={22} />
            Send
          </Link>
          <Link to="/app/swap" className="bb-wal-act">
            <img src="/brand/icon-swap.svg" alt="" width={22} height={22} />
            Swap
          </Link>
        </div>
      </section>

      <div className="bb-wal-side">
        {!hasPlan && !isLoading && (
          <section className="bb-settings-card">
            <strong>Pending approvals</strong>
            <span>Approve your pending plan before large spends unlock.</span>
            <Link to="/app" className="bb-text-link">
              Open chat
            </Link>
          </section>
        )}

        <section className="bb-top-coins" aria-label="Top coin">
          <div className="bb-coin-head">
            <h2>Top coin</h2>
            <button type="button" className="bb-see-all" onClick={() => void refetch()}>
              See all
              <img src="/brand/ui/chevron.svg" alt="" width={8} height={8} />
            </button>
          </div>
          <div className="bb-coin-stack">
            {COINS.map((c) => {
              const bal = c.live ? formatUsd(dollars) : "$0.00";
              return (
                <div key={c.id} className="bb-coin-tile">
                  <img className="bb-coin-icon" src={c.icon} alt="" width={40} height={40} />
                  <div className="bb-coin-meta">
                    <div className="bb-coin-line">
                      <strong>{c.name}</strong>
                      <b>{hidden ? "••••" : bal}</b>
                    </div>
                    <div className="bb-coin-line">
                      <span>{c.sym}</span>
                      {c.chg === 0 ? (
                        <small className="is-flat">live</small>
                      ) : (
                        <small className={c.chg >= 0 ? "is-up" : "is-down"}>{Math.abs(c.chg).toFixed(2)}%</small>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bb-tx-list" aria-label="Transaction history">
          <div className="bb-coin-head">
            <h2>Transaction history</h2>
            <span className="bb-see-all">See all</span>
          </div>
          {(receipts.data ?? []).length === 0 ? (
            <div className="bb-tx-row">
              <span className="bb-tx-ico">PK</span>
              <div>
                <strong>No receipts yet</strong>
                <span>Settlements and blocks show up here from Envio + POCKET.</span>
              </div>
            </div>
          ) : (
            (receipts.data ?? []).slice(0, 6).map((r, i) => (
              <div key={i} className="bb-tx-row">
                <span className="bb-tx-ico">{r.kind === "blocked" ? "!" : "OK"}</span>
                <div>
                  <strong>{r.plain_english}</strong>
                  <span>{r.kind}</span>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
