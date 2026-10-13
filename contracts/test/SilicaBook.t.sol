// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Base} from "./Base.t.sol";
import {SilicaBook} from "../src/SilicaBook.sol";

contract SilicaBookTest is Base {
    function setUp() public override {
        super.setUp();
        _bondAndMint(providerA, 2_000e6, 1000);
        vm.prank(providerA);
        token.approve(address(book), type(uint256).max);
        vm.prank(buyer);
        usdc.approve(address(book), type(uint256).max);
        vm.prank(mm);
        usdc.approve(address(book), type(uint256).max);
    }

    function test_AskRestsAndMarketBuyFills() public {
        vm.prank(providerA);
        (uint256 askId,) = book.placeLimit(sid, false, 2_050000, 100);
        (, uint128 ask) = book.bestBidAsk(sid);
        assertEq(ask, 2_050000);

        vm.prank(buyer);
        (uint32 filled, uint256 cost) = book.marketBuy(sid, 40, 100e6);
        assertEq(filled, 40);
        assertEq(cost, 82e6);
        assertEq(token.balanceOf(buyer), 40e18);
        (,,,, uint32 remaining,,) = book.orders(askId);
        assertEq(remaining, 60);
    }

    function test_PriceTimePriorityAndImprovement() public {
        vm.startPrank(providerA);
        book.placeLimit(sid, false, 2_060000, 10);
        (uint256 first,) = book.placeLimit(sid, false, 2_050000, 10);
        book.placeLimit(sid, false, 2_050000, 10);
        vm.stopPrank();

        uint256 before = usdc.balanceOf(buyer);
        // limit bid at 2.10 crosses the two 2.05 asks first (oldest first), then 2.06
        vm.prank(buyer);
        (, uint32 filled) = book.placeLimit(sid, true, 2_100000, 25);
        assertEq(filled, 25);
        // paid at maker prices: 20 x 2.05 + 5 x 2.06, the rest refunded
        assertEq(before - usdc.balanceOf(buyer), 41e6 + 10_300000);
        (,,,, uint32 rem,,) = book.orders(first);
        assertEq(rem, 0);
    }

    function test_BidRestsAndMarketSellFills() public {
        vm.prank(mm);
        (uint256 bidId,) = book.placeLimit(sid, true, 2_000000, 50);
        (uint128 bid,) = book.bestBidAsk(sid);
        assertEq(bid, 2_000000);
        uint256 before = usdc.balanceOf(providerA);
        vm.prank(providerA);
        (uint32 filled, uint256 proceeds) = book.marketSell(sid, 20, 0);
        assertEq(filled, 20);
        assertEq(proceeds, 40e6);
        assertEq(usdc.balanceOf(providerA) - before, 40e6);
        assertEq(token.balanceOf(mm), 20e18);
        vm.prank(mm);
        book.cancel(bidId);
        (uint128 bid2,) = book.bestBidAsk(sid);
        assertEq(bid2, 0);
    }

    function test_DepthIsBestFirst() public {
        vm.startPrank(providerA);
        book.placeLimit(sid, false, 2_080000, 10);
        book.placeLimit(sid, false, 2_060000, 10);
        book.placeLimit(sid, false, 2_070000, 10);
        vm.stopPrank();
        (,, uint128[] memory askPx, uint64[] memory askHrs) = book.depth(sid, 3);
        assertEq(askPx[0], 2_060000);
        assertEq(askPx[1], 2_070000);
        assertEq(askPx[2], 2_080000);
        assertEq(askHrs[0], 10);
    }

    function test_Reverts() public {
        vm.startPrank(providerA);
        vm.expectRevert(abi.encodeWithSelector(SilicaBook.NotTickAligned.selector, uint128(2_055000)));
        book.placeLimit(sid, false, 2_055000, 10);
        vm.expectRevert(abi.encodeWithSelector(SilicaBook.BelowMinNotional.selector, uint256(4_100000)));
        book.placeLimit(sid, false, 2_050000, 2);
        book.placeLimit(sid, false, 2_050000, 10);
        // crossing your own order is rejected (no wash trades)
        usdc.approve(address(book), type(uint256).max);
        vm.expectRevert(SilicaBook.SelfTrade.selector);
        book.placeLimit(sid, true, 2_050000, 10);
        vm.stopPrank();
    }
}
