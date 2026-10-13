import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, SquarePen, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { authHeader, useAuth } from "@/hooks/useAuth";
import { BrandLogo, BrandMark } from "@/components/BrandLogo";
import { LoadingState } from "@/components/pocket-ui/LoadingState";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "POCKET — Your money assistant" },
      { name: "description", content: "Describe a money goal by voice or text and get a personalized, guarded plan." },
      { property: "og:title", content: "POCKET assistant" },
      { property: "og:description", content: "Talk to POCKET. Get a money plan that can't overspend." },
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

function AppLayout() {
  const { session, loading, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);
  const { data: threads = [] } = useQuery({
    queryKey: threadsKey,
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch("/api/threads", { headers: await authHeader() });
      const body = (await res.json()) as { threads?: { id: string; title: string; updated_at: string }[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not load conversations");
      return body.threads ?? [];
    },
  });
  useEffect(() => setOpen(false), [params.threadId]);

  if (loading || !session) {
    return (
      <div className="pk-app pk-center">
        <LoadingState label="Opening POCKET" />
      </div>
    );
  }

  const newThread = async () => {
    const id = await createThread();
    await qc.invalidateQueries({ queryKey: threadsKey });
    navigate({ to: "/app/$threadId", params: { threadId: id } });
  };
  const remove = async (id: string) => {
    await fetch(`/api/threads/${id}`, { method: "DELETE", headers: await authHeader() });
    await qc.invalidateQueries({ queryKey: threadsKey });
    if (id === params.threadId) navigate({ to: "/app" });
  };
  const shown = threads.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));
  const initial = (session.user.email ?? "P")[0]!.toUpperCase();

  return (
    <div className={`pk-app ${collapsed ? "is-collapsed" : ""}`}>
      <aside className={`pk-side ${open ? "is-open" : ""}`} aria-label="Conversations">
        <div className="pk-side-top">
          <Link to="/" aria-label="POCKET home" className="pk-side-brand">
            {collapsed ? <BrandMark size={26} /> : <BrandLogo compact />}
          </Link>
          <button
            className="pk-icon-btn pk-only-desktop"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <button className="pk-icon-btn pk-only-mobile" aria-label="Close conversations" onClick={() => setOpen(false)}>
            <X size={17} />
          </button>
        </div>
        <button className="pk-nav-item pk-new" onClick={newThread}>
          <SquarePen size={17} />
          <span>New plan</span>
        </button>
        <label className="pk-search">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plans…" aria-label="Search conversations" />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={12} />
            </button>
          )}
        </label>
        <p className="pk-side-label">Recents</p>
        <nav className="pk-threads">
          {shown.map((t) => (
            <div key={t.id} className={`pk-thread ${t.id === params.threadId ? "is-active" : ""}`}>
              <Link to="/app/$threadId" params={{ threadId: t.id }} title={t.title}>
                {t.title}
              </Link>
              <button aria-label={`Delete ${t.title}`} onClick={() => remove(t.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {shown.length === 0 && <p className="pk-empty">{query ? "No plans match" : "No conversations yet"}</p>}
        </nav>
        <div className="pk-side-foot">
          <span className="pk-avatar">{initial}</span>
          <span className="pk-email">{session.user.email ?? "Member"}</span>
          <button
            className="pk-icon-btn"
            aria-label="Sign out"
            onClick={() => {
              void logout().then(() => navigate({ to: "/auth" }));
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      {open && <button className="pk-scrim" aria-label="Close conversations" onClick={() => setOpen(false)} />}
      <main className="pk-main">
        <header className="pk-top">
          <button className="pk-icon-btn pk-only-mobile" aria-label="Open conversations" onClick={() => setOpen(true)}>
            <Menu size={18} />
          </button>
          <span className="pk-chip">
            <span className="pk-dot" />
            Testnet demo · Guidance only
          </span>
          <button className="pk-icon-btn" aria-label="New plan" onClick={newThread}>
            <SquarePen size={17} />
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
