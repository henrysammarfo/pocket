import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

type Active = "chat" | "wallet" | "receive" | "send" | "swap" | "settings" | "notifications";

const TABS = [
  { id: "chat" as const, label: "Chat", to: "/app" as const, icon: "/brand/icon-chat.svg" },
  {
    id: "wallet" as const,
    label: "Wallet",
    to: "/app/wallet" as const,
    icon: "/brand/icon-wallet.svg",
  },
  { id: "send" as const, label: "Send", to: "/app/send" as const, icon: "/brand/icon-send.svg" },
  {
    id: "receive" as const,
    label: "Receive",
    to: "/app/receive" as const,
    icon: "/brand/icon-receive.svg",
  },
];
const MORE = [
  { id: "swap" as const, label: "Swap", to: "/app/swap" as const, icon: "/brand/icon-swap.svg" },
  {
    id: "settings" as const,
    label: "Settings and AI allowance",
    to: "/app/settings" as const,
    icon: "/brand/icon-settings.svg",
  },
];

/**
 * Phone navigation: one row, four tabs plus More (design-taste-guide rule:
 * max 5, extras in a bottom sheet). Desktop keeps the sidebar.
 */
export function MobileTabBar({ active }: { active: Active }) {
  const [open, setOpen] = useState(false);
  const firstRef = useRef<HTMLAnchorElement>(null);
  const moreActive = MORE.some((m) => m.id === active) || active === "notifications";
  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => setOpen(false), [active]);
  return (
    <>
      <nav className="ot-tabbar bb-only-mobile" aria-label="Pocket sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to={t.to}
            className={`ot-tab ${active === t.id ? "is-active" : ""}`}
            aria-current={active === t.id ? "page" : undefined}
          >
            <img src={t.icon} alt="" width={22} height={22} aria-hidden />
            <span>{t.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`ot-tab ${moreActive ? "is-active" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <img src="/brand/icon-more.svg" alt="" width={22} height={22} aria-hidden />
          <span>More</span>
        </button>
      </nav>
      {open && (
        <div className="ot-sheet-wrap bb-only-mobile">
          <button
            type="button"
            className="ot-sheet-scrim"
            aria-label="Close More"
            onClick={() => setOpen(false)}
          />
          <div className="ot-sheet" role="dialog" aria-modal="true" aria-label="More">
            <span className="ot-sheet-grip" aria-hidden />
            {MORE.map((m, i) => (
              <Link
                key={m.id}
                ref={i === 0 ? firstRef : undefined}
                to={m.to}
                className={`ot-sheet-row ${active === m.id ? "is-active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <img src={m.icon} alt="" width={22} height={22} aria-hidden />
                <span>{m.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
