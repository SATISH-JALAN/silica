// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISeriesRegistry, ISilicaToken, Series} from "./interfaces/ISilica.sol";

/// @title BondVault
/// @notice Holds each provider's USDC bond per series and enforces how many GPU-hours it
///         may mint: bond >= (minted - settled + new) x mark x bondRatio. Pays slashes to
///         holders on behalf of RedemptionManager.
contract BondVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant REDEMPTION_ROLE = keccak256("REDEMPTION_ROLE");

    uint256 public constant BPS = 10_000;
    uint256 public constant HOUR_UNIT = 1e18;

    struct Position {
        uint128 bond; // USDC locked
        uint64 minted; // hours minted
        uint64 assigned; // hours assigned to tickets
        uint64 settled; // hours confirmed or slashed
        bool marginCalled;
    }

    IERC20 public immutable usdc;
    ISeriesRegistry public immutable registry;

    mapping(address => mapping(uint256 => Position)) private _positions;
    /// @dev Reputation-based ratio set by the Mark & Margin workflow; 0 = series default.
    mapping(address => mapping(uint256 => uint16)) public ratioOverride;

    // FIFO queue of providers with unassigned minted capacity, per series
    mapping(uint256 => address[]) private _queue;
    mapping(uint256 => uint256) private _queueHead;
    mapping(uint256 => mapping(address => bool)) private _queued;

    event BondDeposited(address indexed provider, uint256 indexed seriesId, uint256 amount);
    event Minted(address indexed provider, uint256 indexed seriesId, uint64 hrs);
    event MarginCall(address indexed provider, uint256 indexed seriesId, uint256 shortfall);
    event MarginCleared(address indexed provider, uint256 indexed seriesId);
    event BondReleased(address indexed provider, uint256 indexed seriesId, uint256 amount);
    event BondSlashed(address indexed provider, uint256 indexed seriesId, address indexed to, uint256 amount);
    event BondRatioSet(address indexed provider, uint256 indexed seriesId, uint16 bondRatioBps);
    event HoursAssigned(address indexed provider, uint256 indexed seriesId, uint64 hrs);
    event HoursSettled(address indexed provider, uint256 indexed seriesId, uint64 hrs);

    error NotProvider();
    error BondTooLow(uint256 required, uint256 have);
    error MarginCalled();
    error ZeroAmount();
    error OutsideDeliveryWindow();
    error DeliveryNotOver();
    error OpenTickets();
    error InsufficientCapacity(uint64 requested, uint64 available);
    error InvalidRatio();

    constructor(address admin, IERC20 usdc_, ISeriesRegistry registry_) {
        usdc = usdc_;
        registry = registry_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    modifier onlyProvider() {
        if (!hasRole(PROVIDER_ROLE, msg.sender)) revert NotProvider();
        _;
    }

    // ───────────────────────── provider actions ─────────────────────────

    function depositBond(uint256 seriesId, uint256 amount) external onlyProvider nonReentrant {
        if (amount == 0) revert ZeroAmount();
        registry.getSeries(seriesId); // reverts for unknown series
        Position storage p = _positions[msg.sender][seriesId];
        p.bond += uint128(amount);
        emit BondDeposited(msg.sender, seriesId, amount);
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        _clearMarginIfCovered(msg.sender, seriesId, p);
    }

    function mint(uint256 seriesId, uint64 hrs) external onlyProvider nonReentrant {
        if (hrs == 0) revert ZeroAmount();
        Series memory s = registry.getSeries(seriesId);
        if (block.timestamp > s.deliveryEnd) revert OutsideDeliveryWindow();
        Position storage p = _positions[msg.sender][seriesId];
        if (p.marginCalled) revert MarginCalled();

        uint256 required = _required(msg.sender, seriesId, s, uint256(p.minted - p.settled) + hrs);
        if (p.bond < required) revert BondTooLow(required, p.bond);

        p.minted += hrs;
        if (!_queued[seriesId][msg.sender]) {
            _queued[seriesId][msg.sender] = true;
            _queue[seriesId].push(msg.sender);
        }
        emit Minted(msg.sender, seriesId, hrs);
        ISilicaToken(s.token).mint(msg.sender, uint256(hrs) * HOUR_UNIT);
    }

    /// @notice Withdraw bond above the current requirement.
    function withdrawExcess(uint256 seriesId, uint256 amount) external onlyProvider nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Series memory s = registry.getSeries(seriesId);
        Position storage p = _positions[msg.sender][seriesId];
        uint256 required = _required(msg.sender, seriesId, s, p.minted - p.settled);
        if (amount > p.bond || p.bond - amount < required) revert BondTooLow(required + amount, p.bond);
        p.bond -= uint128(amount);
        emit BondReleased(msg.sender, seriesId, amount);
        usdc.safeTransfer(msg.sender, amount);
    }

    /// @notice After the delivery week closes and every ticket settles, release all remaining bond.
    function releaseBond(uint256 seriesId) external onlyProvider nonReentrant {
        Series memory s = registry.getSeries(seriesId);
        if (block.timestamp <= s.deliveryEnd) revert DeliveryNotOver();
        Position storage p = _positions[msg.sender][seriesId];
        if (p.assigned != p.settled) revert OpenTickets();
        uint256 amount = p.bond;
        if (amount == 0) revert ZeroAmount();
        p.bond = 0;
        emit BondReleased(msg.sender, seriesId, amount);
        usdc.safeTransfer(msg.sender, amount);
    }

    // ───────────────────────── oracle (CRE Mark & Margin) ─────────────────────────

    function checkMargin(address provider, uint256 seriesId) external onlyRole(ORACLE_ROLE) {
        Series memory s = registry.getSeries(seriesId);
        Position storage p = _positions[provider][seriesId];
        uint256 required = _required(provider, seriesId, s, p.minted - p.settled);
        if (p.bond < required) {
            p.marginCalled = true;
            emit MarginCall(provider, seriesId, required - p.bond);
        } else if (p.marginCalled) {
            p.marginCalled = false;
            emit MarginCleared(provider, seriesId);
        }
    }

    function setBondRatio(address provider, uint256 seriesId, uint16 bondRatioBps) external onlyRole(ORACLE_ROLE) {
        if (bondRatioBps > BPS) revert InvalidRatio();
        ratioOverride[provider][seriesId] = bondRatioBps;
        emit BondRatioSet(provider, seriesId, bondRatioBps);
    }

    // ───────────────────────── redemption hooks ─────────────────────────

    /// @notice Split a redemption across providers in FIFO order of unassigned capacity.
    function assign(uint256 seriesId, uint64 hrs)
        external
        onlyRole(REDEMPTION_ROLE)
        returns (address[] memory providers, uint64[] memory amounts)
    {
        address[] storage q = _queue[seriesId];
        uint256 head = _queueHead[seriesId];
        uint256 n = q.length;

        // first pass: count providers touched so we can size the arrays
        uint64 left = hrs;
        uint256 count;
        for (uint256 j = head; j < n && left > 0; j++) {
            Position storage p = _positions[q[j]][seriesId];
            uint64 avail = p.minted - p.assigned;
            if (avail == 0) continue;
            count++;
            left -= avail >= left ? left : avail;
        }
        if (left > 0) revert InsufficientCapacity(hrs, hrs - left);

        providers = new address[](count);
        amounts = new uint64[](count);
        left = hrs;
        uint256 k;
        uint256 i = head;
        for (; i < n && left > 0; i++) {
            address prov = q[i];
            Position storage p = _positions[prov][seriesId];
            uint64 avail = p.minted - p.assigned;
            if (avail == 0) continue;
            uint64 take = avail >= left ? left : avail;
            p.assigned += take;
            left -= take;
            providers[k] = prov;
            amounts[k] = take;
            k++;
            emit HoursAssigned(prov, seriesId, take);
        }
        // advance the head past fully assigned providers; they re-enter on their next mint
        while (head < n) {
            Position storage p = _positions[q[head]][seriesId];
            if (p.minted > p.assigned) break;
            _queued[seriesId][q[head]] = false;
            head++;
        }
        _queueHead[seriesId] = head;
    }

    function settleHours(address provider, uint256 seriesId, uint64 hrs) external onlyRole(REDEMPTION_ROLE) {
        _positions[provider][seriesId].settled += hrs;
        emit HoursSettled(provider, seriesId, hrs);
    }

    /// @notice Pay a slash from the provider's bond, capped at what remains.
    function slash(address provider, uint256 seriesId, address to, uint256 amount)
        external
        onlyRole(REDEMPTION_ROLE)
        nonReentrant
        returns (uint256 paid)
    {
        Position storage p = _positions[provider][seriesId];
        paid = amount > p.bond ? p.bond : amount;
        if (paid == 0) return 0;
        p.bond -= uint128(paid);
        emit BondSlashed(provider, seriesId, to, paid);
        usdc.safeTransfer(to, paid);
    }

    // ───────────────────────── views ─────────────────────────

    function positionOf(address provider, uint256 seriesId) external view returns (Position memory) {
        return _positions[provider][seriesId];
    }

    function bondRatioOf(address provider, uint256 seriesId) public view returns (uint16) {
        uint16 o = ratioOverride[provider][seriesId];
        return o != 0 ? o : registry.getSeries(seriesId).bondRatioBps;
    }

    function requiredBond(address provider, uint256 seriesId) external view returns (uint256) {
        Series memory s = registry.getSeries(seriesId);
        Position storage p = _positions[provider][seriesId];
        return _required(provider, seriesId, s, p.minted - p.settled);
    }

    /// @notice Hours a provider could still mint with its current bond.
    function mintableHours(address provider, uint256 seriesId) external view returns (uint256) {
        Series memory s = registry.getSeries(seriesId);
        Position storage p = _positions[provider][seriesId];
        uint256 perHour = (uint256(s.markPrice) * bondRatioOf(provider, seriesId)) / BPS;
        if (perHour == 0 || p.marginCalled) return 0;
        uint256 coverable = p.bond / perHour;
        uint256 open = p.minted - p.settled;
        return coverable > open ? coverable - open : 0;
    }

    function providersInQueue(uint256 seriesId) external view returns (address[] memory) {
        return _queue[seriesId];
    }

    // ───────────────────────── internal ─────────────────────────

    function _required(address provider, uint256 seriesId, Series memory s, uint256 openHours)
        internal
        view
        returns (uint256)
    {
        uint16 ratio = ratioOverride[provider][seriesId];
        if (ratio == 0) ratio = s.bondRatioBps;
        return (openHours * s.markPrice * ratio) / BPS;
    }

    function _clearMarginIfCovered(address provider, uint256 seriesId, Position storage p) internal {
        if (!p.marginCalled) return;
        Series memory s = registry.getSeries(seriesId);
        if (p.bond >= _required(provider, seriesId, s, p.minted - p.settled)) {
            p.marginCalled = false;
            emit MarginCleared(provider, seriesId);
        }
    }
}
