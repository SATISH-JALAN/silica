// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {SilicaToken} from "./SilicaToken.sol";
import {Series} from "./interfaces/ISilica.sol";

/// @title SeriesRegistry
/// @notice Creates each standardized series (GPU, region, delivery week) and its token,
///         and stores the CRE-posted mark price used by the mint rule and slashes.
contract SeriesRegistry is AccessControl {
    bytes32 public constant SERIES_ADMIN_ROLE = keccak256("SERIES_ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    uint64 public constant WEEK = 7 days;

    uint256 public seriesCount;
    mapping(uint256 => Series) private _series;

    address public vault;
    address public redemption;

    event SeriesCreated(
        uint256 indexed seriesId, address token, bytes32 gpu, bytes32 region, uint64 deliveryStart, uint64 deliveryEnd
    );
    event MarkUpdated(uint256 indexed seriesId, uint128 price, uint64 scheduledAt);
    event CoreSet(address vault, address redemption);

    error CoreNotSet();
    error UnknownSeries(uint256 seriesId);
    error StaleReport(uint64 scheduledAt, uint64 last);
    error InvalidParams();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SERIES_ADMIN_ROLE, admin);
    }

    function setCore(address vault_, address redemption_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vault = vault_;
        redemption = redemption_;
        emit CoreSet(vault_, redemption_);
    }

    /// @param weekStart Monday 00:00 UTC of the delivery week.
    function createSeries(
        bytes32 gpu,
        bytes32 region,
        uint64 weekStart,
        uint16 bondRatioBps,
        uint16 slashMultBps,
        uint128 initialMark,
        string calldata name,
        string calldata symbol
    ) external onlyRole(SERIES_ADMIN_ROLE) returns (uint256 seriesId) {
        if (vault == address(0) || redemption == address(0)) revert CoreNotSet();
        if (bondRatioBps == 0 || bondRatioBps > 10_000 || slashMultBps == 0 || initialMark == 0) revert InvalidParams();

        seriesId = ++seriesCount;
        address admin = msg.sender;
        SilicaToken token = new SilicaToken(name, symbol, seriesId, admin, vault, redemption);

        uint64 end = weekStart + WEEK - 1;
        _series[seriesId] = Series({
            gpu: gpu,
            region: region,
            deliveryStart: weekStart,
            deliveryEnd: end,
            bondRatioBps: bondRatioBps,
            slashMultBps: slashMultBps,
            token: address(token),
            markPrice: initialMark,
            markUpdatedAt: 0
        });

        emit SeriesCreated(seriesId, address(token), gpu, region, weekStart, end);
        emit MarkUpdated(seriesId, initialMark, 0);
    }

    function setMark(uint256 seriesId, uint128 price, uint64 scheduledAt) external onlyRole(ORACLE_ROLE) {
        Series storage s = _get(seriesId);
        if (scheduledAt <= s.markUpdatedAt) revert StaleReport(scheduledAt, s.markUpdatedAt);
        if (price == 0) revert InvalidParams();
        s.markPrice = price;
        s.markUpdatedAt = scheduledAt;
        emit MarkUpdated(seriesId, price, scheduledAt);
    }

    function getSeries(uint256 seriesId) external view returns (Series memory) {
        return _get(seriesId);
    }

    function _get(uint256 seriesId) internal view returns (Series storage s) {
        s = _series[seriesId];
        if (s.token == address(0)) revert UnknownSeries(seriesId);
    }
}
