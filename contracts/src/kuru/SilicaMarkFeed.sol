// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ISeriesRegistry} from "../interfaces/ISilica.sol";

/// @title SilicaMarkFeed
/// @notice USD price feed for one Silica series token, in the read interface of Kuru's testnet
///         price feeds (`fetchPrice()` / `priceUsd18()` in USD with 18 decimals, `observedAt()`,
///         `maxPriceAge()`), so Kuru's WithdrawalLimiter can value the token.
/// @dev The price is the series mark that Chainlink CRE's Mark & Margin workflow writes to
///      SeriesRegistry (USDC per GPU-hour, 6 decimals). It is read from chain state on every call,
///      so there is no offchain observation to go stale: `observedAt()` is the current block.
///      `markUpdatedAt()` exposes when CRE last changed the mark, for anyone who wants that instead.
contract SilicaMarkFeed {
    ISeriesRegistry public immutable registry;
    uint256 public immutable seriesId;
    uint32 public constant maxPriceAge = 300;

    error NoMark();

    constructor(ISeriesRegistry registry_, uint256 seriesId_) {
        registry = registry_;
        seriesId = seriesId_;
    }

    function priceUsd18() public view returns (uint256 price) {
        price = uint256(registry.getSeries(seriesId).markPrice) * 1e12;
        if (price == 0) revert NoMark();
    }

    function fetchPrice() external view returns (uint256) {
        return priceUsd18();
    }

    function observedAt() external view returns (uint64) {
        return uint64(block.timestamp);
    }

    function markUpdatedAt() external view returns (uint64) {
        return registry.getSeries(seriesId).markUpdatedAt;
    }

    function token() external view returns (address) {
        return registry.getSeries(seriesId).token;
    }
}
