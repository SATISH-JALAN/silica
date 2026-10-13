"use client";

// Live chain state over Multicall3 (wagmi useReadContracts): marks, book depth, balances,
// allowances and provider positions. Used for everything that must be current to the block.

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { erc20Abi, keccak256, toBytes, type Address } from "viem";
import { bondVaultAbi, deliveryOracleAbi, mockUSDCAbi, redemptionManagerAbi, seriesRegistryAbi, silicaBookAbi } from "@silica/shared/abis";
import { kuru, kuruHours, kuruMarketOf, kuruOrderBookAbi, kuruPrice, kuruRouterAbi } from "@silica/shared/kuru";
import { DEPLOYMENT, LIVE, SERIES_LIST, tokenOf } from "./series";
import type { Level } from "./mock";

export const A = {
  usdc: DEPLOYMENT.MockUSDC as Address,
  registry: DEPLOYMENT.SeriesRegistry as Address,
  vault: DEPLOYMENT.BondVault as Address,
  rm: DEPLOYMENT.RedemptionManager as Address,
  oracle: DEPLOYMENT.DeliveryOracle as Address,
  book: DEPLOYMENT.SilicaBook as Address,
};

export const ROLE = { PROVIDER: keccak256(toBytes("PROVIDER_ROLE")) };

const px = (v: bigint) => Number(v) / 1e6;
const hrs = (v: bigint) => Number(v / 10n ** 18n);

export type SeriesLive = { seriesId: number; mark: number; bid: number | null; ask: number | null; supplyHours: number };

/** Mark, best bid/ask and outstanding supply for every series */
export function useSeriesLive() {
  const contracts = SERIES_LIST.flatMap((s) => [
    { address: A.registry, abi: seriesRegistryAbi, functionName: "getSeries", args: [BigInt(s.seriesId)] } as const,
    { address: A.book, abi: silicaBookAbi, functionName: "bestBidAsk", args: [BigInt(s.seriesId)] } as const,
    { address: tokenOf(s)!, abi: erc20Abi, functionName: "totalSupply" } as const,
  ]);
  const q = useReadContracts({ contracts, query: { enabled: LIVE, refetchInterval: 3_000 } });
  return useMemo(() => {
    const map = new Map<number, SeriesLive>();
    if (!q.data) return { map, ready: false };
    SERIES_LIST.forEach((s, i) => {
      const info = q.data[i * 3]?.result as { markPrice: bigint } | undefined;
      const ba = q.data[i * 3 + 1]?.result as readonly [bigint, bigint] | undefined;
      const sup = q.data[i * 3 + 2]?.result as bigint | undefined;
      if (!info) return;
      map.set(s.seriesId, {
        seriesId: s.seriesId,
        mark: px(info.markPrice),
        bid: ba && ba[0] > 0n ? px(ba[0]) : null,
        ask: ba && ba[1] > 0n ? px(ba[1]) : null,
        supplyHours: sup !== undefined ? hrs(sup) : 0,
      });
    });
    return { map, ready: true };
  }, [q.data]);
}

/** L2 depth for one series, best first */
export function useBookLive(seriesId: number, depth = 12) {
  const q = useReadContract({
    address: A.book,
    abi: silicaBookAbi,
    functionName: "depth",
    args: [BigInt(seriesId), BigInt(depth)],
    query: { enabled: LIVE, refetchInterval: 1_500 },
  });
  return useMemo(() => {
    if (!q.data) return { bids: [] as Level[], asks: [] as Level[], ready: false, refetch: q.refetch };
    const [bp, bh, ap, ah] = q.data;
    return {
      bids: bp.map((p, i) => ({ price: px(p), hours: Number(bh[i]) })),
      asks: ap.map((p, i) => ({ price: px(p), hours: Number(ah[i]) })),
      ready: true,
      refetch: q.refetch,
    };
  }, [q.data, q.refetch]);
}

/**
 * The series' Kuru Spot V2 book. Kuru creates markets (permissioned), so this reads the book
 * address SpotRouter.computeAddress predicts for our listing and only reads levels once
 * SpotRouter.verifiedSpotMarket says Kuru has deployed it.
 */
export function useKuruBook(seriesId: number, depth = 12) {
  const market = kuruMarketOf(seriesId);
  const verified = useReadContract({
    address: kuru.spotRouter,
    abi: kuruRouterAbi,
    functionName: "verifiedSpotMarket",
    args: [market!],
    query: { enabled: LIVE && !!market, refetchInterval: 30_000 },
  });
  const live = verified.data === true;
  const q = useReadContract({
    address: market!,
    abi: kuruOrderBookAbi,
    functionName: "getL2Book",
    args: [BigInt(depth)],
    query: { enabled: live, refetchInterval: 1_500 },
  });
  return useMemo(() => {
    const pp = kuru.params.pricePrecision;
    const sp = BigInt(kuru.params.sizePrecision);
    const side = (p: readonly number[], s: readonly bigint[]): Level[] =>
      p.flatMap((x, i) => {
        const price = kuruPrice(x, pp);
        return price === null || s[i] === 0n ? [] : [{ price, hours: kuruHours(s[i], sp) }];
      });
    const [bp, bs, ap, as] = q.data ?? [[], [], [], []];
    return { market, live, bids: side(bp, bs), asks: side(ap, as) };
  }, [market, live, q.data]);
}

/** USDC and series-token balances plus allowances to a spender */
export function useBalances(owner: Address | null | undefined, token?: Address, spender: Address = A.book) {
  const enabled = LIVE && !!owner;
  const contracts = [
    { address: A.usdc, abi: mockUSDCAbi, functionName: "balanceOf", args: [owner!] } as const,
    { address: A.usdc, abi: mockUSDCAbi, functionName: "allowance", args: [owner!, spender] } as const,
    ...(token
      ? ([
          { address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner!] },
          { address: token, abi: erc20Abi, functionName: "allowance", args: [owner!, spender] },
        ] as const)
      : []),
  ];
  const q = useReadContracts({ contracts, query: { enabled, refetchInterval: 3_000 } });
  const r = (i: number) => (q.data?.[i]?.result as bigint | undefined) ?? 0n;
  return {
    usdc: px(r(0)),
    usdcRaw: r(0),
    usdcAllowance: r(1),
    hours: token ? hrs(r(2)) : 0,
    tokenAllowance: token ? r(3) : 0n,
    ready: !!q.data,
    refetch: q.refetch,
  };
}

export type PositionLive = {
  seriesId: number;
  bond: number;
  minted: number;
  assigned: number;
  settled: number;
  marginCalled: boolean;
  ratioBps: number;
  required: number;
  mintable: number;
};

/** A provider's position in every series, with its requirement and headroom */
export function usePositions(provider: Address | null | undefined) {
  const enabled = LIVE && !!provider;
  const contracts = SERIES_LIST.flatMap((s) => [
    { address: A.vault, abi: bondVaultAbi, functionName: "positionOf", args: [provider!, BigInt(s.seriesId)] } as const,
    { address: A.vault, abi: bondVaultAbi, functionName: "bondRatioOf", args: [provider!, BigInt(s.seriesId)] } as const,
    { address: A.vault, abi: bondVaultAbi, functionName: "requiredBond", args: [provider!, BigInt(s.seriesId)] } as const,
    { address: A.vault, abi: bondVaultAbi, functionName: "mintableHours", args: [provider!, BigInt(s.seriesId)] } as const,
  ]);
  const q = useReadContracts({ contracts: [...contracts, { address: A.vault, abi: bondVaultAbi, functionName: "hasRole", args: [ROLE.PROVIDER, provider!] } as const], query: { enabled, refetchInterval: 3_000 } });
  return useMemo(() => {
    if (!q.data) return { positions: [] as PositionLive[], isProvider: false, ready: false, refetch: q.refetch };
    const positions = SERIES_LIST.map((s, i) => {
      const p = q.data[i * 4]?.result as { bond: bigint; minted: bigint; assigned: bigint; settled: bigint; marginCalled: boolean } | undefined;
      return {
        seriesId: s.seriesId,
        bond: p ? px(p.bond) : 0,
        minted: p ? Number(p.minted) : 0,
        assigned: p ? Number(p.assigned) : 0,
        settled: p ? Number(p.settled) : 0,
        marginCalled: p?.marginCalled ?? false,
        ratioBps: Number((q.data[i * 4 + 1]?.result as number | undefined) ?? 3000),
        required: px((q.data[i * 4 + 2]?.result as bigint | undefined) ?? 0n),
        mintable: Number((q.data[i * 4 + 3]?.result as bigint | undefined) ?? 0n),
      };
    });
    return { positions, isProvider: Boolean(q.data.at(-1)?.result), ready: true, refetch: q.refetch };
  }, [q.data, q.refetch]);
}

export function useNodeKey(provider: Address | null | undefined) {
  return useReadContract({ address: A.rm, abi: redemptionManagerAbi, functionName: "nodeKeyOf", args: [provider!], query: { enabled: LIVE && !!provider, refetchInterval: 5_000 } });
}

export function useOracleState() {
  return useReadContracts({
    contracts: [
      { address: A.oracle, abi: deliveryOracleAbi, functionName: "simulationMode" },
      { address: A.oracle, abi: deliveryOracleAbi, functionName: "lastScheduledAt" },
      { address: A.oracle, abi: deliveryOracleAbi, functionName: "getForwarderAddress" },
      { address: A.rm, abi: redemptionManagerAbi, functionName: "hourSeconds" },
    ],
    query: { enabled: LIVE, refetchInterval: 5_000 },
  });
}
