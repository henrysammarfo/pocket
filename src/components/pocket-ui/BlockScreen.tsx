import { useEffect, useRef } from "react";
import { authHeader } from "@/hooks/useAuth";

type BlockScreenProps = {
  message: string;
  bufferCents: number;
  planCatch?: string;
  rentPaidNote?: string;
  /** Auto-speak the demo tagline once when the block appears. Default true. */
  autoSpeak?: boolean;
};

/** Demo beat: open on the block — message, buffer, nothing moved. */
export function BlockScreen({
  message,
  bufferCents,
  planCatch,
  rentPaidNote,
  autoSpeak = true,
}: BlockScreenProps) {
  const dollars = (bufferCents / 100).toFixed(0);
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
    <section className="pk-block" aria-live="polite">
      <p className="pk-block-eyebrow">POCKET blocked this</p>
      <h2 className="pk-block-message">“{message}”</h2>
      <p className="pk-block-buffer">
        <strong>${dollars}</strong> still here
      </p>
      <p className="pk-block-status">Nothing moved.</p>
      {planCatch && (
        <p className="pk-block-catch">
          Caught by plan rule: <span>{planCatch}</span>
        </p>
      )}
      {rentPaidNote && <p className="pk-block-rent">{rentPaidNote}</p>}
      <p className="pk-block-tagline">{tagline}</p>
    </section>
  );
}
