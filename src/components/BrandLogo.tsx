export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-logo ${compact ? "brand-logo--compact" : ""}`} role="img" aria-label="POCKET">
      <span className="brand-mark" aria-hidden="true"><i /></span>
      <span className="brand-word">POCKET</span>
    </span>
  );
}