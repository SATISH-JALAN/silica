// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Shared types and the cross-contract surface of the Silica core.
struct Series {
    bytes32 gpu; // "H100-80GB"
    bytes32 region; // "APAC"
    uint64 deliveryStart; // Monday 00:00 UTC
    uint64 deliveryEnd; // Sunday 23:59:59 UTC
    uint16 bondRatioBps; // default 3000
    uint16 slashMultBps; // default 15000
    address token; // SilicaToken for this series
    uint128 markPrice; // USDC per GPU-hour, 6 decimals
    uint64 markUpdatedAt; // scheduledAt of the report that set it
}

enum TicketStatus {
    Open,
    AccessPosted,
    Settled
}

struct Ticket {
    uint256 seriesId;
    address holder;
    address provider;
    uint32 hrs; // hours redeemed on this ticket
    uint32 confirmed;
    uint32 missed;
    uint32 disputed;
    uint128 priceAtOpen; // mark at redemption; fixes the slash value
    uint64 openedAt;
    uint64 accessDeadline; // openedAt + accessWindow
    uint64 accessPostedAt; // delivery hour 0 starts here
    bytes32 holderKey; // holder's X25519 public key
    address probeKey; // signs the buyer probe's summaries
    address nodeKey; // provider node key at redemption time
    TicketStatus status;
}

interface ISeriesRegistry {
    function getSeries(uint256 seriesId) external view returns (Series memory);
    function setMark(uint256 seriesId, uint128 price, uint64 scheduledAt) external;
    function seriesCount() external view returns (uint256);
}

interface IBondVault {
    function assign(uint256 seriesId, uint64 hrs) external returns (address[] memory providers, uint64[] memory amounts);
    function settleHours(address provider, uint256 seriesId, uint64 hrs) external;
    function slash(address provider, uint256 seriesId, address to, uint256 amount) external returns (uint256 paid);
    function checkMargin(address provider, uint256 seriesId) external;
    function setBondRatio(address provider, uint256 seriesId, uint16 bondRatioBps) external;
}

interface IRedemptionManager {
    function getTicket(uint256 ticketId) external view returns (Ticket memory);
    function applyHour(uint256 ticketId, uint32 hour, uint8 kind) external;
}

interface ISilicaToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}
