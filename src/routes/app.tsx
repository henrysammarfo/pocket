import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, MessageSquarePlus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [
    { title: "POCKET — Your money assistant" },
    { name: "description", content: "Describe a money goal by voice or text and get a personalized, guarded plan." },
    { property: "og:title", content: "POCKET assistant" },
    { property: "og:description", content: "Talk to POCKET. Get a money plan that can't overspend." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AppLayout,
});

export const threadsKey = ["threads"];

export async function createThread() {
  const { data, error } = await supabase.from("threads").insert({}).select("id").single();
  if (error) throw error;
  return data.id;
}

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!loading && !session) navigate({ to: "/auth" }); }, [loading, session, navigate]);
  const { data: threads = [] } = useQuery({
    queryKey: threadsKey,
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from("threads").select("id,title,updated_at").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => setOpen(false), [params.threadId]);

  if (loading || !session) return <div className="app-loading">Opening POCKET…</div>;

  const newThread = async () => {
    const id = await createThread();
    await qc.invalidateQueries({ queryKey: threadsKey });
    navigate({ to: "/app/$threadId", params: { threadId: id } });
  };
  const remove = async (id: string) => {
    await supabase.from("threads").delete().eq("id", id);
    await qc.invalidateQueries({ queryKey: threadsKey });
    if (id === params.threadId) navigate({ to: "/app" });
  };

  return <div className="assistant-shell">
    <aside className={`assistant-side ${open ? "is-open" : ""}`} aria-label="Conversations">
      <div className="side-top">
        <Link to="/" aria-label="POCKET home"><BrandLogo compact /></Link>
        <button className="icon-btn side-close" aria-label="Close conversations" onClick={() => setOpen(false)}><X /></button>
      </div>
      <button className="new-thread" onClick={newThread}><MessageSquarePlus /> New conversation</button>
      <nav className="thread-list">
        {threads.map((t) => <div key={t.id} className={`thread-row ${t.id === params.threadId ? "is-active" : ""}`}>
          <Link to="/app/$threadId" params={{ threadId: t.id }}>{t.title}</Link>
          <button aria-label={`Delete ${t.title}`} onClick={() => remove(t.id)}><Trash2 /></button>
        </div>)}
        {threads.length === 0 && <p className="thread-empty">No conversations yet.</p>}
      </nav>
      <div className="side-foot">
        <span>{session.user.email}</span>
        <button className="icon-btn" aria-label="Sign out" onClick={() => supabase.auth.signOut()}><LogOut /></button>
      </div>
    </aside>
    {open && <button className="side-scrim" aria-label="Close conversations" onClick={() => setOpen(false)} />}
    <main className="assistant-main">
      <header className="assistant-top">
        <button className="icon-btn side-open" aria-label="Open conversations" onClick={() => setOpen(true)}><Menu /></button>
        <span className="eyebrow">Guidance · Testnet demo</span>
        <button className="icon-btn" aria-label="New conversation" onClick={newThread}><MessageSquarePlus /></button>
      </header>
      <Outlet />
    </main>
  </div>;
}
