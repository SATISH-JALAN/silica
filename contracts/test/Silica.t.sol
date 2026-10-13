// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Base} from "./Base.t.sol";
import {BondVault} from "../src/BondVault.sol";
import {RedemptionManager} from "../src/RedemptionManager.sol";
import {DeliveryOracle} from "../src/DeliveryOracle.sol";
import {SeriesRegistry} from "../src/SeriesRegistry.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ReceiverTemplate} from "../src/chainlink/ReceiverTemplate.sol";
import {Ticket, TicketStatus} from "../src/interfaces/ISilica.sol";

contract SilicaTest is Base {
    // ───────────────────────── mint rule ─────────────────────────

    function test_MintWithinBond() public {
        // worked example: 1,000 h at $2.00 x 30% needs $600
        bytes32 role = registry.ORACLE_ROLE();
        vm.startPrank(admin);
        registry.grantRole(role, admin);
        registry.setMark(sid, 2_000000, 1);
        vm.stopPrank();
        _bondAndMint(providerA, 600e6, 1000);
        assertEq(token.balanceOf(providerA), 1000e18);
        assertEq(vault.positionOf(providerA, sid).minted, 1000);
    }

    function test_RevertMintBeyondBond() public {
        vm.startPrank(providerA);
        usdc.approve(address(vault), 100e6);
        vault.depositBond(sid, 100e6);
        // 200 h x 2.05 x 30% = 123 USDC > 100
        vm.expectRevert(abi.encodeWithSelector(BondVault.BondTooLow.selector, 123e6, 100e6));
        vault.mint(sid, 200);
        vm.stopPrank();
    }

    function test_RevertNonProvider() public {
        vm.expectRevert(BondVault.NotProvider.selector);
        vm.prank(buyer);
        vault.depositBond(sid, 1);
    }

    function test_MarginCallBlocksMint() public {
        _bondAndMint(providerA, 123e6, 200);
        // mark doubles: requirement 246 > 123 bond
        DeliveryOracle.Report memory r = _emptyReport(10);
        r.marks = new DeliveryOracle.Mark[](1);
        r.marks[0] = DeliveryOracle.Mark(sid, 4_100000);
        r.checks = new DeliveryOracle.MarginCheck[](1);
        r.checks[0] = DeliveryOracle.MarginCheck(providerA, sid);
        vm.prank(relayer);
        oracle.relayReport(abi.encode(r));
        assertTrue(vault.positionOf(providerA, sid).marginCalled);

        vm.prank(providerA);
        vm.expectRevert(BondVault.MarginCalled.selector);
        vault.mint(sid, 1);

        // topping up clears the margin call
        vm.startPrank(providerA);
        usdc.approve(address(vault), 200e6);
        vault.depositBond(sid, 200e6);
        vm.stopPrank();
        assertFalse(vault.positionOf(providerA, sid).marginCalled);
    }

    function test_ReputationRatioLowersRequirement() public {
        DeliveryOracle.Report memory r = _emptyReport(11);
        r.ratios = new DeliveryOracle.Ratio[](1);
        r.ratios[0] = DeliveryOracle.Ratio(providerA, sid, 2000);
        vm.prank(relayer);
        oracle.relayReport(abi.encode(r));
        assertEq(vault.bondRatioOf(providerA, sid), 2000);
        _bondAndMint(providerA, 41e6, 100); // 100 x 2.05 x 20% = 41
    }

    // ───────────────────────── redemption ─────────────────────────

    function test_RedeemSplitsFifoAcrossProviders() public {
        _bondAndMint(providerA, 1_000e6, 60);
        _bondAndMint(providerB, 1_000e6, 60);
        _give(buyer, 50, providerA);
        _give(buyer, 50, providerB);
        uint256[] memory ids = _redeem(buyer, 100);
        assertEq(ids.length, 2);
        Ticket memory a = rm.getTicket(ids[0]);
        Ticket memory b = rm.getTicket(ids[1]);
        assertEq(a.provider, providerA);
        assertEq(a.hrs, 60);
        assertEq(b.provider, providerB);
        assertEq(b.hrs, 40);
        assertEq(a.priceAtOpen, MARK);
        assertEq(a.nodeKey, vm.addr(nodeKeyA));
        assertEq(token.totalSupply(), 20e18);
    }

    function test_RevertRedeemOutsideWindow() public {
        _bondAndMint(providerA, 1_000e6, 10);
        vm.warp(WEEK_START + 8 days);
        vm.prank(providerA);
        vm.expectRevert(RedemptionManager.OutsideDeliveryWindow.selector);
        rm.redeem(sid, 10, bytes32(0), address(1));
    }

    function test_PostAccessOnlyOnce() public {
        _bondAndMint(providerA, 1_000e6, 10);
        _give(buyer, 10, providerA);
        uint256 id = _redeem(buyer, 10)[0];
        vm.prank(buyer);
        vm.expectRevert(RedemptionManager.NotProvider.selector);
        rm.postAccess(id, hex"00");
        _post(id);
        vm.prank(providerA);
        vm.expectRevert(RedemptionManager.AccessAlreadyPosted.selector);
        rm.postAccess(id, hex"00");
    }

    function test_SlashUnservedAfterDeadline() public {
        _bondAndMint(providerA, 1_000e6, 10);
        _give(buyer, 10, providerA);
        uint256 id = _redeem(buyer, 10)[0];
        vm.expectRevert(RedemptionManager.DeadlineNotPassed.selector);
        rm.slashUnserved(id);
        vm.warp(block.timestamp + 31 minutes);
        uint256 before = usdc.balanceOf(buyer);
        rm.slashUnserved(id);
        // 10 h x 2.05 x 1.5 = 30.75
        assertEq(usdc.balanceOf(buyer) - before, 30_750000);
        assertEq(uint8(rm.getTicket(id).status), uint8(TicketStatus.Settled));
    }

    // ───────────────────────── verdicts (the worked example) ─────────────────────────

    function test_WorkedExample_TenMissedHoursPay3075() public {
        _bondAndMint(providerA, 600e6, 100);
        _give(buyer, 100, providerA);
        uint256 id = _redeem(buyer, 100)[0];
        _post(id);
        vm.warp(block.timestamp + 100 * 5 minutes);

        DeliveryOracle.Verdict[] memory vs = new DeliveryOracle.Verdict[](100);
        for (uint32 h; h < 100; h++) {
            bool down = h >= 41 && h <= 50;
            vs[h] = _verdict(id, h, nodeKeyA, down ? 3 : 12, down ? 2 : 12);
        }
        uint256 before = usdc.balanceOf(buyer);
        bytes memory rep_ = _report(100, vs);
        vm.prank(relayer);
        oracle.relayReport(rep_);

        Ticket memory t = rm.getTicket(id);
        assertEq(t.confirmed, 90);
        assertEq(t.missed, 10);
        assertEq(usdc.balanceOf(buyer) - before, 30_750000);
        assertEq(uint8(t.status), uint8(TicketStatus.Settled));
        assertEq(vault.positionOf(providerA, sid).bond, 600e6 - 30_750000);
    }

    function test_DeadNodeStillSlashedOnProbeEvidence() public {
        uint256 id = _openTicket(10);
        bytes memory rep_ = _report(1, _one(_verdict(id, 0, 0, 0, 1)));
        vm.prank(relayer);
        oracle.relayReport(rep_); // no provider sig
        assertEq(rm.getTicket(id).missed, 1);
    }

    function test_DisagreementIsDisputedNeverPaid() public {
        uint256 id = _openTicket(10);
        uint256 before = usdc.balanceOf(buyer);
        bytes memory rep_ = _report(1, _one(_verdict(id, 0, nodeKeyA, 12, 1)));
        vm.prank(relayer);
        oracle.relayReport(rep_);
        assertEq(rm.getTicket(id).disputed, 1);
        assertEq(usdc.balanceOf(buyer), before);

        vm.prank(admin);
        rm.resolveDispute(id, 0, 1);
        assertEq(rm.getTicket(id).missed, 1);
        assertGt(usdc.balanceOf(buyer), before);
    }

    function test_ForgedProviderSigIsDisputeNotConfirm() public {
        uint256 id = _openTicket(10);
        DeliveryOracle.Verdict memory v = _verdict(id, 0, nodeKeyB, 12, 12); // wrong node key
        bytes memory rep_ = _report(1, _one(v));
        vm.prank(relayer);
        oracle.relayReport(rep_);
        assertEq(rm.getTicket(id).confirmed, 0);
        assertEq(rm.getTicket(id).disputed, 1);
    }

    function test_HourCannotBeVerdictedEarlyOrTwice() public {
        _bondAndMint(providerA, 1_000e6, 10);
        _give(buyer, 10, providerA);
        uint256 id = _redeem(buyer, 10)[0];
        _post(id);
        // hour 0 has not elapsed yet: skipped, not reverted
        bytes memory rep_ = _report(1, _one(_verdict(id, 0, nodeKeyA, 12, 12)));
        vm.prank(relayer);
        oracle.relayReport(rep_);
        assertEq(rm.getTicket(id).confirmed, 0);

        vm.warp(block.timestamp + 5 minutes);
        rep_ = _report(2, _one(_verdict(id, 0, nodeKeyA, 12, 12)));
        vm.prank(relayer);
        oracle.relayReport(rep_);
        rep_ = _report(3, _one(_verdict(id, 0, nodeKeyA, 12, 12)));
        vm.prank(relayer);
        oracle.relayReport(rep_);
        assertEq(rm.getTicket(id).confirmed, 1);
    }

    // ───────────────────────── oracle intake ─────────────────────────

    function test_OnReportFromForwarder() public {
        uint256 id = _openTicket(10);
        bytes memory rep_ = _report(5, _one(_verdict(id, 0, nodeKeyA, 12, 12)));
        vm.prank(forwarder);
        oracle.onReport("", rep_);
        assertEq(rm.getTicket(id).confirmed, 1);
    }

    function test_RevertWrongForwarder() public {
        vm.expectRevert(abi.encodeWithSelector(ReceiverTemplate.InvalidSender.selector, buyer, forwarder));
        vm.prank(buyer);
        oracle.onReport("", _report(5, new DeliveryOracle.Verdict[](0)));
    }

    function test_RevertWrongChainAndStale() public {
        DeliveryOracle.Report memory r = _emptyReport(5);
        r.chainSelector = 1;
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(DeliveryOracle.WrongChain.selector, uint64(1)));
        oracle.relayReport(abi.encode(r));

        vm.prank(relayer);
        oracle.relayReport(abi.encode(_emptyReport(5)));
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(DeliveryOracle.StaleReport.selector, uint64(5), uint64(5)));
        oracle.relayReport(abi.encode(_emptyReport(5)));
    }

    function test_RelayDisabledOutsideSimulation() public {
        vm.prank(admin);
        oracle.setSimulationMode(false);
        vm.prank(relayer);
        vm.expectRevert(DeliveryOracle.SimulationOff.selector);
        oracle.relayReport(abi.encode(_emptyReport(5)));
    }

    function test_ReleaseBondAfterWeek() public {
        _bondAndMint(providerA, 600e6, 10);
        vm.prank(providerA);
        vm.expectRevert(BondVault.DeliveryNotOver.selector);
        vault.releaseBond(sid);
        vm.warp(WEEK_START + 8 days);
        vm.prank(providerA);
        vault.releaseBond(sid);
        assertEq(usdc.balanceOf(providerA), 10_000e6);
    }

    function test_FaucetCooldown() public {
        vm.prank(buyer);
        usdc.faucet();
        vm.prank(buyer);
        vm.expectRevert();
        usdc.faucet();
        vm.warp(block.timestamp + 1 hours);
        vm.prank(buyer);
        usdc.faucet();
    }

    // ───────────────────────── fuzz ─────────────────────────

    function testFuzz_MintNeverExceedsBond(uint96 bond, uint32 hrs) public {
        bond = uint96(bound(bond, 1e6, 9_000e6));
        hrs = uint32(bound(hrs, 1, 50_000));
        vm.startPrank(providerA);
        usdc.approve(address(vault), bond);
        vault.depositBond(sid, bond);
        uint256 required = (uint256(hrs) * MARK * 3000) / 10_000;
        if (required > bond) vm.expectRevert();
        vault.mint(sid, hrs);
        vm.stopPrank();
        BondVault.Position memory p = vault.positionOf(providerA, sid);
        assertLe((uint256(p.minted) * MARK * 3000) / 10_000, p.bond);
    }

    function testFuzz_SlashCappedAtBond(uint32 hrs, uint8 missed) public {
        hrs = uint32(bound(hrs, 2, 60));
        missed = uint8(bound(missed, 1, hrs));
        _bondAndMint(providerA, (uint256(hrs) * MARK * 3000) / 10_000 + 1, hrs);
        _give(buyer, hrs, providerA);
        uint256 id = _redeem(buyer, hrs)[0];
        _post(id);
        vm.warp(block.timestamp + uint256(hrs) * 5 minutes);
        DeliveryOracle.Verdict[] memory vs = new DeliveryOracle.Verdict[](missed);
        for (uint32 h; h < missed; h++) vs[h] = _verdict(id, h, nodeKeyA, 0, 0);
        uint256 bondBefore = vault.positionOf(providerA, sid).bond;
        uint256 before = usdc.balanceOf(buyer);
        bytes memory rep_ = _report(1, vs);
        vm.prank(relayer);
        oracle.relayReport(rep_);
        assertLe(usdc.balanceOf(buyer) - before, bondBefore);
    }

    // ───────────────────────── helpers ─────────────────────────

    function _openTicket(uint32 hrs) internal returns (uint256 id) {
        _bondAndMint(providerA, 1_000e6, hrs);
        _give(buyer, hrs, providerA);
        id = _redeem(buyer, hrs)[0];
        _post(id);
        vm.warp(block.timestamp + uint256(hrs) * 5 minutes);
    }

    function _emptyReport(uint64 at) internal pure returns (DeliveryOracle.Report memory r) {
        r.chainSelector = SELECTOR;
        r.scheduledAt = at;
        r.verdicts = new DeliveryOracle.Verdict[](0);
        r.marks = new DeliveryOracle.Mark[](0);
        r.ratios = new DeliveryOracle.Ratio[](0);
        r.checks = new DeliveryOracle.MarginCheck[](0);
    }
}
