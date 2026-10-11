import { useEffect, useState } from "react";

/* Pixel-grid loader: chevron wavefront driving right, shimmer label, live timer. */
const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

export function LoaderGrid() {
  return (
    <span aria-hidden className="pk-grid">
      {chevron.map((delay, i) => <span key={i} style={{ animationDelay: `${delay}ms` }} />)}
    </span>
  );
}

function useElapsed() {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDs((d) => d + 1), 100);
    return () => clearInterval(t);
  }, []);
  const total = ds / 10;
  return total < 60 ? `${total.toFixed(1)}s` : `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export function LoadingState({ label = "Building your plan" }: { label?: string }) {
  const elapsed = useElapsed();
  return (
    <div role="status" className="pk-loading">
      <LoaderGrid />
      <span className="pk-shimmer">{label}</span>
      <span className="pk-elapsed">{elapsed}</span>
    </div>
  );
}
