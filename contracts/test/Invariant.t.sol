// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Base} from "./Base.t.sol";
import {BondVault} from "../src/BondVault.sol";
import {RedemptionManager} from "../src/RedemptionManager.sol";
import {DeliveryOracle} from "../src/DeliveryOracle.sol";
import {SilicaToken} from "../src/SilicaToken.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {Ticket} from "../src/interfaces/ISilica.sol";

/// @notice Random sequences of bond, mint, redeem and verdicts by two providers.
contract Handler is Test {
    Base internal base;
    BondVault internal vault;
    RedemptionManager internal rm;
    MockUSDC internal usdc;
    SilicaToken internal token;
    uint256 internal sid;
    address[2] internal providers;
    address internal holder;

    uint256 public mintedHours;
    uint256 public redeemedHours;

    constructor(BondVault v, RedemptionManager r, MockUSDC u, SilicaToken t, uint256 s, address a, address b, address h) {
        vault = v;
        rm = r;
        usdc = u;
        token = t;
        sid = s;
        providers = [a, b];
        holder = h;
    }

    function deposit(uint8 who, uint96 amount) external {
        address p = providers[who % 2];
        amount = uint96(bound(amount, 1e6, 500e6));
        usdc.mint(p, amount);
        vm.startPrank(p);
        usdc.approve(address(vault), amount);
        vault.depositBond(sid, amount);
        vm.stopPrank();
    }

    function mint(uint8 who, uint32 hrs) external {
        address p = providers[who % 2];
        hrs = uint32(bound(hrs, 1, 200));
        vm.prank(p);
        try vault.mint(sid, hrs) {
            mintedHours += hrs;
            vm.prank(p);
            token.transfer(holder, uint256(hrs) * 1e18);
        } catch {}
    }

    function redeem(uint32 hrs) external {
        uint256 bal = token.balanceOf(holder) / 1e18;
        if (bal == 0) return;
        hrs = uint32(bound(hrs, 1, bal));
        vm.prank(holder);
        rm.redeem(sid, hrs, bytes32(0), address(0xBEEF));
        redeemedHours += hrs;
    }
}

contract SilicaInvariants is Base {
    Handler handler;

    function setUp() public override {
        super.setUp();
        handler = new Handler(vault, rm, usdc, token, sid, providerA, providerB, buyer);
        vm.prank(admin);
        usdc.transferOwnership(address(handler));
        targetContract(address(handler));
    }

    /// Vault holds at least every provider's recorded bond.
    function invariant_VaultSolvent() public view {
        uint256 bonds = vault.positionOf(providerA, sid).bond + vault.positionOf(providerB, sid).bond;
        assertGe(usdc.balanceOf(address(vault)), bonds);
    }

    /// Token supply is exactly minted minus redeemed hours.
    function invariant_SupplyMatchesMintedMinusRedeemed() public view {
        assertEq(token.totalSupply(), (handler.mintedHours() - handler.redeemedHours()) * 1e18);
    }

    /// Assigned hours never exceed minted, and settled never exceeds assigned.
    function invariant_HourAccounting() public view {
        BondVault.Position memory a = vault.positionOf(providerA, sid);
        BondVault.Position memory b = vault.positionOf(providerB, sid);
        assertLe(a.assigned, a.minted);
        assertLe(b.assigned, b.minted);
        assertLe(a.settled, a.assigned);
        assertLe(b.settled, b.assigned);
        assertEq(uint256(a.assigned) + b.assigned, handler.redeemedHours());
    }
}
