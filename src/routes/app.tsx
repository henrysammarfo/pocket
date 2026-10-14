import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/pocket-ui/LoadingState";
import { AppSidebar } from "@/components/pocket-ui/AppSidebar";
import { BrandLogo } from "@/components/BrandLogo";
import { authHeader } from "@/hooks/useAuth";
import { HealthDot } from "@/components/pocket-ui/HealthDot";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Pocket — Your money assistant" },
      { name: "description", content: "Tell Pocket what you want your money to do." },
      { property: "og:title", content: "Pocket" },
      { property: "og:description", content: "One plan. Your rules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppLayout,
});

export const threadsKey = ["threads"];

export async function createThread() {
  const res = await fetch("/api/threads", {
    method: "POST",
    headers: { ...(await authHeader()) },
  });
  const body = (await res.json()) as { id?: string; error?: string };
  if (!res.ok || !body.id) throw new Error(body.error ?? "Could not create conversation");
  return body.id;
}

function activeFromPath(path: string): "chat" | "wallet" | "receive" | "send" | "swap" | "settings" | "notifications" {
  if (path.includes("/send")) return "send";
  if (path.includes("/receive")) return "receive";
  if (path.includes("/swap")) return "swap";
  if (path.includes("/wallet")) return "wallet";
  if (path.includes("/settings")) return "settings";
  return "chat";
}

function titleFromPath(path: string): string | null {
  if (path.includes("/send")) return "Send money";
  if (path.includes("/receive")) return "Receive";
  if (path.includes("/swap")) return "Swap money";
  if (path.includes("/wallet")) return "Wallet";
  if (path.includes("/settings")) return "Settings";
  return null;
}

function AppLayout() {
  const { session, loading, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);
  useEffect(() => setOpen(false), [path]);

  if (loading || !session) {
    return (
      <div className="pk-app pk-center">
        <LoadingState label="Opening Pocket" />
      </div>
    );
  }

  const newThread = async () => {
    const id = await createThread();
    await qc.invalidateQueries({ queryKey: threadsKey });
    navigate({ to: "/app/$threadId", params: { threadId: id } });
  };

  const mobileTitle = titleFromPath(path);

  return (
    <div className={`bb-app ${collapsed ? "is-collapsed" : ""}`}>
      <AppSidebar
        collapsed={collapsed}
        open={open}
        email={session.user.email ?? null}
        active={activeFromPath(path)}
        onCollapse={() => setCollapsed((c) => !c)}
        onCloseMobile={() => setOpen(false)}
        onNewPlan={() => void newThread()}
        onLogout={() => {
          void logout().then(() => navigate({ to: "/auth" }));
        }}
      />
      {open && <button type="button" className="bb-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <main className="bb-main">
        <header className="bb-top bb-only-mobile">
          <button type="button" className="bb-round-btn" aria-label="Open menu" onClick={() => setOpen(true)}>
            <img src="/brand/icon-menu.svg" alt="" width={20} height={20} />
          </button>
          {mobileTitle ? <h1 className="bb-top-title">{mobileTitle}</h1> : <BrandLogo compact />}
          <span className="bb-only-mobile" style={{ marginLeft: "auto" }}>
            <HealthDot />
          </span>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
