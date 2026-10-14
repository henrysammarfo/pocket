import { Link } from "@tanstack/react-router";
import { BrandLogo, BrandMark } from "@/components/BrandLogo";

type AppSidebarProps = {
  collapsed: boolean;
  open: boolean;
  email?: string | null;
  displayName?: string;
  active: "chat" | "wallet" | "receive" | "send" | "swap" | "settings" | "notifications";
  onCollapse: () => void;
  onCloseMobile: () => void;
  onNewPlan: () => void;
  onLogout: () => void;
};

const ACTIONS = [
  { id: "wallet" as const, label: "Wallet", to: "/app/wallet" as const, icon: "/brand/icon-wallet.svg" },
  { id: "receive" as const, label: "Receive", to: "/app/receive" as const, icon: "/brand/icon-receive.svg" },
  { id: "send" as const, label: "Send", to: "/app/send" as const, icon: "/brand/icon-send.svg" },
  { id: "swap" as const, label: "Swap", to: "/app/swap" as const, icon: "/brand/icon-swap.svg" },
  { id: "notifications" as const, label: "Notifications", to: "/app/settings" as const, icon: "/brand/icon-bell.svg" },
  { id: "settings" as const, label: "Settings", to: "/app/settings" as const, icon: "/brand/icon-settings.svg", danger: true },
];

export function AppSidebar({
  collapsed,
  open,
  email,
  displayName,
  active,
  onCollapse,
  onCloseMobile,
  onNewPlan,
  onLogout,
}: AppSidebarProps) {
  const name = displayName || email?.split("@")[0] || "Member";
  return (
    <aside className={`bb-side ${open ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`} aria-label="Pocket navigation">
      <div className="bb-side-head">
        <Link to="/app" className="bb-side-brand" onClick={onCloseMobile} aria-label="Pocket home">
          {collapsed ? <BrandMark size={22} /> : <BrandLogo compact />}
        </Link>
        <button type="button" className="bb-round-btn bb-only-desktop" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onCollapse}>
          <img src="/brand/icon-sidebar.svg" alt="" width={20} height={20} />
        </button>
        <button type="button" className="bb-round-btn bb-only-mobile" aria-label="Close menu" onClick={onCloseMobile}>
          <img src="/brand/icon-menu.svg" alt="" width={20} height={20} />
        </button>
      </div>

      <button type="button" className="bb-new-plan" onClick={() => { onNewPlan(); onCloseMobile(); }}>
        <img src="/brand/icon-chat.svg" alt="" width={22} height={22} />
        <span>Create new plan</span>
      </button>

      <p className="bb-side-label">Quick actions</p>
      <nav className="bb-quick">
        {ACTIONS.map((a) => (
          <Link
            key={a.id}
            to={a.to}
            className={`bb-quick-item ${active === a.id ? "is-active" : ""} ${a.danger ? "is-danger" : ""}`}
            onClick={onCloseMobile}
          >
            <img src={a.icon} alt="" width={22} height={22} />
            <span>{a.label}</span>
          </Link>
        ))}
      </nav>

      <div className="bb-side-user">
        <img className="bb-avatar" src="/brand/avatar-demo.png" alt="" width={40} height={40} />
        <div className="bb-side-user-meta">
          <strong>{name}</strong>
          <span>{email ?? "Signed in"}</span>
        </div>
        <button type="button" className="bb-more" aria-label="Account menu" onClick={onLogout}>
          <img src="/brand/icon-more.svg" alt="" width={20} height={20} />
        </button>
      </div>
    </aside>
  );
}
