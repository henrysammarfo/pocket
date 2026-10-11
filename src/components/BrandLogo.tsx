/* POCKET mark: a pocket silhouette with a stitched hem and a guardrail tick.
 * Single-color friendly (uses currentColor + primary accent) for merch/print. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="brand-mark-svg">
      <path d="M6 8h36v18c0 10-8 16-18 16S6 36 6 26V8Z" fill="currentColor" />
      <path d="M10 14h28" stroke="var(--primary)" strokeWidth="2.5" strokeDasharray="3 3" />
      <path d="m16 26 6 6 11-12" fill="none" stroke="var(--primary)" strokeWidth="4.5" strokeLinecap="square" />
    </svg>
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`pk-logo ${compact ? "pk-logo--compact" : ""}`} role="img" aria-label="POCKET">
      <BrandMark size={compact ? 28 : 44} />
      <span className="pk-word">POCKET</span>
    </span>
  );
}
