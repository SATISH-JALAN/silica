import { useId } from "react";

/**
 * Vector version of the Silica planet emblem for small sizes (nav, buttons).
 * A lit champagne sphere cut by a glowing arc; the lower lens is in shadow and
 * its tip slips past the rim, as in the art-style logo.
 */
export function Emblem({ size = 28, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${id}-sphere`} cx="68%" cy="26%" r="80%">
          <stop offset="0%" stopColor="#f6e6c8" />
          <stop offset="45%" stopColor="#bfa47c" />
          <stop offset="100%" stopColor="#2b2219" />
        </radialGradient>
        <linearGradient id={`${id}-lens`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1b1510" />
          <stop offset="70%" stopColor="#3a2e22" />
          <stop offset="100%" stopColor="#e9c48d" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <circle cx="52" cy="46" r="38" fill={`url(#${id}-sphere)`} />
      <path d="M10 50 C 40 44, 70 58, 88 86 C 66 92, 40 90, 26 80 C 16 72, 11 62, 10 50 Z" fill={`url(#${id}-lens)`} />
      <path d="M4 51 C 40 44, 70 58, 88 86" stroke="#ffcf8a" strokeWidth="3" fill="none" filter={`url(#${id}-glow)`} opacity="0.9" />
      <path d="M4 51 C 40 44, 70 58, 88 86" stroke="#fff0d6" strokeWidth="1.1" fill="none" />
    </svg>
  );
}
