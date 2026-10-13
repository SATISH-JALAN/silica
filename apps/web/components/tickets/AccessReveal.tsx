"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, MOTION_OK } from "@/animations/gsap";
import { useWallet } from "@/lib/wallet";

const GLYPHS = "0123456789abcdef";

/** Pseudo ciphertext as it would appear in the AccessPosted event */
const cipherFor = (id: number) =>
  "0x" + Array.from({ length: 96 }, (_, i) => GLYPHS[(id * 31 + i * 17 + ((i * i) % 7)) % 16]).join("");

/**
 * Access credentials arrive as a sealed box encrypted to the holder's X25519
 * key (derived from a wallet signature). Decryption happens in the browser.
 */
export function AccessReveal({ ticketId, provider }: { ticketId: number; provider: string }) {
  const scramble = useRef<HTMLElement>(null);
  const [state, setState] = useState<"locked" | "decrypting" | "open">("locked");
  const { address, connect } = useWallet();
  const cipher = cipherFor(ticketId);
  const plain = `ssh -p 2222 holder-${ticketId}@apac-3.${provider.toLowerCase().replace(/\s+/g, "")}.node  # key: ~/.silica/${ticketId}.pem`;

  // the scramble writes to an element React renders without children
  useEffect(() => {
    if (state !== "decrypting") return;
    const el = scramble.current!;
    if (!window.matchMedia(MOTION_OK).matches) {
      setState("open");
      return;
    }
    const p = { t: 0 };
    const tween = gsap.to(p, {
      t: 1,
      duration: 1.4,
      ease: "power2.inOut",
      onUpdate: () => {
        const n = Math.floor(p.t * plain.length);
        let out = plain.slice(0, n);
        for (let i = n; i < plain.length; i++) out += plain[i] === " " ? " " : GLYPHS[Math.floor(Math.random() * 16)];
        el.textContent = out;
      },
      onComplete: () => setState("open"),
    });
    return () => {
      tween.kill();
    };
  }, [state, plain]);

  const reveal = () => (address ? setState("decrypting") : connect());
  const cls = `num mt-3 block break-all text-[11px] leading-relaxed ${state === "locked" ? "text-ash" : "text-gold-hot"}`;

  return (
    <div className="rounded-xl border border-line bg-void/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label !text-[9px]">{state === "open" ? "Access · decrypted locally" : "AccessPosted · encrypted to your key"}</p>
        {state !== "open" && (
          <button onClick={reveal} disabled={state === "decrypting"} className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] text-cream transition-colors hover:border-gold disabled:opacity-50">
            {!address ? "Connect to decrypt" : state === "decrypting" ? "Decrypting…" : "Decrypt with wallet"}
          </button>
        )}
      </div>
      {state === "decrypting" ? <code ref={scramble} className={cls} /> : <code className={cls}>{state === "open" ? plain : cipher}</code>}
      <p className="mt-3 text-[10px] text-ash">The key pair is derived from a wallet signature, so nothing is stored. Credentials never touch a server or chain storage in plaintext.</p>
    </div>
  );
}
