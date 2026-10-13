/**
 * The SILICA wordmark drawn as strokes: squared-round S and C, a crossbar-less Λ,
 * wide tracking. Each letter is its own path so it can be drawn in with DrawSVG.
 */
export const WORDMARK_PATHS = [
  "M36 5.6 H10 Q3.6 5.6 3.6 12 V14 Q3.6 20 10 20 H30 Q36.4 20 36.4 26 V28 Q36.4 34.4 30 34.4 H2", // S
  "M58 4 V36", // I
  "M81.6 4 V34.4 H110", // L
  "M132 4 V36", // I
  "M186 5.6 H162 Q155.6 5.6 155.6 12 V28 Q155.6 34.4 162 34.4 H186", // C
  "M207.5 36 L227 5 L246.5 36", // Λ
];

export function Wordmark({
  className = "",
  strokeWidth = 3.2,
  title = "Silica",
}: {
  className?: string;
  strokeWidth?: number;
  title?: string;
}) {
  return (
    <svg viewBox="0 0 250 40" className={className} role="img" aria-label={title} fill="none">
      {WORDMARK_PATHS.map((d, i) => (
        <path key={i} d={d} className="wm-stroke" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="miter" strokeLinecap="butt" />
      ))}
    </svg>
  );
}
