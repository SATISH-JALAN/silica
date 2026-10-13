// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {SilicaMarkFeed} from "../src/kuru/SilicaMarkFeed.sol";
import {ISeriesRegistry} from "../src/interfaces/ISilica.sol";

contract SilicaMarkFeedTest is Base {
    SilicaMarkFeed feed;

    function setUp() public override {
        super.setUp();
        feed = new SilicaMarkFeed(ISeriesRegistry(address(registry)), sid);
    }

    function test_feedServesMarkInUsd18() public view {
        assertEq(feed.fetchPrice(), 2.05e18);
        assertEq(feed.priceUsd18(), 2.05e18);
        assertEq(feed.observedAt(), block.timestamp);
        assertEq(feed.maxPriceAge(), 300);
        assertEq(feed.token(), address(token));
    }

    function test_feedFollowsCreMark() public {
        vm.prank(address(oracle));
        registry.setMark(sid, 2_180000, uint64(block.timestamp + 1));
        assertEq(feed.fetchPrice(), 2.18e18);
        assertEq(feed.markUpdatedAt(), block.timestamp + 1);
    }

    function test_unknownSeriesReverts() public {
        SilicaMarkFeed bad = new SilicaMarkFeed(ISeriesRegistry(address(registry)), 99);
        vm.expectRevert();
        bad.fetchPrice();
    }
}
