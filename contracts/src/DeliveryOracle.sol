// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReceiverTemplate} from "./chainlink/ReceiverTemplate.sol";
import {IBondVault, IRedemptionManager, ISeriesRegistry, Ticket} from "./interfaces/ISilica.sol";

/// @title DeliveryOracle
/// @notice Chainlink CRE consumer. Receives one report per cron slot from the Delivery
///         Verifier or Mark & Margin workflow and routes it: verdicts to RedemptionManager,
///         marks to SeriesRegistry, bond ratios and margin checks to BondVault.
///
///         Verdicts are not trusted as sent: each carries the provider node's and the
///         buyer probe's EIP-712 signed hour summaries, and the contract re-derives the
///         outcome from them (both >= 11/12 confirm, probe < 11 with no healthy provider
///         summary miss, anything else dispute). Faked evidence fails even if every node
///         agrees on it.
contract DeliveryOracle is AccessControl, EIP712, ReceiverTemplate {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    bytes32 public constant HOUR_SUMMARY_TYPEHASH =
        keccak256("HourSummary(uint256 ticketId,uint32 hour,uint8 okChecks,bytes32 gpuIdHash)");

    uint8 public constant CHECKS_PER_HOUR = 12;
    uint8 public constant OK_THRESHOLD = 11;
    uint8 internal constant NO_VERDICT = type(uint8).max;

    struct Verdict {
        uint256 ticketId;
        uint32 hour;
        uint8 providerOk;
        bytes32 providerGpu;
        bytes providerSig; // empty when the provider node produced no summary
        uint8 probeOk;
        bytes32 probeGpu;
        bytes probeSig;
    }

    struct Mark {
        uint256 seriesId;
        uint128 price;
    }

    struct Ratio {
        address provider;
        uint256 seriesId;
        uint16 bondRatioBps;
    }

    struct MarginCheck {
        address provider;
        uint256 seriesId;
    }

    struct Report {
        uint64 chainSelector; // rejects cross-chain replay
        uint64 scheduledAt; // cron slot; must increase; rejects same-chain replay
        Verdict[] verdicts;
        Mark[] marks;
        Ratio[] ratios;
        MarginCheck[] checks;
    }

    ISeriesRegistry public immutable registry;
    IBondVault public immutable vault;
    IRedemptionManager public immutable redemption;

    uint64 public chainSelector;
    uint64 public lastScheduledAt;
    /// @notice Testnet-only: while true, RELAYER_ROLE may submit the workflow's report bytes
    ///         directly (used when `cre workflow simulate` cannot reach onReport).
    bool public simulationMode;

    event ReportReceived(
        uint64 indexed scheduledAt,
        uint32 verdicts,
        uint32 applied,
        uint32 marks,
        uint32 ratios,
        uint32 checks,
        bool relayed
    );
    event VerdictSkipped(uint256 indexed ticketId, uint32 hour, bytes reason);
    event SimulationModeSet(bool enabled);
    event ChainSelectorSet(uint64 chainSelector);

    error WrongChain(uint64 selector);
    error StaleReport(uint64 scheduledAt, uint64 last);
    error SimulationOff();

    constructor(
        address admin,
        address forwarder,
        uint64 chainSelector_,
        ISeriesRegistry registry_,
        IBondVault vault_,
        IRedemptionManager redemption_
    ) ReceiverTemplate(forwarder, admin) EIP712("Silica", "1") {
        registry = registry_;
        vault = vault_;
        redemption = redemption_;
        chainSelector = chainSelector_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ───────────────────────── admin ─────────────────────────

    function setSimulationMode(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        simulationMode = enabled;
        emit SimulationModeSet(enabled);
    }

    function setChainSelector(uint64 selector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        chainSelector = selector;
        emit ChainSelectorSet(selector);
    }

    // ───────────────────────── report intake ─────────────────────────

    /// @notice Testnet-only path for the same signed report bytes while CRE deploy access
    ///         is pending. Disabled with one admin call.
    function relayReport(bytes calldata report) external onlyRole(RELAYER_ROLE) {
        if (!simulationMode) revert SimulationOff();
        _handle(report, true);
    }

    function _processReport(bytes calldata report) internal override {
        _handle(report, false);
    }

    function _handle(bytes calldata raw, bool relayed) internal {
        Report memory r = abi.decode(raw, (Report));
        if (r.chainSelector != chainSelector) revert WrongChain(r.chainSelector);
        if (r.scheduledAt <= lastScheduledAt) revert StaleReport(r.scheduledAt, lastScheduledAt);
        lastScheduledAt = r.scheduledAt;

        for (uint256 i; i < r.marks.length; i++) {
            registry.setMark(r.marks[i].seriesId, r.marks[i].price, r.scheduledAt);
        }
        for (uint256 i; i < r.ratios.length; i++) {
            vault.setBondRatio(r.ratios[i].provider, r.ratios[i].seriesId, r.ratios[i].bondRatioBps);
        }
        for (uint256 i; i < r.checks.length; i++) {
            vault.checkMargin(r.checks[i].provider, r.checks[i].seriesId);
        }

        uint32 applied;
        for (uint256 i; i < r.verdicts.length; i++) {
            Verdict memory v = r.verdicts[i];
            uint8 kind = _derive(v);
            if (kind == NO_VERDICT) {
                emit VerdictSkipped(v.ticketId, v.hour, "no valid evidence");
                continue;
            }
            // one bad hour (already applied, not yet elapsed) must not sink the whole batch
            try redemption.applyHour(v.ticketId, v.hour, kind) {
                applied++;
            } catch (bytes memory reason) {
                emit VerdictSkipped(v.ticketId, v.hour, reason);
            }
        }

        emit ReportReceived(
            r.scheduledAt,
            uint32(r.verdicts.length),
            applied,
            uint32(r.marks.length),
            uint32(r.ratios.length),
            uint32(r.checks.length),
            relayed
        );
    }

    // ───────────────────────── evidence ─────────────────────────

    /// @notice The 11-of-12 rule, applied to signed evidence only.
    function deriveKind(Verdict calldata v) external view returns (uint8) {
        return _derive(v);
    }

    function hourDigest(uint256 ticketId, uint32 hour, uint8 okChecks, bytes32 gpuIdHash)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(HOUR_SUMMARY_TYPEHASH, ticketId, hour, okChecks, gpuIdHash)));
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _derive(Verdict memory v) internal view returns (uint8) {
        Ticket memory t = redemption.getTicket(v.ticketId);

        bool probeValid = v.probeOk <= CHECKS_PER_HOUR && t.probeKey != address(0)
            && _signedBy(hourDigest(v.ticketId, v.hour, v.probeOk, v.probeGpu), v.probeSig, t.probeKey);
        bool providerValid = v.providerOk <= CHECKS_PER_HOUR && t.nodeKey != address(0)
            && _signedBy(hourDigest(v.ticketId, v.hour, v.providerOk, v.providerGpu), v.providerSig, t.nodeKey);

        if (!probeValid && !providerValid) return NO_VERDICT;

        bool providerUp = providerValid && v.providerOk >= OK_THRESHOLD;
        bool probeUp = probeValid && v.probeOk >= OK_THRESHOLD;

        // confirmed: both sides healthy and looking at the same GPU
        if (providerUp && probeUp && v.providerGpu == v.probeGpu) return 0;
        // missed: the buyer's probe saw the outage and the provider can't show otherwise
        if (probeValid && !probeUp && !providerUp) return 1;
        // anything else (one side only, disagreement, GPU mismatch) is held as disputed
        return 2;
    }

    function _signedBy(bytes32 digest, bytes memory sig, address expected) internal pure returns (bool) {
        if (sig.length != 65) return false;
        (address rec, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, sig);
        return err == ECDSA.RecoverError.NoError && rec == expected;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl, ReceiverTemplate)
        returns (bool)
    {
        return ReceiverTemplate.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }
}
