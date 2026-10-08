import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createParser } from "eventsource-parser";
import { supabase } from "@/integrations/supabase/client";
import { authHeader } from "@/hooks/useAuth";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputButton, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { threadsKey } from "./app";

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
  if (isLoading) return <div className="app-loading">Loading conversation…</div>;
  if (error) return <div className="app-loading">This conversation could not be loaded.</div>;
  return <ChatWindow key={threadId} threadId={threadId} initial={data ?? []} />;
}

const SUGGESTIONS = [
  "Save $3,000 for a trip to Lisbon by June",
  "Pay off a $2,400 credit card without missing rent",
  "Build a 3-month emergency fund on a $2,800 salary",
];

function ChatWindow({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat", headers: authHeader, body: { threadId } }),
    onError: (e) => setErr(e.message || "Something went wrong."),
    onFinish: () => { qc.invalidateQueries({ queryKey: threadsKey }); qc.invalidateQueries({ queryKey: ["thread-messages", threadId] }); },
  });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => { if (!busy) taRef.current?.focus(); }, [busy]);

  const send = (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    setErr(null);
    sendMessage({ text: v });
    setText("");
  };

  return <div className="chat-window">
    <Conversation className="chat-scroll">
      <ConversationContent className="chat-content">
        {messages.length === 0 && <div className="chat-empty">
          <span className="chat-orb" aria-hidden="true"><i /></span>
          <h1>What's your money goal?</h1>
          <p>Type it or tap the mic. POCKET turns it into a plan with guardrails.</p>
          <div className="chat-suggestions">{SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>
        </div>}
        {messages.map((m) => <Message key={m.id} from={m.role}>
          <MessageContent className={m.role === "user" ? "chat-user" : "chat-assistant"}>
            {m.parts.map((p, i) => {
              if (p.type === "text") return m.role === "user" ? <p key={i}>{p.text}</p> : <MessageResponse key={i}>{p.text}</MessageResponse>;
              if (p.type === "reasoning" && p.text) return <Reasoning key={i} isStreaming={status === "streaming" && m.id === messages.at(-1)?.id}><ReasoningTrigger /><ReasoningContent>{p.text}</ReasoningContent></Reasoning>;
              return null;
            })}
          </MessageContent>
        </Message>)}
        {status === "submitted" && <Message from="assistant"><MessageContent className="chat-assistant"><Shimmer>Building your plan…</Shimmer></MessageContent></Message>}
        {err && <p className="chat-error" role="alert">{err}</p>}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
    <div className="chat-composer">
      <PromptInput onSubmit={(msg) => send(msg.text)}>
        <PromptInputTextarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe a goal, e.g. save $500 a month for a car…" autoFocus />
        <PromptInputFooter className="justify-between">
          <PromptInputTools><VoiceButton onText={(t) => { setText((cur) => (cur ? cur + " " : "") + t); taRef.current?.focus(); }} onError={setErr} /></PromptInputTools>
          <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} />
        </PromptInputFooter>
      </PromptInput>
      <p className="chat-disclaimer">Guidance, not regulated financial advice. No real money moves in this demo.</p>
    </div>
  </div>;
}

function VoiceButton({ onText, onError }: { onText: (t: string) => void; onError: (m: string) => void }) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
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
    aria-label={state === "rec" ? "Stop recording" : "Speak your goal"}
    className={state === "rec" ? "mic-live" : ""}
    disabled={state === "busy"}
    onClick={() => (state === "rec" ? rec.current?.stop() : start())}
  >
    {state === "rec" ? <Square className="size-4" /> : <Mic className="size-4" />}
    <span className="mic-label">{state === "rec" ? "Listening… tap to stop" : state === "busy" ? "Transcribing…" : ""}</span>
  </PromptInputButton>;
}
