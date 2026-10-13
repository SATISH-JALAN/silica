import { parseAbi } from "viem"

/** Read surface the workflows call through EVMClient.callContract */
export const RedemptionManager = parseAbi([
  "function getOpenTickets(uint256 offset, uint256 limit) view returns (uint256[] ids, (uint256 seriesId, address holder, address provider, uint32 hrs, uint32 confirmed, uint32 missed, uint32 disputed, uint128 priceAtOpen, uint64 openedAt, uint64 accessDeadline, uint64 accessPostedAt, bytes32 holderKey, address probeKey, address nodeKey, uint8 status)[] tickets)",
  "function verdictApplied(uint256 ticketId, uint32 hour) view returns (bool)",
  "function hourSeconds() view returns (uint64)",
])

export const SeriesRegistry = parseAbi([
  "function seriesCount() view returns (uint256)",
  "function getSeries(uint256 seriesId) view returns ((bytes32 gpu, bytes32 region, uint64 deliveryStart, uint64 deliveryEnd, uint16 bondRatioBps, uint16 slashMultBps, address token, uint128 markPrice, uint64 markUpdatedAt))",
])

export const SilicaBook = parseAbi(["function bestBidAsk(uint256 seriesId) view returns (uint128 bid, uint128 ask)"])

export const BondVault = parseAbi([
  "function positionOf(address provider, uint256 seriesId) view returns ((uint128 bond, uint64 minted, uint64 assigned, uint64 settled, bool marginCalled))",
  "function bondRatioOf(address provider, uint256 seriesId) view returns (uint16)",
  "function requiredBond(address provider, uint256 seriesId) view returns (uint256)",
])

/** Kuru Spot V2: SpotRouter verification and the per-market order book (prices: USD * pricePrecision) */
export const KuruRouter = parseAbi(["function verifiedSpotMarket(address market) view returns (bool)"])
export const KuruBook = parseAbi(["function bestBidAsk() view returns (uint32 bid, uint32 ask)"])
