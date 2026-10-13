// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {SilicaMarkFeed} from "../src/kuru/SilicaMarkFeed.sol";
import {ISeriesRegistry} from "../src/interfaces/ISilica.sol";

/// @notice Deploys one Kuru-compatible USD price feed per series (the CRE mark) and writes
///         packages/shared/kuru-feeds.<chainId>.json. Kuru needs a feed per token to list a market.
contract DeployKuruFeeds is Script {
    function run() external {
        string memory path = string.concat(vm.projectRoot(), "/../packages/shared/addresses.", vm.toString(block.chainid), ".json");
        ISeriesRegistry registry = ISeriesRegistry(vm.parseJsonAddress(vm.readFile(path), ".SeriesRegistry"));
        uint256 n = registry.seriesCount();

        string memory out = "feeds";
        string memory json;
        vm.startBroadcast(vm.envUint("DEPLOYER_KEY"));
        for (uint256 s = 1; s <= n; s++) {
            SilicaMarkFeed feed = new SilicaMarkFeed(registry, s);
            json = vm.serializeAddress(out, vm.toString(registry.getSeries(s).token), address(feed));
            console2.log("series", s, address(feed));
        }
        vm.stopBroadcast();
        vm.writeJson(json, string.concat(vm.projectRoot(), "/../packages/shared/kuru-feeds.", vm.toString(block.chainid), ".json"));
    }
}
