import { useEffect, useRef } from "react";
import { authHeader } from "@/hooks/useAuth";

type BlockScreenProps = {
  message: string;
  bufferCents: number;
  planCatch?: string;
  rentPaidNote?: string;
  /** Auto-speak the demo tagline once when the block appears. Default true. */
  autoSpeak?: boolean;
  onDismiss?: () => void;
};

/** Beebah blocked sheet — lock, reason, Keep rule, Go back. */
export function BlockScreen({
  message,
  bufferCents,
  planCatch,
  rentPaidNote,
  autoSpeak = true,
  onDismiss,
}: BlockScreenProps) {
  const dollars = (bufferCents / 100).toFixed(0);
  const reason =
    bufferCents > 0
      ? `Sending would leave you under $${dollars}.`
      : "No approved plan can cover this.";
  const tagline = `A message said send the rest. Your $${dollars} stayed. Nothing moved.`;
  const spokenFor = useRef<string | null>(null);

  useEffect(() => {
    if (!autoSpeak) return;
    const speakKey = `${message}|${bufferCents}`;
    if (spokenFor.current === speakKey) return;
    spokenFor.current = speakKey;

    let cancelled = false;
    let objectUrl: string | null = null;
    let audio: HTMLAudioElement | null = null;

    void (async () => {
      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "content-type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({ text: tagline.slice(0, 500) }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        audio = new Audio(objectUrl);
        audio.onended = () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        };
        await audio.play();
      } catch {
        /* speak-back is best-effort for the demo beat */
      }
    })();

    return () => {
      cancelled = true;
      audio?.pause();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [autoSpeak, message, bufferCents, tagline]);

  return (
    <div className="pk-block-scrim" role="dialog" aria-modal="true" aria-labelledby="pk-block-title">
      <section className="pk-block">
        <div className="pk-block-icon" aria-hidden>
          <span>
            <span>
              <img src="/brand/lock.svg" alt="" width={40} height={40} />
            </span>
          </span>
        </div>
        <p id="pk-block-title" className="pk-block-eyebrow">
          Blocked
        </p>
        <h2 className="pk-block-message">“{message}”</h2>
        <p className="pk-block-reason">{reason}</p>
        <div className="pk-block-rule">
          <p className="pk-block-rule-when">Always</p>
          <div className="pk-block-rule-row">
            <span>Keep</span>
            <strong>${dollars}</strong>
          </div>
          {planCatch && <p className="pk-block-catch">Caught by plan rule: {planCatch}</p>}
        </div>
        {rentPaidNote && <p className="pk-block-rent">{rentPaidNote}</p>}
        <p className="pk-block-tagline">{tagline}</p>
        <button type="button" className="pk-btn-primary pk-block-dismiss" onClick={onDismiss}>
          Go back
        </button>
      </section>
    </div>
  );
}
