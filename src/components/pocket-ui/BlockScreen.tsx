type BlockScreenProps = {
  message: string;
  bufferCents: number;
  planCatch?: string;
  rentPaidNote?: string;
};

/** Demo beat: open on the block — message, buffer, nothing moved. */
export function BlockScreen({ message, bufferCents, planCatch, rentPaidNote }: BlockScreenProps) {
  const dollars = (bufferCents / 100).toFixed(0);
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
      <p className="pk-block-tagline">A message said send the rest. Your ${dollars} stayed. Nothing moved.</p>
    </section>
  );
}
