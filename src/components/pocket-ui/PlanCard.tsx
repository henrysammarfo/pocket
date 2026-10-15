type PlanStep = {
  when: string;
  label: string;
  amountLabel: string;
};

type PlanCardProps = {
  steps: PlanStep[];
  onApprove: () => void;
  onEdit?: () => void;
  busy?: boolean;
};

/** Beebah structured plan card + Approve / Edit CTAs. */
export function PlanCard({ steps, onApprove, onEdit, busy }: PlanCardProps) {
  return (
    <div className="bb-plan">
      <div className="bb-plan-head">
        <h3>Here is your plan</h3>
        <p>We turned your sentence into a well structured plan</p>
      </div>
      <div className="bb-plan-card">
        {steps.map((s) => (
          <div key={`${s.when}-${s.label}`} className="bb-plan-row">
            <div className="bb-plan-when">
              <span>{s.when}</span>
              <img src="/brand/icon-more.svg" alt="" width={14} height={14} aria-hidden />
            </div>
            <div className="bb-plan-line">
              <span>{s.label}</span>
              <strong>{s.amountLabel}</strong>
            </div>
          </div>
        ))}
        {steps.length === 0 && (
          <div className="bb-plan-row">
            <div className="bb-plan-when"><span>Always</span></div>
            <div className="bb-plan-line"><span>Keep</span><strong>$500.00</strong></div>
          </div>
        )}
      </div>
      <div className="bb-plan-actions">
        <button type="button" className="pk-btn-primary" disabled={busy} onClick={onApprove}>
          Approve plan
        </button>
        <button type="button" className="bb-btn-ghost" disabled={busy} onClick={onEdit}>
          Edit plan
        </button>
      </div>
    </div>
  );
}

export function ReadingPlan() {
  return (
    <div className="bb-reading" aria-live="polite">
      <img className="bb-reading-spin" src="/brand/icon-spinner.svg" alt="" width={44} height={44} />
      <h3>Reading your plan</h3>
      <p>Turning your words into a clear money plan</p>
    </div>
  );
}
