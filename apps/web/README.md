# Silica web

Next.js (App Router) frontend for Silica: deliverable GPU-hour forwards on Monad.
Styled from `/art-style` and animated with GSAP (ScrollTrigger, ScrollSmoother, SplitText, Flip, DrawSVG).

```bash
pnpm install        # from the repo root
pnpm dev            # http://localhost:3000
pnpm build
```

## Routes

| Route | What it shows |
| --- | --- |
| `/` | Scroll story: once-per-session intro, hero from the key art (instrument ring), pinned manifesto (the gap), kinetic lifecycle type, pinned lifecycle orbit, pinned worked example (100 h, 10 missed, $30.75 slash), forward curve, why Monad, closing. Hero flies through the planet on exit, depth dust that streaks at speed, cursor spotlights, decoding labels, giant closing wordmark. Custom cursor, magnetic CTAs, auto-hiding nav and a chapter rail on desktop |
| `/markets` | Forward curve (live marks glide), series cards with bond coverage |
| `/markets/[seriesId]` | Trading screen: candles, live order book (Flip re-sort, size flash), order form with min-notional / whole-hour rules and slash disclosure, bond & risk panel |
| `/provider` | Bond deposit, mint with live mint-rule check, node key, positions with margin-call status |
| `/tickets` | Redeem, live ticket timeline (demo hours every 1.8 s), outage / dispute toggles, encrypted access reveal |
| `/status` | Network, contract addresses, CRE reports, disclosures |

## Layout

- `animations/gsap.ts` registers plugins once; every animation runs in `useGSAP` with a scope and is wrapped in `gsap.matchMedia` so `prefers-reduced-motion` gets the final state.
- `components/ui/motion.tsx` holds the shared motion primitives (`SmoothScroll`, `Reveal`, `SplitReveal`, `ScrubText`, `NumberRoll`).
- `lib/mock.ts` is seeded demo data shaped like the Envio schema; `lib/live.ts` simulates the Kuru feed. Swap these for Envio GraphQL and the Kuru WebSocket when they are live.
- `lib/units.ts` mirrors the contract rules (mint check, slash payout, 11-of-12 verdict) for previews only.
- `lib/wallet.tsx` is a minimal injected-wallet connector for Monad Testnet (chain 10143), standing in for wagmi + RainbowKit.

## Motion gotchas (learned the hard way)

- Don't put Tailwind's catch-all `transition` class on an element GSAP animates; CSS transitions on opacity/transform fight the tween. Use `transition-colors` or explicit properties.
- Don't use Tailwind `scale-*` / `translate-*` / `rotate-*` on GSAP targets; Tailwind v4 uses the separate `scale`/`translate` CSS properties, which stack with GSAP's `transform`.
- Avoid `once: true` on ScrollTriggers; when the page loads already scrolled past them they kill themselves mid-refresh and crash later `ScrollTrigger.create` calls. Use `toggleActions: "play none none none"`.
- A trigger whose section *contains* a pinned stage (the chapter rail) needs `refreshPriority: -1`, or it measures the section before the pin adds its spacing.
- Fixed layers (cursor, rail, intro) must render outside `#smooth-content`; ScrollSmoother transforms it, which breaks `position: fixed` inside.
- Never create ScrollTriggers inside SplitText `onSplit` with `autoSplit`; re-splits feed a refresh loop.
- One owner per node: if an intro tween and a scroll/pointer tween animate the same element, GSAP reverts them by start time and can restore the intro's hidden frame (StrictMode remount, breakpoint change). The hero animates inner nodes in the intro and wrappers (`-wrap`, `-fly`) on scroll.
- The landing sets `history.scrollRestoration = "manual"` and starts at the top (or the `#anchor`): browser restoration races ScrollTrigger's first refresh and lands mid-pin.
- A CSS `clip-path` reveal clips glows too; use negative insets when the content has a blur or shadow.

Everything is testnet-only and simulated until the contracts, Kuru markets and Envio indexer are deployed. The UI says so wherever it matters.
