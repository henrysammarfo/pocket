import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useQuery } from "@tanstack/react-query";
import { authHeader } from "@/hooks/useAuth";
import { AllowanceCard } from "@/components/pocket-ui/AllowanceCard";
import { AiActivityList, type AiActivityRow } from "@/components/pocket-ui/AiActivityList";
import { DrillCard } from "@/components/pocket-ui/DrillCard";
import type { Allowance } from "@/lib/ai/otari/allowance";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

type Row = {
  id: string;
  title: string;
  sub?: string;
  icon: string;
  to?: "/app" | "/app/wallet" | "/auth";
};

const ACCOUNT_ROWS: Row[] = [
  { id: "personal", title: "Personal information", sub: "Your name and email", icon: "/brand/settings/user.svg", to: "/auth" },
  { id: "security", title: "Security", sub: "Protect your account", icon: "/brand/settings/security.svg" },
  { id: "wallet", title: "Wallet & networks", sub: "Manage supported crypto settings", icon: "/brand/settings/wallet.svg", to: "/app/wallet" },
  { id: "notifications", title: "Notifications", sub: "Choose what you receive", icon: "/brand/settings/bell.svg" },
];

const PREF_ROWS: Row[] = [
  { id: "appearance", title: "Appearance", icon: "/brand/settings/palette.svg" },
  { id: "language", title: "Language & region", icon: "/brand/settings/earth.svg" },
];

function SettingsPage() {
  const { session, logout } = useAuth();
  const wallet = useWallet();
  const email = session?.user.email ?? wallet.data?.email;
  const plan = wallet.data?.plan;
  const name = email?.split("@")[0] ?? null;
  const allowance = useQuery({
    queryKey: ["ai-allowance"],
    queryFn: async () => {
      const res = await fetch("/api/ai/allowance", { headers: await authHeader() });
      if (!res.ok) throw new Error("allowance");
      return (await res.json()) as { allowance: Allowance | null; configured: boolean };
    },
    enabled: Boolean(session),
    staleTime: 30_000,
  });
  const aiRows = useQuery({
    queryKey: ["ai-receipts"],
    queryFn: async () => {
      const res = await fetch("/api/ai/receipts", { headers: await authHeader() });
      if (!res.ok) throw new Error("receipts");
      return ((await res.json()) as { receipts: AiActivityRow[] }).receipts;
    },
    enabled: Boolean(session),
    staleTime: 30_000,
  });

  return (
    <div className="bb-money bb-settings">
      <section className="bb-settings-block">
        <p className="bb-set-label">Plan</p>
        <div className="bb-set-card">
          <strong>{plan ? "Active plan" : "No active plan"}</strong>
          <span>
            {plan
              ? `Keep $${(plan.reserveFloorCents / 100).toFixed(0)} is the permission floor.`
              : "Create a plan to tell POCKET what your money should do."}
          </span>
          <Link to="/app" className="bb-text-link">
            Open chat
          </Link>
        </div>
      </section>

      {session && (
        <section className="bb-settings-block" aria-labelledby="set-ai">
          <p className="bb-set-label" id="set-ai">AI</p>
          <AllowanceCard
            allowance={allowance.data?.allowance ?? null}
            configured={allowance.data?.configured ?? true}
            loading={allowance.isLoading}
            error={allowance.isError}
            onRetry={() => void allowance.refetch()}
          />
          <AiActivityList rows={(aiRows.data ?? []).slice(0, 6)} loading={aiRows.isLoading} />
          <DrillCard />
        </section>
      )}

      <section className="bb-settings-block">
        <p className="bb-set-label">Account</p>
        {email && (
          <div className="bb-set-card bb-set-account">
            <span className="bb-mail-ico" aria-hidden>
              <img src="/brand/icon-mail.svg" alt="" width={24} height={24} />
            </span>
            <div className="bb-set-account-text">
              <strong>{name}</strong>
              <span>{email}</span>
              {wallet.data?.shortAddress && <span className="bb-mono-addr">{wallet.data.shortAddress}</span>}
            </div>
            <button type="button" className="bb-set-signin" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        )}
        {!email && (
          <div className="bb-set-card bb-set-account">
            <span className="bb-mail-ico" aria-hidden>
              <img src="/brand/icon-mail.svg" alt="" width={24} height={24} />
            </span>
            <div className="bb-set-account-text">
              <strong>Not signed in</strong>
              <span>Sign in to save your plan.</span>
            </div>
            <Link to="/auth" className="bb-set-signin">
              Sign in
            </Link>
          </div>
        )}
        <div className="bb-set-rows">
          {ACCOUNT_ROWS.map((row) => (
            <SettingsRow key={row.id} row={row} />
          ))}
        </div>
      </section>

      <section className="bb-settings-block">
        <p className="bb-set-label">Preferences</p>
        <div className="bb-set-rows">
          {PREF_ROWS.map((row) => (
            <SettingsRow key={row.id} row={row} />
          ))}
        </div>
      </section>

      <section className="bb-settings-block">
        <p className="bb-set-label">Support</p>
        <div className="bb-set-rows">
          <div className="bb-set-row">
            <span className="bb-mail-ico" aria-hidden>
              <img src="/brand/settings/about.svg" alt="" width={24} height={24} />
            </span>
            <div className="bb-set-account-text">
              <strong>About POCKET</strong>
              <span>Fail-closed money plans. An approved plan is the only permission.</span>
            </div>
            <img className="bb-set-chevron" src="/brand/ui/arrow-right.svg" alt="" width={24} height={24} />
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsRow({ row }: { row: Row }) {
  const body = (
    <>
      <span className="bb-mail-ico" aria-hidden>
        <img src={row.icon} alt="" width={24} height={24} />
      </span>
      <div className="bb-set-account-text">
        <strong>{row.title}</strong>
        {row.sub && <span>{row.sub}</span>}
      </div>
      <img className="bb-set-chevron" src="/brand/ui/arrow-right.svg" alt="" width={24} height={24} />
    </>
  );
  if (row.to) {
    return (
      <Link to={row.to} className="bb-set-row">
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className="bb-set-row">
      {body}
    </button>
  );
}
