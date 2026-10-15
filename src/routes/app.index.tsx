import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { authHeader } from "@/hooks/useAuth";
import { createThread, threadsKey } from "./app";

export const Route = createFileRoute("/app/")({ component: AppIndex });

function AppIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const res = await fetch("/api/threads", { headers: await authHeader() });
      const body = (await res.json()) as { threads?: { id: string }[] };
      const id = body.threads?.[0]?.id ?? (await createThread());
      await qc.invalidateQueries({ queryKey: threadsKey });
      navigate({ to: "/app/$threadId", params: { threadId: id }, replace: true });
    })();
  }, [navigate, qc]);
  return <div className="app-loading">Opening your conversation…</div>;
}
