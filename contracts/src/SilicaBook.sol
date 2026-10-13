// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISeriesRegistry} from "./interfaces/ISilica.sol";

/// @title SilicaBook
/// @notice Minimal onchain limit-order book for every series, used until Kuru lists Silica
///         markets. Price-time priority, $0.01 ticks, FIFO per level, matched at placement,
///         capped at 20 fills per transaction. Asks escrow series tokens, bids escrow USDC.
contract SilicaBook is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint128 public constant TICK = 10_000; // $0.01 in 6-decimal USDC
    uint256 public constant HOUR_UNIT = 1e18;
    uint256 public constant MAX_FILLS = 20;
    uint256 public constant MIN_NOTIONAL = 10e6; // 10 USDC, same floor as Kuru

    struct Order {
        uint256 seriesId;
        address owner;
        bool isBid;
        uint128 price; // USDC per hour, 6 decimals
        uint32 remaining; // hours
        uint256 prev;
        uint256 next;
    }

    struct Level {
        uint256 head;
        uint256 tail;
        uint64 total; // resting hours at this price
    }

    IERC20 public immutable usdc;
    ISeriesRegistry public immutable registry;

    uint256 public orderCount;
    mapping(uint256 => Order) public orders;

    // seriesId => isBid => price => level
    mapping(uint256 => mapping(bool => mapping(uint128 => Level))) private _levels;
    // active prices per side; the best price is kept at the END of each array
    // bids: ascending (best = highest last); asks: descending (best = lowest last)
    mapping(uint256 => uint128[]) private _bidPrices;
    mapping(uint256 => uint128[]) private _askPrices;

    event OrderPlaced(uint256 indexed orderId, uint256 indexed seriesId, address indexed owner, bool isBid, uint128 price, uint32 hrs);
    event OrderCancelled(uint256 indexed orderId, uint256 indexed seriesId, uint32 remaining);
    event Trade(
        uint256 indexed seriesId,
        uint256 indexed makerOrderId,
        address maker,
        address taker,
        bool takerBuys,
        uint32 hrs,
        uint128 price
    );

    error NotTickAligned(uint128 price);
    error ZeroAmount();
    error BelowMinNotional(uint256 notional);
    error NotOwner();
    error OrderClosed();
    error SelfTrade();
    error Slippage(uint256 got, uint256 limit);

    constructor(IERC20 usdc_, ISeriesRegistry registry_) {
        usdc = usdc_;
        registry = registry_;
    }

    // ───────────────────────── trading ─────────────────────────

    /// @notice Place a limit order; crosses immediately against the book, rests the rest.
    function placeLimit(uint256 seriesId, bool isBid, uint128 price, uint32 hrs)
        external
        nonReentrant
        returns (uint256 orderId, uint32 filled)
    {
        if (hrs == 0) revert ZeroAmount();
        if (price == 0 || price % TICK != 0) revert NotTickAligned(price);
        uint256 notional = uint256(price) * hrs;
        if (notional < MIN_NOTIONAL) revert BelowMinNotional(notional);
        IERC20 token = _token(seriesId);

        // escrow the full order up front; fills pay out of escrow
        if (isBid) usdc.safeTransferFrom(msg.sender, address(this), notional);
        else token.safeTransferFrom(msg.sender, address(this), uint256(hrs) * HOUR_UNIT);

        uint256 spent;
        (filled, spent) = _match(seriesId, !isBid, price, hrs, msg.sender, token, true);

        if (isBid) {
            // price improvement on fills below the limit goes back to the bidder
            uint256 reserved = uint256(price) * filled;
            if (reserved > spent) usdc.safeTransfer(msg.sender, reserved - spent);
        }

        uint32 rest = hrs - filled;
        if (rest > 0) {
            orderId = ++orderCount;
            orders[orderId] = Order(seriesId, msg.sender, isBid, price, rest, 0, 0);
            _pushLevel(seriesId, isBid, price, orderId, rest);
            emit OrderPlaced(orderId, seriesId, msg.sender, isBid, price, rest);
        }
    }

    /// @notice Buy up to `hrs` at market; pays at most `maxCost` USDC. Unfilled part is dropped.
    function marketBuy(uint256 seriesId, uint32 hrs, uint256 maxCost) external nonReentrant returns (uint32 filled, uint256 cost) {
        if (hrs == 0) revert ZeroAmount();
        IERC20 token = _token(seriesId);
        (filled, cost) = _match(seriesId, false, type(uint128).max, hrs, msg.sender, token, false);
        if (cost > maxCost) revert Slippage(cost, maxCost);
    }

    /// @notice Sell up to `hrs` at market; receives at least `minProceeds` USDC.
    function marketSell(uint256 seriesId, uint32 hrs, uint256 minProceeds)
        external
        nonReentrant
        returns (uint32 filled, uint256 proceeds)
    {
        if (hrs == 0) revert ZeroAmount();
        IERC20 token = _token(seriesId);
        (filled, proceeds) = _match(seriesId, true, 0, hrs, msg.sender, token, false);
        if (proceeds < minProceeds) revert Slippage(proceeds, minProceeds);
    }

    function cancel(uint256 orderId) external nonReentrant {
        Order storage o = orders[orderId];
        if (o.owner != msg.sender) revert NotOwner();
        if (o.remaining == 0) revert OrderClosed();
        uint32 rest = o.remaining;
        uint256 seriesId = o.seriesId;
        bool isBid = o.isBid;
        uint128 price = o.price;
        _unlink(seriesId, isBid, price, orderId, rest);
        o.remaining = 0;
        emit OrderCancelled(orderId, seriesId, rest);
        if (isBid) usdc.safeTransfer(msg.sender, uint256(price) * rest);
        else _token(seriesId).safeTransfer(msg.sender, uint256(rest) * HOUR_UNIT);
    }

    // ───────────────────────── views ─────────────────────────

    function bestBidAsk(uint256 seriesId) external view returns (uint128 bid, uint128 ask) {
        uint128[] storage b = _bidPrices[seriesId];
        uint128[] storage a = _askPrices[seriesId];
        bid = b.length == 0 ? 0 : b[b.length - 1];
        ask = a.length == 0 ? 0 : a[a.length - 1];
    }

    /// @notice Top `n` levels per side, best first.
    function depth(uint256 seriesId, uint256 n)
        external
        view
        returns (uint128[] memory bidPx, uint64[] memory bidHrs, uint128[] memory askPx, uint64[] memory askHrs)
    {
        (bidPx, bidHrs) = _side(seriesId, true, n);
        (askPx, askHrs) = _side(seriesId, false, n);
    }

    /// @notice Resting order ids at one price level, in time priority.
    function levelOrders(uint256 seriesId, bool isBid, uint128 price, uint256 max) external view returns (uint256[] memory ids) {
        ids = new uint256[](max);
        uint256 k;
        for (uint256 id = _levels[seriesId][isBid][price].head; id != 0 && k < max; id = orders[id].next) ids[k++] = id;
        assembly ("memory-safe") {
            mstore(ids, k)
        }
    }

    // ───────────────────────── internal ─────────────────────────

    /// @param makerIsBid side of the resting orders being consumed
    /// @param limit worst acceptable maker price (asks <= limit; bids >= limit)
    /// @param escrowed taker funds already sit in this contract (limit orders)
    function _match(
        uint256 seriesId,
        bool makerIsBid,
        uint128 limit,
        uint32 want,
        address taker,
        IERC20 token,
        bool escrowed
    ) internal returns (uint32 filled, uint256 quote) {
        uint128[] storage prices = makerIsBid ? _bidPrices[seriesId] : _askPrices[seriesId];
        uint256 fills;
        while (filled < want && fills < MAX_FILLS && prices.length > 0) {
            uint128 px = prices[prices.length - 1];
            if (makerIsBid ? px < limit : px > limit) break;

            Level storage lvl = _levels[seriesId][makerIsBid][px];
            uint256 id = lvl.head;
            Order storage m = orders[id];
            if (m.owner == taker) revert SelfTrade();

            uint32 take = want - filled < m.remaining ? want - filled : m.remaining;
            uint256 cost = uint256(px) * take;
            m.remaining -= take;
            lvl.total -= take;
            filled += take;
            quote += cost;
            fills++;

            if (makerIsBid) {
                // taker sells tokens to a resting bid: bid's escrowed USDC goes to taker
                if (escrowed) token.safeTransfer(m.owner, uint256(take) * HOUR_UNIT);
                else token.safeTransferFrom(taker, m.owner, uint256(take) * HOUR_UNIT);
                usdc.safeTransfer(taker, cost);
            } else {
                // taker buys from a resting ask: ask's escrowed tokens go to taker
                if (escrowed) usdc.safeTransfer(m.owner, cost);
                else usdc.safeTransferFrom(taker, m.owner, cost);
                token.safeTransfer(taker, uint256(take) * HOUR_UNIT);
            }
            emit Trade(seriesId, id, m.owner, taker, !makerIsBid, take, px);

            if (m.remaining == 0) {
                lvl.head = m.next;
                if (m.next != 0) orders[m.next].prev = 0;
                else lvl.tail = 0;
                m.next = 0;
                if (lvl.head == 0) prices.pop();
            }
        }
    }

    function _pushLevel(uint256 seriesId, bool isBid, uint128 price, uint256 id, uint32 hrs) internal {
        Level storage lvl = _levels[seriesId][isBid][price];
        if (lvl.head == 0) {
            lvl.head = id;
            lvl.tail = id;
            _insertPrice(isBid ? _bidPrices[seriesId] : _askPrices[seriesId], price, isBid);
        } else {
            orders[lvl.tail].next = id;
            orders[id].prev = lvl.tail;
            lvl.tail = id;
        }
        lvl.total += hrs;
    }

    function _unlink(uint256 seriesId, bool isBid, uint128 price, uint256 id, uint32 rest) internal {
        Level storage lvl = _levels[seriesId][isBid][price];
        Order storage o = orders[id];
        if (o.prev != 0) orders[o.prev].next = o.next;
        else lvl.head = o.next;
        if (o.next != 0) orders[o.next].prev = o.prev;
        else lvl.tail = o.prev;
        o.prev = 0;
        o.next = 0;
        lvl.total -= rest;
        if (lvl.head == 0) _removePrice(isBid ? _bidPrices[seriesId] : _askPrices[seriesId], price);
    }

    /// @dev Keeps the best price last: bids ascending, asks descending.
    function _insertPrice(uint128[] storage arr, uint128 price, bool isBid) internal {
        arr.push(price);
        uint256 i = arr.length - 1;
        while (i > 0) {
            uint128 prev = arr[i - 1];
            bool before = isBid ? prev > price : prev < price;
            if (!before) break;
            arr[i] = prev;
            i--;
        }
        arr[i] = price;
    }

    function _removePrice(uint128[] storage arr, uint128 price) internal {
        uint256 n = arr.length;
        for (uint256 i; i < n; i++) {
            if (arr[i] == price) {
                for (uint256 j = i; j + 1 < n; j++) arr[j] = arr[j + 1];
                arr.pop();
                return;
            }
        }
    }

    function _side(uint256 seriesId, bool isBid, uint256 n) internal view returns (uint128[] memory px, uint64[] memory hrs) {
        uint128[] storage arr = isBid ? _bidPrices[seriesId] : _askPrices[seriesId];
        uint256 m = arr.length < n ? arr.length : n;
        px = new uint128[](m);
        hrs = new uint64[](m);
        for (uint256 i; i < m; i++) {
            uint128 p = arr[arr.length - 1 - i];
            px[i] = p;
            hrs[i] = _levels[seriesId][isBid][p].total;
        }
    }

    function _token(uint256 seriesId) internal view returns (IERC20) {
        return IERC20(registry.getSeries(seriesId).token);
    }
}
