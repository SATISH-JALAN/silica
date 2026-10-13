/** Four-point star from the art style, with long hairline rays */
export function Sparkle({ size = 18, className = "", style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} style={style} aria-hidden>
      <path d="M20 0 L21.2 18.8 L40 20 L21.2 21.2 L20 40 L18.8 21.2 L0 20 L18.8 18.8 Z" fill="#ffe2b0" />
      <circle cx="20" cy="20" r="2.4" fill="#fff6e6" />
    </svg>
  );
}
