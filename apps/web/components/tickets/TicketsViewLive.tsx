"use client";

import { useEffect, useRef, useState } from "react";
import { useReadContract, useSignMessage } from "wagmi";
import type { Address, Hex } from "viem";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { DemoBadge, Field, PageHeader, Row, Select, Toast } from "@/components/ui/kit";
import { NumberRoll } from "@/components/ui/motion";
import { ACCESS_KEY_MESSAGE, keyPairFromSignature, openSealed } from "@silica/shared/crypto";
import { redemptionManagerAbi } from "@silica/shared/abis";
import { SERIES_LIST, tokenOf } from "@/lib/series";
import { A, useBalances, useSeriesLive } from "@/lib/onchain";
import { HAS_ENVIO, useTicketsOf, type ETicket } from "@/lib/envio";
import { useNow } from "@/lib/live";
import type { Ticket } from "@/lib/mock";
import { ACCESS_DEADLINE_MIN, slashPayout } from "@/lib/units";
import { countdown, int, shortAddr, usd, utcDay } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { explain, txUrl, useSend } from "@/lib/tx";
import { TicketCard } from "./TicketsView";

const PROBE = process.env.NEXT_PUBLIC_PROBE_ADDRESS as Address | undefined;
const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL;
const PROBE_URL = process.env.NEXT_PUBLIC_PROBE_URL;
const NAMES: Record<string, string> = {
  [(process.env.NEXT_PUBLIC_PROVIDER_A ?? "").toLowerCase()]: "NeoGPU",
  [(process.env.NEXT_PUBLIC_PROVIDER_B ?? "").toLowerCase()]: "Basalt Cloud",
};
const STATUS = ["Open", "AccessPosted", "Settled"] as const;

/** Envio ticket → the shape the timeline and card animate */
function fromEnvio(t: ETicket): Ticket & { ciphertext: string } {
  const timeline: Ticket["timeline"] = Array.from({ length: t.hours }, () => null);
  for (const v of t.verdicts) if (v.hour < t.hours) timeline[v.hour] = v.kind;
  const series = SERIES_LIST.find((s) => s.seriesId === Number(t.series_id));
  return {
    id: Number(t.id),
    seriesCode: series?.code ?? `series ${t.series_id}`,
    provider: NAMES[t.provider_id] ?? shortAddr(t.provider_id),
    hours: t.hours,
    confirmed: t.confirmed,
    missed: t.missed,
    disputed: t.disputed,
    priceAtOpen: Number(t.priceAtOpen) / 1e6,
    status: t.status,
    openedAt: new Date(Number(t.openedAt) * 1000).toUTCString().slice(5, 22) + " UTC",
    timeline,
    ciphertext: t.ciphertext,
  };
}

/** Holder's X25519 key, derived from a wallet signature and kept in memory only */
function useHolderKey() {
  const { signMessageAsync } = useSignMessage();
  const [kp, setKp] = useState<{ publicKey: Hex; secretKey: Uint8Array } | null>(null);
  const derive = async () => {
    if (kp) return kp;
    const sig = await signMessageAsync({ message: ACCESS_KEY_MESSAGE });
    const k = keyPairFromSignature(sig);
    setKp(k);
    return k;
  };
  return { kp, derive };
}

export function TicketsViewLive() {
  const root = useRef<HTMLDivElement>(null);
  const now = useNow();
  const { address, connect } = useWallet();
  const marks = useSeriesLive().map;
  const holderKey = useHolderKey();
  const { send, pending } = useSend();

  const redeemable = SERIES_LIST.filter((s) => now >= s.deliveryStart.getTime() && now <= s.deliveryEnd.getTime());
  const [sel, setSel] = useState(SERIES_LIST[0].seriesId);
  const series = SERIES_LIST.find((s) => s.seriesId === sel)!;
  const mark = marks.get(sel)?.mark ?? series.mark;
  const bal = useBalances(address, tokenOf(series));
  const [hours, setHours] = useState("5");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: React.ReactNode } | null>(null);
  const [mode, setMode] = useState<"healthy" | "outage" | "probe">("healthy");

  // tickets: Envio history (with per-hour verdicts); open tickets from chain otherwise
  const envio = useTicketsOf(address);
  const open = useReadContract({ address: A.rm, abi: redemptionManagerAbi, functionName: "getOpenTickets", args: [0n, 200n], query: { enabled: !HAS_ENVIO && !!address, refetchInterval: 3_000 } });
  const tickets: (Ticket & { ciphertext: string })[] = HAS_ENVIO
    ? (envio.data?.Ticket ?? []).map(fromEnvio)
    : open.data
      ? open.data[0]
          .map((id, i) => ({ id, t: open.data![1][i] }))
          .filter(({ t }) => t.holder.toLowerCase() === address?.toLowerCase())
          .map(({ id, t }) => ({
            id: Number(id),
            seriesCode: SERIES_LIST.find((s) => s.seriesId === Number(t.seriesId))?.code ?? "",
            provider: NAMES[t.provider.toLowerCase()] ?? shortAddr(t.provider),
            hours: t.hrs,
            confirmed: t.confirmed,
            missed: t.missed,
            disputed: t.disputed,
            priceAtOpen: Number(t.priceAtOpen) / 1e6,
            status: STATUS[t.status],
            openedAt: new Date(Number(t.openedAt) * 1000).toUTCString().slice(5, 22) + " UTC",
            // without the indexer the per-hour order is unknown; show counts in sequence
            timeline: [
              ...Array<"confirmed">(t.confirmed).fill("confirmed"),
              ...Array<"missed">(t.missed).fill("missed"),
              ...Array<"disputed">(t.disputed).fill("disputed"),
              ...Array<null>(Math.max(0, t.hrs - t.confirmed - t.missed - t.disputed)).fill(null),
            ],
            ciphertext: "",
          }))
      : [];

  const inWindow = now >= series.deliveryStart.getTime() && now <= series.deliveryEnd.getTime();
  const h = Number(hours);
  const err = !Number.isInteger(h) || h <= 0 ? "NotWholeHours: redeem whole GPU-hours" : address && h > bal.hours ? "Insufficient tokens" : null;

  useEffect(() => {
    if (redeemable[0] && !redeemable.some((s) => s.seriesId === sel)) setSel(redeemable[0].seriesId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redeemable.length]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(".tk-panel", { y: 30, opacity: 0, stagger: 0.08, duration: 0.7, delay: 0.25 });
      });
    },
    { scope: root },
  );

  const redeem = async () => {
    if (!address) return connect();
    if (!inWindow) return setMsg({ tone: "err", text: `OutsideDeliveryWindow: W${series.week} opens ${utcDay(series.deliveryStart)} 00:00 UTC` });
    if (err) return setMsg({ tone: "err", text: err });
    if (!PROBE) return setMsg({ tone: "err", text: "No buyer-probe configured (NEXT_PUBLIC_PROBE_ADDRESS)" });
    setMsg(null);
    try {
      const kp = await holderKey.derive();
      const r = await send("Redeeming", { address: A.rm, abi: redemptionManagerAbi, functionName: "redeem", args: [BigInt(sel), h, kp.publicKey, PROBE] });
      void bal.refetch();
      setMsg({
        tone: r.ok ? "ok" : "err",
        text: (
          <>
            {r.ok ? `Burned ${int(h)} tokens · ticket opened · access due within ${ACCESS_DEADLINE_MIN} min` : "redeem reverted"} ·{" "}
            <a className="underline" href={txUrl(r.hash)} target="_blank" rel="noreferrer">
              tx ↗
            </a>
          </>
        ),
      });
    } catch (e) {
      setMsg({ tone: "err", text: explain(e) });
    }
  };

  const control = async (m: "healthy" | "outage" | "probe") => {
    setMode(m);
    const post = (u?: string) => (u ? fetch(u, { method: "POST" }).catch(() => null) : null);
    if (m === "healthy") await Promise.all([post(AGENT_URL && `${AGENT_URL}/demo/recover?provider=all`), post(PROBE_URL && `${PROBE_URL}/demo/recover`)]);
    if (m === "outage") await Promise.all([post(AGENT_URL && `${AGENT_URL}/demo/fail?provider=all`), post(PROBE_URL && `${PROBE_URL}/demo/recover`)]);
    if (m === "probe") await Promise.all([post(AGENT_URL && `${AGENT_URL}/demo/recover?provider=all`), post(PROBE_URL && `${PROBE_URL}/demo/fail`)]);
  };

  return (
    <div ref={root}>
      <PageHeader label="Holder · redemptions" title="Redeem for real GPU time">
        <DemoBadge>Monad Testnet · 1 delivery hour = {Math.round(Number(process.env.NEXT_PUBLIC_HOUR_SECONDS ?? 300) / 60)} min (demo)</DemoBadge>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className="tk-panel panel p-6">
            <p className="label">Redeem</p>
            <div className="mt-5 space-y-3">
              <Select label="Series" value={String(sel)} onChange={(v) => setSel(Number(v))} options={SERIES_LIST.map((s) => ({ value: String(s.seriesId), label: `${s.code}${redeemable.includes(s) ? " · delivering" : ""}` }))} />
              <Field
                label="GPU-hours to redeem"
                suffix="hours"
                type="number"
                step="1"
                min="1"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                error={err}
                hint={
                  address ? (
                    <>
                      Balance <NumberRoll value={bal.hours} format={(n) => `${int(n)} h`} snap={1} /> of {series.code}
                    </>
                  ) : (
                    "Connect to see your balance"
                  )
                }
              />
            </div>
            <div className="mt-3 rounded-lg border border-line bg-void/40 px-3 py-2">
              <Row k="Delivery window" v={`${utcDay(series.deliveryStart)} → ${utcDay(series.deliveryEnd)}`} />
              <Row k="Window" v={now === 0 ? "…" : inWindow ? "open" : now < series.deliveryStart.getTime() ? `opens in ${countdown(series.deliveryStart.getTime() - now)}` : "closed"} tone={inWindow ? "text-bid" : "text-warn"} />
              <Row k="Price fixed for slashes" v={`$${mark.toFixed(2)} / h`} />
              <Row k="Slash per missed hour" v={usd(slashPayout(1, mark))} tone="text-gold-hot" />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-dust">
              You sign one message to derive your decryption key (no gas, nothing stored). The provider seals your access to that key; an independent probe checks delivery.
            </p>
            <button onClick={redeem} disabled={!!pending} className="mt-4 w-full rounded-full bg-cream py-3 text-sm font-semibold text-void transition-shadow hover:shadow-[0_0_30px_rgba(255,205,140,0.35)] disabled:opacity-50">
              {!address ? "Connect wallet to redeem" : pending ? `${pending}…` : "redeem() · burn & open ticket"}
            </button>
            <Toast show={!!msg} tone={msg?.tone}>
              {msg?.text}
            </Toast>
          </section>

          {(AGENT_URL || PROBE_URL) && (
            <section className="tk-panel panel p-6">
              <p className="label">Delivery evidence · demo controls</p>
              <p className="mt-3 text-[12px] leading-relaxed text-dust">
                The testnet provider node is simulated (FAKE_GPU). These switch what the next delivery hours look like; CRE then confirms, slashes or holds them onchain.
              </p>
              <div className="mt-4 grid gap-2">
                {(
                  [
                    ["healthy", "Both up", "confirmed", "text-bid border-bid/40 bg-bid/10"],
                    ["outage", "Provider outage", "missed → slashed", "text-ask border-ask/40 bg-ask/10"],
                    ["probe", "Sources disagree", "disputed, held", "text-warn border-warn/40 bg-warn/10"],
                  ] as const
                ).map(([m, label, out, cls]) => (
                  <button
                    key={m}
                    onClick={() => void control(m)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[12px] transition-colors ${mode === m ? cls : "border-line text-dust hover:text-cream"}`}
                  >
                    <span>{label}</span>
                    <span className="num text-[10px] opacity-80">{out}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-5">
          {!address && <p className="panel p-6 text-[13px] text-dust">Connect a wallet to see your redemption tickets.</p>}
          {address && tickets.length === 0 && <p className="panel p-6 text-[13px] text-dust">No tickets yet. Buy W42 hours on the markets page, then redeem them here.</p>}
          {tickets.map((t) => (
            <TicketCard key={t.id} t={t} access={<SealedAccess ticketId={t.id} ciphertext={t.ciphertext} derive={holderKey.derive} />} />
          ))}
        </div>
      </div>
    </div>
  );
}

const GLYPHS = "0123456789abcdef";

/** The AccessPosted ciphertext, opened in the browser with the signature-derived key */
function SealedAccess({ ticketId, ciphertext, derive }: { ticketId: number; ciphertext: string; derive: () => Promise<{ secretKey: Uint8Array }> }) {
  const scramble = useRef<HTMLElement>(null);
  const [state, setState] = useState<"locked" | "decrypting" | "open" | "error">("locked");
  const [plain, setPlain] = useState("");

  useEffect(() => {
    if (state !== "decrypting" || !plain) return;
    const el = scramble.current!;
    if (!window.matchMedia(MOTION_OK).matches) return setState("open");
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
    // rAF is throttled in background tabs: never leave the credentials mid-scramble
    const done = setTimeout(() => setState("open"), 2_000);
    return () => {
      tween.kill();
      clearTimeout(done);
    };
  }, [state, plain]);

  const reveal = async () => {
    try {
      const kp = await derive();
      const opened = ciphertext ? openSealed(ciphertext as Hex, kp.secretKey) : null;
      if (!opened) return setState("error");
      const c = JSON.parse(opened) as { host: string; port: number; user: string; token: string; gpu: string };
      setPlain(`ssh -p ${c.port} ${c.user}@${c.host}   # token ${c.token} · ${c.gpu}`);
      setState("decrypting");
    } catch {
      setState("error");
    }
  };

  const cls = `num mt-3 block break-all text-[11px] leading-relaxed ${state === "locked" || state === "error" ? "text-ash" : "text-gold-hot"}`;
  return (
    <div className="rounded-xl border border-line bg-void/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label !text-[9px]">{state === "open" ? "Access · decrypted locally" : `AccessPosted · ticket #${ticketId} · sealed to your key`}</p>
        {state !== "open" && (
          <button onClick={reveal} disabled={state === "decrypting" || !ciphertext} className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] text-cream transition-colors hover:border-gold disabled:opacity-50">
            {state === "decrypting" ? "Decrypting…" : "Decrypt with wallet"}
          </button>
        )}
      </div>
      {state === "decrypting" ? (
        <code ref={scramble} className={cls} />
      ) : (
        <code className={cls}>{state === "open" ? plain : state === "error" ? "Could not open: this ticket was sealed to a different key." : ciphertext ? `${ciphertext.slice(0, 120)}…` : "ciphertext available once indexed"}</code>
      )}
      <p className="mt-3 text-[10px] text-ash">The key pair comes from a wallet signature, so nothing is stored. Credentials never touch a server or chain storage in plaintext.</p>
    </div>
  );
}
