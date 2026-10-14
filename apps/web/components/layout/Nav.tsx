"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, ScrollTrigger, MOTION_OK } from "@/animations/gsap";
import { Emblem } from "@/components/brand/Emblem";
import { Wordmark } from "@/components/brand/Wordmark";
import { useWallet } from "@/lib/wallet";
import { useAccountModal } from "@rainbow-me/rainbowkit";
import { shortAddr } from "@/lib/format";

const LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/provider", label: "Provider" },
  { href: "/tickets", label: "Tickets" },
  { href: "/status", label: "Status" },
  // the static VitePress site: opened in a new tab, since it is not a client-side route of the app
  { href: "/docs", label: "Docs", doc: true },
];

export function Nav() {
  const path = usePathname();
  const root = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { address, chainOk, connecting, connect, disconnect, error, switchToMonad } = useWallet();
  const { openAccountModal } = useAccountModal();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => setOpen(false), [path]);

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // On the landing page the bar slips away while you read down and returns on the way up
  useGSAP(
    () => {
      if (path !== "/") return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        let hidden = false;
        const st = ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: (self) => {
            const hide = self.direction === 1 && self.scroll() > 240 && !openRef.current;
            if (hide === hidden) return;
            hidden = hide;
            gsap.to(root.current, { yPercent: hide ? -110 : 0, duration: hide ? 0.45 : 0.6, ease: hide ? "power2.in" : "expo.out", overwrite: true });
          },
        });
        return () => {
          st.kill();
          gsap.set(root.current, { yPercent: 0 });
        };
      });
    },
    { dependencies: [path], revertOnUpdate: true },
  );

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(".nav-item", { y: -14, opacity: 0, stagger: 0.05, duration: 0.7, delay: 0.15, ease: "power3.out" });
      });
    },
    { scope: root },
  );

  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <header
      ref={root}
      className={`fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-500 ${
        scrolled || open ? "border-b border-line bg-void/70 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="nav-item group flex items-center gap-3" aria-label="Silica home">
          <Emblem size={26} className="transition-transform duration-700 group-hover:rotate-[20deg]" />
          <Wordmark className="h-[13px] w-auto text-cream" strokeWidth={4} />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href} className="nav-item">
              {l.doc ? (
                <a href={l.href} target="_blank" rel="noopener" className="relative rounded-full px-4 py-2 text-[13px] tracking-wide text-dust transition-colors hover:text-cream">
                  {l.label} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <Link
                  href={l.href}
                  className={`relative rounded-full px-4 py-2 text-[13px] tracking-wide transition-colors ${
                    isActive(l.href) ? "text-cream" : "text-dust hover:text-cream"
                  }`}
                >
                  {l.label}
                  <span
                    className={`absolute inset-x-4 -bottom-px h-px bg-gradient-to-r from-transparent via-gold to-transparent transition-opacity duration-500 ${
                      isActive(l.href) ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <span className="nav-item hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[11px] text-dust lg:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bid opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-bid" />
            </span>
            Monad Testnet · <span className="num">10143</span>
          </span>
          <button
            onClick={!address ? connect : !chainOk ? switchToMonad : openAccountModal ?? disconnect}
            title={error ?? undefined}
            className="nav-item rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-[12px] font-medium text-cream transition-[color,background-color,border-color,box-shadow] hover:border-gold hover:bg-gold/20"
          >
            {connecting ? "Connecting…" : address ? <span className="num">{shortAddr(address)}{chainOk ? "" : " · switch network"}</span> : "Connect wallet"}
          </button>
          <button
            className="nav-item flex h-9 w-9 items-center justify-center rounded-full border border-line md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
          >
            <span className="relative block h-2.5 w-4">
              <span className={`absolute left-0 top-0 h-px w-4 bg-cream transition ${open ? "translate-y-[5px] rotate-45" : ""}`} />
              <span className={`absolute bottom-0 left-0 h-px w-4 bg-cream transition ${open ? "-translate-y-[4px] -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </nav>
      {open && (
        <ul className="border-t border-line px-4 pb-4 md:hidden">
          {LINKS.map((l) => (
            <li key={l.href}>
              {l.doc ? (
                <a href={l.href} target="_blank" rel="noopener" className="block py-3 text-sm text-dust">
                  {l.label} ↗
                </a>
              ) : (
                <Link href={l.href} className={`block py-3 text-sm ${isActive(l.href) ? "text-cream" : "text-dust"}`}>
                  {l.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
