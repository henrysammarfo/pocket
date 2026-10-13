import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Check, Copy, CornerDownRight, Mic, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createParser } from "eventsource-parser";
import { supabase } from "@/integrations/supabase/client";
import { authHeader } from "@/hooks/useAuth";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputButton, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { BrandMark } from "@/components/BrandLogo";
import { LoadingState } from "@/components/pocket-ui/LoadingState";
import { GoalCard } from "@/components/pocket-ui/GoalCard";
import { BlockScreen } from "@/components/pocket-ui/BlockScreen";
import { threadsKey } from "./app";
import { parseSpendIntent } from "@/lib/policy/plan-parser";

export const Route = createFileRoute("/app/$threadId")({ component: ThreadPage });

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("thread_messages").select("message_id,role,parts").eq("thread_id", threadId).order("created_at");
      if (error) throw error;
      return data.map((m) => ({ id: m.message_id, role: m.role, parts: m.parts })) as unknown as UIMessage[];
    },
    staleTime: Infinity,
  });
  if (isLoading) return <div className="pk-center"><LoadingState label="Loading conversation" /></div>;
  if (error) return <div className="pk-center">This conversation could not be loaded.</div>;
  return <ChatWindow key={threadId} threadId={threadId} initial={data ?? []} />;
}

const SUGGESTIONS = [
  "Save $3,000 for a trip by June",
  "Pay off $2,400 of card debt without missing rent",
  "Build a 3-month emergency fund on $2,800/month",
];
const FOLLOW_UPS = ["Make it more aggressive", "What if my income drops 20%?", "Turn this into weekly steps"];
const COMMANDS = [
  { cmd: "/save", text: "Help me save $ for " },
  { cmd: "/debt", text: "Help me pay off $ of debt. My minimum payment is $" },
  { cmd: "/budget", text: "Budget my monthly pay of $. Fixed bills are $" },
  { cmd: "/reserve", text: "Build an emergency reserve. I earn $ a month and spend $" },
];

const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

function ChatWindow({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [showGoal, setShowGoal] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [block, setBlock] = useState<{ message: string; bufferCents: number; planCatch?: string } | null>(null);
  const [receipts, setReceipts] = useState<{ plain_english: string; kind: string }[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { messages, sendMessage, status, stop, regenerate } = useChat({
    id: threadId,
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat", headers: authHeader, body: { threadId } }),
    onError: (e) => setErr(e.message || "Something went wrong."),
    onFinish: () => { qc.invalidateQueries({ queryKey: threadsKey }); qc.invalidateQueries({ queryKey: ["thread-messages", threadId] }); },
  });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => { if (!busy) taRef.current?.focus(); }, [busy]);
  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/receipts", { headers: await authHeader() });
      if (!res.ok) return;
      const body = (await res.json()) as { receipts?: { plain_english: string; kind: string }[] };
      setReceipts(body.receipts ?? []);
    })();
  }, [block, planId]);

  const approvePlan = async (goalText: string) => {
    const res = await fetch("/api/plans/approve", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ goalText, threadId, reserveFloorCents: 20_000 }),
    });
    const body = (await res.json()) as { planId?: string; error?: string };
    if (!res.ok) throw new Error(body.error ?? "Could not approve plan");
    setPlanId(body.planId ?? null);
  };

  const trySettle = async (value: string, source: "typed" | "spoken" = "typed") => {
    const intent = parseSpendIntent(value, source);
    if (intent.kind === "unknown" && !planId) return false;
    if (intent.kind === "unknown") return false;
    const res = await fetch("/api/settle", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ text: value, source, planId }),
    });
    const body = (await res.json()) as {
      blocked?: boolean;
      screen?: { message: string; bufferCents: number; planCatch?: string };
      error?: string;
      settlement?: { explorerUrl: string };
    };
    if (body.blocked && body.screen) {
      const screen: { message: string; bufferCents: number; planCatch?: string } = {
        message: body.screen.message,
        bufferCents: body.screen.bufferCents,
      };
      if (body.screen.planCatch) screen.planCatch = body.screen.planCatch;
      setBlock(screen);
      return true;
    }
    if (!res.ok && body.error) {
      // Missing wallet keys is expected until Privy is wired — still surface honestly.
      setErr(body.error);
      return true;
    }
    if (body.settlement) {
      setBlock(null);
      setErr(null);
    }
    return true;
  };

  const send = async (value: string, source: "typed" | "spoken" = "typed") => {
    const v = value.trim();
    if (!v || busy) return;
    setErr(null);
    try {
      if (!planId && /keep\s*\$?\s*\d+/i.test(v)) await approvePlan(v);
      const settled = await trySettle(v, source);
      if (settled && parseSpendIntent(v).kind === "send_rest") {
        setText("");
        return;
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not run plan guards");
    }
    sendMessage({ text: v });
    setText("");
  };
  const slash = /^\/\w*$/.test(text) ? COMMANDS.filter((c) => c.cmd.startsWith(text)) : [];
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return <div className="pk-chat">
    <Conversation className="pk-scroll">
      <ConversationContent className="pk-thread-body">
        {block && (
          <BlockScreen
            message={block.message}
            bufferCents={block.bufferCents}
            {...(block.planCatch ? { planCatch: block.planCatch } : {})}
            rentPaidNote="Rent was already paid inside the plan."
          />
        )}
        {receipts.length > 0 && <div className="pk-chip-row" aria-label="Activity">
          {receipts.slice(0, 6).map((r, i) => (
            <span key={i} className={`pk-chip ${r.kind === "blocked" ? "is-danger" : r.kind === "paid" ? "is-ok" : ""}`}>{r.plain_english}</span>
          ))}
        </div>}
        {messages.length === 0 && !block && <div className="pk-hero">
          <span className="pk-hero-mark"><BrandMark size={52} /></span>
          <h1>What should your money do?</h1>
          <p>Say it out loud or type it. POCKET turns your goal into a plan with rules that can't overspend.</p>
          {showGoal
            ? <GoalCard onComplete={(g) => void send(g)} onDismiss={() => setShowGoal(false)} />
            : <div className="pk-suggest">{SUGGESTIONS.map((s) => <button key={s} onClick={() => void send(s)}><CornerDownRight size={12} />{s}</button>)}</div>}
        </div>}
        {messages.map((m) => <Message key={m.id} from={m.role} className="pk-msg">
          <MessageContent className={m.role === "user" ? "pk-user" : "pk-assistant"}>
            {m.parts.map((p, i) => {
              if (p.type === "text") return m.role === "user" ? <p key={i}>{p.text}</p> : <MessageResponse key={i}>{p.text}</MessageResponse>;
              if (p.type === "reasoning" && p.text) return <Reasoning key={i} isStreaming={status === "streaming" && m.id === messages.at(-1)?.id}><ReasoningTrigger /><ReasoningContent>{p.text}</ReasoningContent></Reasoning>;
              return null;
            })}
            {m.role === "assistant" && !(busy && m.id === messages.at(-1)?.id) && <div className="pk-actions">
              <button aria-label="Copy plan" onClick={() => { navigator.clipboard.writeText(textOf(m)); setCopied(m.id); setTimeout(() => setCopied(null), 1400); }}>{copied === m.id ? <Check size={14} /> : <Copy size={14} />}</button>
              {m.id === lastAssistant?.id && <button aria-label="Regenerate" onClick={() => regenerate()}><RotateCcw size={14} /></button>}
              {m.id === lastAssistant?.id && <button type="button" className="pk-chip" onClick={() => void approvePlan(textOf(m)).then(() => setErr(null)).catch((e) => setErr(e instanceof Error ? e.message : "Approve failed"))}>Approve plan · Keep $200</button>}
            </div>}
          </MessageContent>
        </Message>)}
        {status === "submitted" && <div className="pk-msg"><LoadingState /></div>}
        {status === "ready" && lastAssistant && lastAssistant.id === messages.at(-1)?.id && <div className="pk-followups">
          <p>Follow-ups</p>
          {FOLLOW_UPS.map((f, i) => <button key={f} style={{ animationDelay: `${i * 90}ms` }} onClick={() => void send(f)}><CornerDownRight size={12} />{f}</button>)}
          <button style={{ animationDelay: "270ms" }} onClick={() => void send("Send the rest")}><CornerDownRight size={12} />Send the rest</button>
        </div>}
        {err && <p className="pk-error" role="alert">{err}</p>}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
    <div className="pk-composer">
      {slash.length > 0 && <div className="pk-menu" role="listbox" aria-label="Plan templates">
        {slash.map((c) => <button key={c.cmd} role="option" aria-selected="false" onClick={() => { setText(c.text); taRef.current?.focus(); }}><code>{c.cmd}</code><span>{c.text.replace(/\$/g, "$…")}</span></button>)}
      </div>}
      <PromptInput onSubmit={(msg) => void send(msg.text)} className="pk-prompt">
        <PromptInputTextarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe a money goal, or type / for templates" autoFocus />
        <PromptInputFooter className="justify-between">
          <PromptInputTools><VoiceButton onText={(t) => { void send(t, "spoken"); }} onError={setErr} /></PromptInputTools>
          <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} className="pk-send" />
        </PromptInputFooter>
      </PromptInput>
      <p className="pk-disclaimer">Monad testnet. Approved plan is the only permission. Crypto stays under the hood.</p>
    </div>
  </div>;
}

function VoiceButton({ onText, onError }: { onText: (t: string) => void; onError: (m: string) => void }) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const [level, setLevel] = useState<number[]>([0, 0, 0, 0, 0]);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const raf = useRef(0);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser(); an.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => { an.getByteFrequencyData(buf); setLevel([2, 5, 8, 11, 14].map((i) => (buf[i] ?? 0) / 255)); raf.current = requestAnimationFrame(tick); };
      tick();
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = async () => {
        cancelAnimationFrame(raf.current); ctx.close();
        stream.getTracks().forEach((t) => t.stop());
        setState("busy");
        try {
          const type = (r.mimeType || "audio/webm").split(";")[0] ?? "audio/webm";
          const blob = new Blob(chunks.current, { type });
          if (!blob.size) throw new Error("No audio was captured.");
          const form = new FormData();
          form.append("file", new File([blob], `goal.${type.includes("mp4") ? "m4a" : "webm"}`, { type }));
          const res = await fetch("/api/transcribe", { method: "POST", headers: await authHeader(), body: form });
          if (!res.ok || !res.body) {
            const j = await res.json().catch(() => null);
            throw new Error(j?.error?.message ?? j?.error ?? "Could not understand that recording.");
          }
          let final = ""; let partial = "";
          const parser = createParser({ onEvent: (ev) => {
            try {
              const d = JSON.parse(ev.data);
              if (d.type === "transcript.text.delta") partial += d.delta ?? "";
              if (d.type === "transcript.text.done") final = d.text ?? "";
            } catch { /* ignore */ }
          } });
          const reader = res.body.getReader(); const dec = new TextDecoder();
          for (;;) { const { done, value } = await reader.read(); if (done) break; parser.feed(dec.decode(value, { stream: true })); }
          const t = (final || partial).trim();
          if (!t) throw new Error("I didn't catch that. Try again.");
          onText(t);
        } catch (e) { onError(e instanceof Error ? e.message : "Voice input failed."); }
        setState("idle");
      };
      rec.current = r; r.start(); setState("rec");
    } catch { onError("Microphone access is needed for voice input."); }
  };

  return <PromptInputButton
    aria-label={state === "rec" ? "Stop recording" : "Speak your money goal"}
    className={`pk-mic ${state === "rec" ? "is-live" : ""}`}
    disabled={state === "busy"}
    onClick={() => (state === "rec" ? rec.current?.stop() : start())}
  >
    {state === "rec" ? <Square className="size-3.5" /> : <Mic className="size-4" />}
    {state === "rec" && <span className="pk-wave" aria-hidden>{level.map((l, i) => <i key={i} style={{ transform: `scaleY(${0.25 + l * 1.4})` }} />)}</span>}
    <span>{state === "rec" ? "Listening — tap to stop" : state === "busy" ? "Transcribing…" : "Speak"}</span>
  </PromptInputButton>;
}
