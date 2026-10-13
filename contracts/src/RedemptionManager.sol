// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IBondVault, ISeriesRegistry, ISilicaToken, Series, Ticket, TicketStatus} from "./interfaces/ISilica.sol";

/// @title RedemptionManager
/// @notice Burns series tokens into redemption tickets (one per provider), records the
///         encrypted access hand-off, and applies CRE delivery verdicts hour by hour:
///         confirmed hours count toward the provider, missed hours slash its bond to the
///         holder at 1.5x priceAtOpen, and disagreement is held as disputed.
contract RedemptionManager is AccessControl, ReentrancyGuard {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    uint8 public constant KIND_CONFIRM = 0;
    uint8 public constant KIND_MISS = 1;
    uint8 public constant KIND_DISPUTE = 2;

    uint256 public constant BPS = 10_000;
    uint256 public constant HOUR_UNIT = 1e18;

    ISeriesRegistry public immutable registry;
    IBondVault public immutable vault;

    /// @notice Provider must post access within this window after redemption.
    uint64 public accessWindow = 30 minutes;
    /// @notice Length of one delivery hour. 3600 in production; shortened in demo mode.
    uint64 public hourSeconds = 1 hours;

    uint256 public ticketCount;
    mapping(uint256 => Ticket) private _tickets;
    mapping(uint256 => mapping(uint32 => bool)) public verdictApplied;
    mapping(address => address) public nodeKeyOf;

    uint256[] private _open;
    mapping(uint256 => uint256) private _openIndex; // ticketId => index + 1

    event Redeemed(
        uint256 indexed ticketId,
        uint256 indexed seriesId,
        address holder,
        address provider,
        uint32 hrs,
        uint128 priceAtOpen
    );
    event TicketKeys(uint256 indexed ticketId, bytes32 holderKey, address probeKey, address nodeKey, uint64 accessDeadline);
    event AccessPosted(uint256 indexed ticketId, bytes ciphertext);
    event HoursConfirmed(uint256 indexed ticketId, uint32 hrs);
    event HoursSlashed(uint256 indexed ticketId, uint32 hrs, uint256 payout);
    event HoursDisputed(uint256 indexed ticketId, uint32 hrs);
    event HourVerdict(uint256 indexed ticketId, uint32 hour, uint8 kind);
    event DisputeResolved(uint256 indexed ticketId, uint32 toConfirmed, uint32 toMissed);
    event TicketSettled(uint256 indexed ticketId);
    event NodeKeySet(address indexed provider, address nodeKey);
    event ParamsSet(uint64 accessWindow, uint64 hourSeconds);

    error NotProvider();
    error OutsideDeliveryWindow();
    error ZeroAmount();
    error AccessAlreadyPosted();
    error AccessNotPosted();
    error DeadlineNotPassed();
    error TicketSettled_(uint256 ticketId);
    error HourOutOfRange(uint32 hour);
    error HourNotElapsed(uint32 hour);
    error VerdictAlreadyApplied(uint32 hour);
    error InvalidKind(uint8 kind);
    error UnknownTicket(uint256 ticketId);
    error TooManyResolved();

    constructor(address admin, ISeriesRegistry registry_, IBondVault vault_) {
        registry = registry_;
        vault = vault_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ARBITER_ROLE, admin);
    }

    function setParams(uint64 accessWindow_, uint64 hourSeconds_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        accessWindow = accessWindow_;
        hourSeconds = hourSeconds_;
        emit ParamsSet(accessWindow_, hourSeconds_);
    }

    /// @notice Provider registers the key its node signs heartbeat summaries with.
    function setNodeKey(address nodeKey) external {
        nodeKeyOf[msg.sender] = nodeKey;
        emit NodeKeySet(msg.sender, nodeKey);
    }

    // ───────────────────────── holder ─────────────────────────

    /// @notice Burn `hrs` whole GPU-hours of a series during its delivery week and open
    ///         one ticket per provider the hours are assigned to.
    function redeem(uint256 seriesId, uint32 hrs, bytes32 holderKey, address probeKey)
        external
        nonReentrant
        returns (uint256[] memory ticketIds)
    {
        if (hrs == 0) revert ZeroAmount();
        Series memory s = registry.getSeries(seriesId);
        if (block.timestamp < s.deliveryStart || block.timestamp > s.deliveryEnd) revert OutsideDeliveryWindow();

        ISilicaToken(s.token).burn(msg.sender, uint256(hrs) * HOUR_UNIT);
        (address[] memory providers, uint64[] memory amounts) = vault.assign(seriesId, hrs);

        ticketIds = new uint256[](providers.length);
        uint64 deadline = uint64(block.timestamp) + accessWindow;
        for (uint256 i; i < providers.length; i++) {
            uint256 id = ++ticketCount;
            address nodeKey = nodeKeyOf[providers[i]];
            _tickets[id] = Ticket({
                seriesId: seriesId,
                holder: msg.sender,
                provider: providers[i],
                hrs: uint32(amounts[i]),
                confirmed: 0,
                missed: 0,
                disputed: 0,
                priceAtOpen: s.markPrice,
                openedAt: uint64(block.timestamp),
                accessDeadline: deadline,
                accessPostedAt: 0,
                holderKey: holderKey,
                probeKey: probeKey,
                nodeKey: nodeKey,
                status: TicketStatus.Open
            });
            _open.push(id);
            _openIndex[id] = _open.length;
            ticketIds[i] = id;
            emit Redeemed(id, seriesId, msg.sender, providers[i], uint32(amounts[i]), s.markPrice);
            emit TicketKeys(id, holderKey, probeKey, nodeKey, deadline);
        }
    }

    // ───────────────────────── provider ─────────────────────────

    /// @notice Post access credentials sealed to the holder's X25519 key. Event only.
    function postAccess(uint256 ticketId, bytes calldata ciphertext) external {
        Ticket storage t = _get(ticketId);
        if (msg.sender != t.provider) revert NotProvider();
        if (t.status != TicketStatus.Open) revert AccessAlreadyPosted();
        t.status = TicketStatus.AccessPosted;
        t.accessPostedAt = uint64(block.timestamp);
        emit AccessPosted(ticketId, ciphertext);
    }

    // ───────────────────────── anyone ─────────────────────────

    /// @notice Slash the whole remaining ticket if access was never posted in time.
    function slashUnserved(uint256 ticketId) external nonReentrant {
        Ticket storage t = _get(ticketId);
        if (t.status != TicketStatus.Open || block.timestamp <= t.accessDeadline) revert DeadlineNotPassed();
        uint32 remaining = t.hrs - t.confirmed - t.missed - t.disputed;
        _slash(ticketId, t, remaining);
        _settle(ticketId, t);
    }

    // ───────────────────────── oracle ─────────────────────────

    /// @notice Apply one verified delivery hour. `kind`: 0 confirm, 1 miss, 2 dispute.
    function applyHour(uint256 ticketId, uint32 hour, uint8 kind) external onlyRole(ORACLE_ROLE) nonReentrant {
        Ticket storage t = _get(ticketId);
        if (t.status == TicketStatus.Settled) revert TicketSettled_(ticketId);
        if (t.status != TicketStatus.AccessPosted) revert AccessNotPosted();
        if (hour >= t.hrs) revert HourOutOfRange(hour);
        if (block.timestamp < uint256(t.accessPostedAt) + uint256(hour + 1) * hourSeconds) revert HourNotElapsed(hour);
        if (verdictApplied[ticketId][hour]) revert VerdictAlreadyApplied(hour);
        verdictApplied[ticketId][hour] = true;

        if (kind == KIND_CONFIRM) {
            t.confirmed += 1;
            vault.settleHours(t.provider, t.seriesId, 1);
            emit HoursConfirmed(ticketId, 1);
        } else if (kind == KIND_MISS) {
            _slash(ticketId, t, 1);
        } else if (kind == KIND_DISPUTE) {
            t.disputed += 1;
            emit HoursDisputed(ticketId, 1);
        } else {
            revert InvalidKind(kind);
        }
        emit HourVerdict(ticketId, hour, kind);

        if (t.confirmed + t.missed + t.disputed == t.hrs && t.disputed == 0) _settle(ticketId, t);
    }

    // ───────────────────────── arbiter ─────────────────────────

    function resolveDispute(uint256 ticketId, uint32 toConfirmed, uint32 toMissed)
        external
        onlyRole(ARBITER_ROLE)
        nonReentrant
    {
        Ticket storage t = _get(ticketId);
        if (t.status == TicketStatus.Settled) revert TicketSettled_(ticketId);
        if (uint256(toConfirmed) + toMissed > t.disputed) revert TooManyResolved();
        t.disputed -= toConfirmed + toMissed;
        if (toConfirmed > 0) {
            t.confirmed += toConfirmed;
            vault.settleHours(t.provider, t.seriesId, toConfirmed);
            emit HoursConfirmed(ticketId, toConfirmed);
        }
        if (toMissed > 0) _slash(ticketId, t, toMissed);
        emit DisputeResolved(ticketId, toConfirmed, toMissed);
        if (t.confirmed + t.missed + t.disputed == t.hrs && t.disputed == 0) _settle(ticketId, t);
    }

    // ───────────────────────── views ─────────────────────────

    function getTicket(uint256 ticketId) external view returns (Ticket memory) {
        return _get(ticketId);
    }

    function openCount() external view returns (uint256) {
        return _open.length;
    }

    function getOpenTickets(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, Ticket[] memory tickets)
    {
        uint256 n = _open.length;
        if (offset >= n) return (new uint256[](0), new Ticket[](0));
        uint256 end = offset + limit > n ? n : offset + limit;
        ids = new uint256[](end - offset);
        tickets = new Ticket[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            ids[i - offset] = _open[i];
            tickets[i - offset] = _tickets[_open[i]];
        }
    }

    /// @notice Delivery hours of a ticket that have fully elapsed.
    function hoursElapsed(uint256 ticketId) external view returns (uint32) {
        Ticket storage t = _get(ticketId);
        if (t.accessPostedAt == 0) return 0;
        uint256 n = (block.timestamp - t.accessPostedAt) / hourSeconds;
        return n > t.hrs ? t.hrs : uint32(n);
    }

    // ───────────────────────── internal ─────────────────────────

    function _slash(uint256 ticketId, Ticket storage t, uint32 hrs) internal {
        if (hrs == 0) return;
        Series memory s = registry.getSeries(t.seriesId);
        uint256 owed = (uint256(hrs) * t.priceAtOpen * s.slashMultBps) / BPS;
        t.missed += hrs;
        vault.settleHours(t.provider, t.seriesId, hrs);
        uint256 paid = vault.slash(t.provider, t.seriesId, t.holder, owed);
        emit HoursSlashed(ticketId, hrs, paid);
    }

    function _settle(uint256 ticketId, Ticket storage t) internal {
        t.status = TicketStatus.Settled;
        uint256 idx = _openIndex[ticketId];
        if (idx != 0) {
            uint256 last = _open[_open.length - 1];
            _open[idx - 1] = last;
            _openIndex[last] = idx;
            _open.pop();
            delete _openIndex[ticketId];
        }
        emit TicketSettled(ticketId);
    }

    function _get(uint256 ticketId) internal view returns (Ticket storage t) {
        t = _tickets[ticketId];
        if (t.holder == address(0)) revert UnknownTicket(ticketId);
    }
}
