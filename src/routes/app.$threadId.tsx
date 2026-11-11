import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Check, Copy, CornerDownRight, Mic, RotateCcw, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createParser } from "eventsource-parser";
import { authHeader } from "@/hooks/useAuth";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputButton, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { LoadingState } from "@/components/pocket-ui/LoadingState";
import { BlockScreen } from "@/components/pocket-ui/BlockScreen";
import { PlanCard, ReadingPlan } from "@/components/pocket-ui/PlanCard";
import { threadsKey } from "./app";
import { parseSpendIntent, parseMoneyPlanFromGoal } from "@/lib/policy/plan-parser";
import { readStoredPlanId, rememberThread, writeStoredPlanId } from "@/lib/pocket/plan-session";
import { AiReceiptStrip, LiveToolChips, shortModel } from "@/components/pocket-ui/AiReceiptStrip";
import type { ToolChip } from "@/lib/ai/otari/tool-calls";
import { AiNotice } from "@/components/pocket-ui/AiNotice";
import { decodeAiStateLoose, type AiStatePayload } from "@/lib/ai/ai-states";
import type { AiReceipt } from "@/lib/ai/otari/receipt";

export const Route = createFileRoute("/app/$threadId")({ component: ThreadPage });

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/threads/${threadId}`, { headers: await authHeader() });
      const body = (await res.json()) as {
        messages?: { message_id: string; role: string; parts: unknown }[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Could not load conversation");
      return (body.messages ?? []).map((m) => ({
        id: m.message_id,
        role: m.role,
        parts: m.parts,
      })) as unknown as UIMessage[];
    },
    staleTime: Infinity,
  });
  if (isLoading) return <div className="pk-center"><LoadingState label="Loading conversation" /></div>;
  if (error) return <div className="pk-center">This conversation could not be loaded.</div>;
  return <ChatWindow key={threadId} threadId={threadId} initial={data ?? []} />;
}

const SUGGESTIONS = [
  "Pay my rent on Friday, keep $500",
  "Save $3,000 for a trip by June",
  "Build a 3-month emergency fund on $2,800/month",
];
const FOLLOW_UPS = ["Make it more aggressive", "What if my income drops 20%?", "Send the rest"];
const COMMANDS = [
  { cmd: "/save", text: "Help me save $ for " },
  { cmd: "/debt", text: "Help me pay off $ of debt. My minimum payment is $" },
  { cmd: "/budget", text: "Budget my monthly pay of $. Fixed bills are $" },
  { cmd: "/reserve", text: "Build an emergency reserve. I earn $ a month and spend $" },
];

const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

/** A message that sets up money rules (a Keep, a bill, payees), not a question or a one-off payment. */
export function looksLikeGoal(text: string): boolean {
  if (!text.trim()) return false;
  if (/\bkeep\s*\$?\s*\d/i.test(text)) return true;
  if (/\b(approve|payees?|allow)\b/i.test(text) && /\b(pay|payee|send)\b/i.test(text)) return true;
  return /\b(pay|send)\b[\s\w]{0,20}\brent\b/i.test(text);
}

function stepsFromGoal(goal: string) {
  const plan = parseMoneyPlanFromGoal(goal, { reserveFloorCents: 50_000 });
  const steps = plan.steps.map((s) => ({
    when: s.when === "always" ? "Always" : s.when ?? "Soon",
    label: s.label.replace(/^Pay /i, "Pay ").replace(/^Keep /i, "Keep"),
    amountLabel: `$${((s.amountCents ?? 0) / 100).toFixed(2)}`,
  }));
  const payees = plan.allowlist.filter((p) => p.label !== "Rent" || /\brent\b/i.test(goal));
  return [
    ...steps,
    ...payees.filter((p) => p.label !== "Rent").map((p) => ({ when: "Approved", label: `Pay ${p.label}`, amountLabel: "Above the Keep" })),
  ];
}

function ChatWindow({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [aiState, setAiState] = useState<AiStatePayload | null>(null);
  const [liveTools, setLiveTools] = useState<(ToolChip & { running?: boolean })[]>([]);
  const [intentNote, setIntentNote] = useState<{ parsedBy: "model" | "rules"; model: string | null } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(() => readStoredPlanId(threadId));
  const [planReady, setPlanReady] = useState(() => Boolean(readStoredPlanId(threadId)));
  const [block, setBlock] = useState<{ message: string; bufferCents: number; planCatch?: string } | null>(null);
  const [receipts, setReceipts] = useState<{ plain_english: string; kind: string }[]>([]);
  const [showPlanCard, setShowPlanCard] = useState(false);
  const [planGoal, setPlanGoal] = useState("Pay my rent on Friday, keep $500");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { messages, sendMessage, status, stop, regenerate } = useChat({
    id: threadId,
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat", headers: authHeader, body: { threadId } }),
    onError: (e) => {
      const state = decodeAiStateLoose(e.message);
      if (state) {
        setAiState(state);
        setErr(null);
      } else setErr(e.message || "Something went wrong.");
      setLiveTools([]);
    },
    onData: (part) => {
      if (part.type === "data-tools") setLiveTools(part.data as (ToolChip & { running?: boolean })[]);
    },
    onFinish: () => {
      setLiveTools([]);
      qc.invalidateQueries({ queryKey: threadsKey });
      qc.invalidateQueries({ queryKey: ["thread-messages", threadId] });
      setShowPlanCard(true);
    },
  });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => { if (!busy) taRef.current?.focus(); }, [busy]);
  useEffect(() => {
    rememberThread(threadId);
    const stored = readStoredPlanId(threadId);
    setPlanId(stored);
    setPlanReady(Boolean(stored));
    setBlock(null);
    setShowPlanCard(Boolean(stored) ? false : initial.some((m) => m.role === "assistant"));
  }, [threadId, initial]);
  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/receipts", { headers: await authHeader() });
      if (!res.ok) return;
      const body = (await res.json()) as { receipts?: { plain_english: string; kind: string }[] };
      setReceipts(body.receipts ?? []);
    })();
  }, [block, planId]);

  const rememberPlan = (id: string | null) => {
    setPlanId(id);
    setPlanReady(Boolean(id));
    writeStoredPlanId(threadId, id);
  };

  const approvePlan = async (goalText: string): Promise<string | null> => {
    const res = await fetch("/api/plans/approve", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeader()) },
      // The Keep comes from the goal ("keep $50"); $500 only when the goal names none.
      body: JSON.stringify({ goalText, threadId, ...(/keep\s*\$?\s*\d/i.test(goalText) ? {} : { reserveFloorCents: 50_000 }) }),
    });
    const body = (await res.json()) as { planId?: string; error?: string };
    if (!res.ok) throw new Error(body.error ?? "Could not approve plan");
    const id = body.planId ?? null;
    rememberPlan(id);
    setShowPlanCard(false);
    return id;
  };

  const trySettle = async (
    value: string,
    source: "typed" | "spoken" = "typed",
    activePlanId: string | null = planId,
  ) => {
    const intent = parseSpendIntent(value, source);
    if (intent.kind === "unknown") return false;
    const res = await fetch("/api/settle", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ text: value, source, planId: activePlanId }),
    });
    const body = (await res.json()) as {
      blocked?: boolean;
      screen?: { message: string; bufferCents: number; planCatch?: string };
      error?: string;
      settlement?: { explorerUrl: string };
      aiIntent?: { parsedBy: "model" | "rules"; receipt: AiReceipt | null };
    };
    if (body.aiIntent) setIntentNote({ parsedBy: body.aiIntent.parsedBy, model: body.aiIntent.receipt?.model ?? null });
    if (body.blocked && body.screen) {
      setBlock({
        message: body.screen.message,
        bufferCents: body.screen.bufferCents,
        ...(body.screen.planCatch ? { planCatch: body.screen.planCatch } : {}),
      });
      setErr(null);
      return true;
    }
    if (!res.ok && body.error) {
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
    setAiState(null);
    setPlanGoal(v);
    try {
      let activePlanId = planId;
      if (!activePlanId && /keep\s*\$?\s*\d+/i.test(v)) {
        activePlanId = await approvePlan(v);
      }
      const settled = await trySettle(v, source, activePlanId);
      if (settled && parseSpendIntent(v, source).kind !== "unknown") {
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
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const empty = messages.length === 0 && !block;

  return (
    <div className="bb-chat">
      {block && (
        <BlockScreen
          message={block.message}
          bufferCents={block.bufferCents}
          {...(block.planCatch ? { planCatch: block.planCatch } : {})}
          rentPaidNote="Rent was already paid inside the plan."
          onDismiss={() => setBlock(null)}
        />
      )}
      <Conversation className="bb-scroll">
        <ConversationContent className="bb-thread-body">
          {planReady && !block && (
            <div className="pk-chip-row" aria-label="Plan status">
              <span className="pk-chip is-ok">Plan approved · Keep live · Try Send the rest</span>
            </div>
          )}
          {intentNote && (
            <div className="pk-chip-row" aria-label="How Pocket read your last payment message">
              <span className="pk-chip">
                {intentNote.parsedBy === "model" ? `Read by ${shortModel(intentNote.model)}` : "Read by Pocket's own rules"}. Your plan made the decision.
              </span>
            </div>
          )}
          {receipts.length > 0 && (
            <div className="pk-chip-row" aria-label="Activity">
              {receipts.slice(0, 6).map((r, i) => (
                <span key={i} className={`pk-chip ${r.kind === "blocked" ? "is-danger" : r.kind === "paid" ? "is-ok" : ""}`}>
                  {r.plain_english}
                </span>
              ))}
            </div>
          )}

          {empty && (
            <div className="bb-hero">
              <p className="pk-hero-kicker"><i aria-hidden />One plan. Your rules.</p>
              <h1>
                Your <span>money</span> on <span>your</span> terms
              </h1>
              <p>Tell pocket what you want your money to do</p>
              <img className="pk-hero-art" src="/brand/hero-coins.png" alt="" width={550} height={335} />
              <div className="pk-suggest bb-only-mobile">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)}>
                    <CornerDownRight size={12} />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Message key={m.id} from={m.role} className="pk-msg">
              <MessageContent className={m.role === "user" ? "pk-user" : "pk-assistant"}>
                {m.parts.map((p, i) => {
                  if (p.type === "text") {
                    return m.role === "user" ? <p key={i}>{p.text}</p> : <MessageResponse key={i}>{p.text}</MessageResponse>;
                  }
                  if (p.type === "data-receipt") {
                    return <AiReceiptStrip key={i} receipt={(p as unknown as { data: AiReceipt }).data} />;
                  }
                  if (p.type === "reasoning" && p.text) {
                    return (
                      <Reasoning key={i} isStreaming={status === "streaming" && m.id === messages.at(-1)?.id}>
                        <ReasoningTrigger />
                        <ReasoningContent>{p.text}</ReasoningContent>
                      </Reasoning>
                    );
                  }
                  return null;
                })}
                {m.role === "assistant" && !(busy && m.id === messages.at(-1)?.id) && (
                  <div className="pk-actions">
                    <button
                      aria-label="Copy plan"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(textOf(m));
                        setCopied(m.id);
                        setTimeout(() => setCopied(null), 1400);
                      }}
                    >
                      {copied === m.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <SpeakButton text={textOf(m)} onError={setErr} />
                    {m.id === lastAssistant?.id && (
                      <button aria-label="Regenerate" type="button" onClick={() => regenerate()}>
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                )}
              </MessageContent>
            </Message>
          ))}

          {busy && <ReadingPlan />}
          {busy && <LiveToolChips chips={liveTools} />}

          {!planReady && showPlanCard && lastAssistant && !busy && looksLikeGoal(textOf(lastUser!) || "") && (
            <PlanCard
              steps={stepsFromGoal(textOf(lastUser!))}
              onApprove={() => {
                void approvePlan(textOf(lastUser!))
                  .then(() => setErr(null))
                  .catch((e) => setErr(e instanceof Error ? e.message : "Approve failed"));
              }}
              onEdit={() => taRef.current?.focus()}
            />
          )}

          {status === "ready" && lastAssistant && lastAssistant.id === messages.at(-1)?.id && planReady && (
            <div className="pk-followups">
              <p>Follow-ups</p>
              {FOLLOW_UPS.map((f, i) => (
                <button key={f} type="button" style={{ animationDelay: `${i * 90}ms` }} onClick={() => void send(f)}>
                  <CornerDownRight size={12} />
                  {f}
                </button>
              ))}
            </div>
          )}
          {aiState && !busy && (
            <AiNotice
              state={aiState}
              onRetry={() => {
                setAiState(null);
                void regenerate();
              }}
              onDismiss={() => setAiState(null)}
            />
          )}
          {err && <p className="pk-error" role="alert">{err}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="bb-composer">
        {slash.length > 0 && (
          <div className="pk-menu" role="listbox" aria-label="Plan templates">
            {slash.map((c) => (
              <button
                key={c.cmd}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => {
                  setText(c.text);
                  taRef.current?.focus();
                }}
              >
                <code>{c.cmd}</code>
                <span>{c.text.replace(/\$/g, "$…")}</span>
              </button>
            ))}
          </div>
        )}
        <PromptInput onSubmit={(msg) => void send(msg.text)} className="bb-prompt">
          <PromptInputTextarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell pocket what you want your money to do"
            autoFocus
          />
          <PromptInputFooter className="bb-prompt-foot">
            <PromptInputTools>
              <VoiceButton onText={(t) => { void send(t, "spoken"); }} onError={setErr} />
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} className="bb-send" />
          </PromptInputFooter>
        </PromptInput>
        <p className="pk-disclaimer">Monad testnet. Approved plan is the only permission.</p>
      </div>
    </div>
  );
}

function SpeakButton({ text, onError }: { text: string; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-label="Hear this plan"
      disabled={busy || !text.trim()}
      onClick={() => {
        void (async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/speak", {
              method: "POST",
              headers: { "content-type": "application/json", ...(await authHeader()) },
              body: JSON.stringify({ text: text.slice(0, 500) }),
            });
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as { error?: string } | null;
              throw new Error(body?.error ?? "Could not speak that plan");
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => URL.revokeObjectURL(url);
            await audio.play();
          } catch (e) {
            onError(e instanceof Error ? e.message : "Speak failed");
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <Volume2 size={14} />
    </button>
  );
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
      const an = ctx.createAnalyser();
      an.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteFrequencyData(buf);
        setLevel([2, 5, 8, 11, 14].map((i) => (buf[i] ?? 0) / 255));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      r.onstop = async () => {
        cancelAnimationFrame(raf.current);
        void ctx.close();
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
          let final = "";
          let partial = "";
          const parser = createParser({
            onEvent: (ev) => {
              try {
                const d = JSON.parse(ev.data);
                if (d.type === "transcript.text.delta") partial += d.delta ?? "";
                if (d.type === "transcript.text.done") final = d.text ?? "";
              } catch {
                /* ignore */
              }
            },
          });
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            parser.feed(dec.decode(value, { stream: true }));
          }
          const t = (final || partial).trim();
          if (!t) throw new Error("I didn't catch that. Try again.");
          onText(t);
        } catch (e) {
          onError(e instanceof Error ? e.message : "Voice input failed.");
        }
        setState("idle");
      };
      rec.current = r;
      r.start();
      setState("rec");
    } catch {
      onError("Microphone access is needed for voice input.");
    }
  };

  return (
    <PromptInputButton
      aria-label={state === "rec" ? "Stop recording" : "Speak your money goal"}
      className={`bb-mic ${state === "rec" ? "is-live" : ""}`}
      disabled={state === "busy"}
      onClick={() => (state === "rec" ? rec.current?.stop() : void start())}
    >
      {state === "rec" ? <Square className="size-3.5" /> : <Mic className="size-4" />}
      {state === "rec" && (
        <span className="pk-wave" aria-hidden>
          {level.map((l, i) => (
            <i key={i} style={{ transform: `scaleY(${0.25 + l * 1.4})` }} />
          ))}
        </span>
      )}
    </PromptInputButton>
  );
}
