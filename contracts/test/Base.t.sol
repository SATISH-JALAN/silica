// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {SeriesRegistry} from "../src/SeriesRegistry.sol";
import {SilicaToken} from "../src/SilicaToken.sol";
import {BondVault} from "../src/BondVault.sol";
import {RedemptionManager} from "../src/RedemptionManager.sol";
import {DeliveryOracle} from "../src/DeliveryOracle.sol";
import {SilicaBook} from "../src/SilicaBook.sol";
import {IBondVault, IRedemptionManager, ISeriesRegistry, Ticket} from "../src/interfaces/ISilica.sol";

/// @notice Shared fixture: the whole Silica core wired exactly like Deploy.s.sol.
abstract contract Base is Test {
    uint64 constant SELECTOR = 2183018362218727504; // placeholder selector used across tests
    uint64 constant WEEK_START = 1_791_763_200; // Mon 12 Oct 2026 00:00 UTC (ISO week 42)
    uint128 constant MARK = 2_050000; // $2.05

    address admin = makeAddr("admin");
    address forwarder = makeAddr("forwarder");
    address relayer = makeAddr("relayer");
    address providerA = makeAddr("providerA");
    address providerB = makeAddr("providerB");
    address buyer = makeAddr("buyer");
    address mm = makeAddr("mm");

    uint256 nodeKeyA = 0xA11CE;
    uint256 nodeKeyB = 0xB0B;
    uint256 probeKey = 0xBEEF;

    MockUSDC usdc;
    SeriesRegistry registry;
    BondVault vault;
    RedemptionManager rm;
    DeliveryOracle oracle;
    SilicaBook book;
    uint256 sid;
    SilicaToken token;

    function setUp() public virtual {
        vm.warp(WEEK_START + 1 days); // inside the delivery week
        vm.startPrank(admin);
        usdc = new MockUSDC(admin);
        registry = new SeriesRegistry(admin);
        vault = new BondVault(admin, usdc, ISeriesRegistry(address(registry)));
        rm = new RedemptionManager(admin, ISeriesRegistry(address(registry)), IBondVault(address(vault)));
        oracle = new DeliveryOracle(
            admin, forwarder, SELECTOR, ISeriesRegistry(address(registry)), IBondVault(address(vault)), IRedemptionManager(address(rm))
        );
        book = new SilicaBook(usdc, ISeriesRegistry(address(registry)));

        registry.setCore(address(vault), address(rm));
        registry.grantRole(registry.ORACLE_ROLE(), address(oracle));
        vault.grantRole(vault.ORACLE_ROLE(), address(oracle));
        vault.grantRole(vault.REDEMPTION_ROLE(), address(rm));
        vault.grantRole(vault.PROVIDER_ROLE(), providerA);
        vault.grantRole(vault.PROVIDER_ROLE(), providerB);
        rm.grantRole(rm.ORACLE_ROLE(), address(oracle));
        oracle.grantRole(oracle.RELAYER_ROLE(), relayer);
        oracle.setSimulationMode(true);
        rm.setParams(30 minutes, 5 minutes);

        sid = registry.createSeries("H100-80GB", "APAC", WEEK_START, 3000, 15000, MARK, "Silica H100 APAC W42", "SIL-H100-APAC-W42");
        token = SilicaToken(registry.getSeries(sid).token);

        usdc.mint(providerA, 10_000e6);
        usdc.mint(providerB, 10_000e6);
        usdc.mint(buyer, 10_000e6);
        usdc.mint(mm, 10_000e6);
        vm.stopPrank();

        vm.prank(providerA);
        rm.setNodeKey(vm.addr(nodeKeyA));
        vm.prank(providerB);
        rm.setNodeKey(vm.addr(nodeKeyB));
    }

    // ───────── helpers ─────────

    function _bondAndMint(address provider, uint256 bond, uint64 hrs) internal {
        vm.startPrank(provider);
        usdc.approve(address(vault), bond);
        vault.depositBond(sid, bond);
        vault.mint(sid, hrs);
        vm.stopPrank();
    }

    function _give(address to, uint256 hrs, address from) internal {
        vm.prank(from);
        token.transfer(to, hrs * 1e18);
    }

    function _redeem(address holder, uint32 hrs) internal returns (uint256[] memory ids) {
        vm.prank(holder);
        ids = rm.redeem(sid, hrs, bytes32(uint256(0x1234)), vm.addr(probeKey));
    }

    function _post(uint256 ticketId) internal {
        Ticket memory t = rm.getTicket(ticketId);
        vm.prank(t.provider);
        rm.postAccess(ticketId, hex"c0ffee");
    }

    function _sign(uint256 key, uint256 ticketId, uint32 hour, uint8 ok, bytes32 gpu) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, oracle.hourDigest(ticketId, hour, ok, gpu));
        return abi.encodePacked(r, s, v);
    }

    function _verdict(uint256 ticketId, uint32 hour, uint256 nodeKey, uint8 provOk, uint8 probeOk)
        internal
        view
        returns (DeliveryOracle.Verdict memory v)
    {
        bytes32 gpu = keccak256("GPU-1");
        v.ticketId = ticketId;
        v.hour = hour;
        v.providerOk = provOk;
        v.providerGpu = gpu;
        v.providerSig = nodeKey == 0 ? bytes("") : _sign(nodeKey, ticketId, hour, provOk, gpu);
        v.probeOk = probeOk;
        v.probeGpu = gpu;
        v.probeSig = _sign(probeKey, ticketId, hour, probeOk, gpu);
    }

    function _report(uint64 scheduledAt, DeliveryOracle.Verdict[] memory verdicts) internal pure returns (bytes memory) {
        DeliveryOracle.Report memory r;
        r.chainSelector = SELECTOR;
        r.scheduledAt = scheduledAt;
        r.verdicts = verdicts;
        r.marks = new DeliveryOracle.Mark[](0);
        r.ratios = new DeliveryOracle.Ratio[](0);
        r.checks = new DeliveryOracle.MarginCheck[](0);
        return abi.encode(r);
    }

    function _one(DeliveryOracle.Verdict memory v) internal pure returns (DeliveryOracle.Verdict[] memory a) {
        a = new DeliveryOracle.Verdict[](1);
        a[0] = v;
    }
}
