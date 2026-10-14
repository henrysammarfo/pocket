import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { readLastPlanId } from "@/lib/pocket/plan-session";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { session, logout } = useAuth();
  const email = session?.user.email;
  const hasPlan = Boolean(typeof window !== "undefined" && readLastPlanId());

  return (
    <div className="bb-money bb-settings">
      <section className="bb-settings-block">
        <p className="bb-side-label">Plan</p>
        <div className="bb-settings-card">
          <strong>{hasPlan ? "Active plan" : "No active plan"}</strong>
          <span>
            {hasPlan
              ? "Your approved plan is the only permission for spends."
              : "Create a plan to tell POCKET what your money should do."}
          </span>
          <Link to="/app" className="bb-text-link">
            Open chat
          </Link>
        </div>
      </section>

      <section className="bb-settings-block">
        <p className="bb-side-label">Account</p>
        <div className="bb-settings-card bb-settings-account">
          <div className="bb-settings-account-row">
            <span className="bb-mail-ico" aria-hidden>
              <img src="/brand/icon-mail.svg" alt="" width={22} height={22} />
            </span>
            <div>
              <strong>{email ? "Signed in" : "Not signed in"}</strong>
              <span>{email ?? "Sign in to save your plan."}</span>
            </div>
            {email ? (
              <button
                type="button"
                className="bb-chip-btn"
                onClick={() => {
                  void logout();
                }}
              >
                Sign out
              </button>
            ) : (
              <Link to="/auth" className="bb-chip-btn">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="bb-settings-block">
        <p className="bb-side-label">About POCKET</p>
        <div className="bb-settings-card">
          <strong>Fail-closed money plans</strong>
          <span>An approved plan is the only permission. Later messages cannot raise Keep or add payees.</span>
        </div>
      </section>
    </div>
  );
}
