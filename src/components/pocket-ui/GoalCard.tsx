import { useState } from "react";
import { X } from "lucide-react";

/* Human-in-the-loop goal builder: one question at a time, single-choice
 * auto-advances, custom answers allowed, then composes a money-plan prompt. */
type Q = { q: string; key: string; options: string[] };
const QUESTIONS: Q[] = [
  { key: "goal", q: "What do you want your money to do?", options: ["Save for something", "Pay off debt", "Build an emergency fund", "Budget my monthly pay"] },
  { key: "when", q: "By when?", options: ["3 months", "6 months", "12 months"] },
  { key: "income", q: "Roughly what comes in each month?", options: ["Under $1,500", "$1,500 – $3,000", "$3,000 – $6,000", "Over $6,000"] },
];

export function GoalCard({ onComplete, onDismiss }: { onComplete: (prompt: string) => void; onDismiss: () => void }) {
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState("");
  const q = QUESTIONS[qi]!;
  const last = qi === QUESTIONS.length - 1;

  const commit = (value: string) => {
    const next = { ...answers, [q.key]: value };
    setAnswers(next);
    setCustom("");
    if (last) {
      onComplete(`Make me a money plan. Goal: ${next["goal"]}. Timeline: ${next["when"]}. Monthly income: ${next["income"]}.`);
    } else setTimeout(() => setQi(qi + 1), 260);
  };

  return (
    <div className="pk-card pk-goal" key={qi}>
      <button className="pk-icon-btn pk-goal-x" aria-label="Dismiss" onClick={onDismiss}><X size={14} /></button>
      <div className="pk-card-pad">
        <div className="pk-goal-q">{q.q}</div>
        <div className="pk-goal-opts">
          {q.options.map((o) => (
            <button key={o} type="button" aria-pressed={answers[q.key] === o} onClick={() => commit(o)}>
              <span className="pk-radio" />{o}
            </button>
          ))}
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { e.preventDefault(); commit(custom.trim()); } }}
            placeholder="Something else…"
            aria-label="Custom answer"
          />
        </div>
      </div>
      <div className="pk-card-foot">
        <span className="pk-step">{qi + 1} / {QUESTIONS.length}</span>
        <div className="pk-foot-actions">
          {qi > 0 && <button className="pk-btn pk-btn-ghost" onClick={() => setQi(qi - 1)}>Back</button>}
          <button className="pk-btn pk-btn-dark" disabled={!custom.trim()} onClick={() => commit(custom.trim())}>{last ? "Build plan" : "Continue"} <kbd>⏎</kbd></button>
        </div>
      </div>
    </div>
  );
}
