/** Beebah / Titans logomark — forest spiral from Figma. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/brand/logo.svg"
      alt=""
      width={size}
      height={Math.round(size * 0.9)}
      className="brand-mark-svg"
      aria-hidden="true"
    />
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`pk-logo ${compact ? "pk-logo--compact" : ""}`} role="img" aria-label="Pocket">
      <BrandMark size={compact ? 20 : 28} />
      <span className="pk-word">Pocket</span>
    </span>
  );
}
