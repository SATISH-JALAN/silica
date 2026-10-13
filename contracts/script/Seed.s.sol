// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {SeriesRegistry} from "../src/SeriesRegistry.sol";
import {BondVault} from "../src/BondVault.sol";
import {RedemptionManager} from "../src/RedemptionManager.sol";
import {SilicaToken} from "../src/SilicaToken.sol";

/// @notice Seeds the testnet demo: gas for every wallet, test USDC, two simulated providers
///         (bond + mint across all weeks, node keys), market-maker inventory and a judge
///         wallet that can redeem W42 straight away. All liquidity is testnet-simulated.
contract Seed is Script {
    MockUSDC usdc;
    SeriesRegistry registry;
    BondVault vault;
    RedemptionManager rm;

    function run() external {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/../packages/shared/addresses.", vm.toString(block.chainid), ".json"));
        usdc = MockUSDC(vm.parseJsonAddress(json, ".MockUSDC"));
        registry = SeriesRegistry(vm.parseJsonAddress(json, ".SeriesRegistry"));
        vault = BondVault(vm.parseJsonAddress(json, ".BondVault"));
        rm = RedemptionManager(vm.parseJsonAddress(json, ".RedemptionManager"));

        uint256 deployer = vm.envUint("DEPLOYER_KEY");
        uint256 provA = vm.envUint("PROVIDER_A_KEY");
        uint256 provB = vm.envUint("PROVIDER_B_KEY");
        address mm = vm.envAddress("MM_ADDRESS");
        address judge = vm.envAddress("JUDGE_ADDRESS");
        uint256 gasEach = vm.envOr("MON_PER_WALLET", uint256(0.25 ether));

        // 1 · gas and USDC from the deployer
        address[9] memory wallets = [
            vm.addr(provA),
            vm.addr(provB),
            mm,
            judge,
            vm.envAddress("RELAYER_ADDRESS"),
            vm.envAddress("BUYER_A_ADDRESS"),
            vm.envAddress("BUYER_B_ADDRESS"),
            vm.envAddress("NODE_A_ADDRESS"),
            vm.envAddress("PROBE_ADDRESS")
        ];
        vm.startBroadcast(deployer);
        for (uint256 i; i < wallets.length; i++) {
            if (wallets[i].balance < gasEach / 2) payable(wallets[i]).transfer(gasEach);
            if (i < 7) usdc.mint(wallets[i], i < 2 ? 10_000e6 : 3_000e6);
        }
        vm.stopBroadcast();

        // 2 · providers: node keys, bonds and mints. NeoGPU (A) is well bonded; Basalt (B) runs thin.
        uint256 n = registry.seriesCount();
        _provider(provA, vm.envAddress("NODE_A_ADDRESS"), n, [uint256(500e6), 750e6, 600e6, 350e6, 300e6], [uint64(300), 1000, 800, 500, 400]);
        _provider(provB, vm.envAddress("NODE_B_ADDRESS"), n, [uint256(200e6), 330e6, 260e6, 150e6, 120e6], [uint64(250), 500, 400, 220, 180]);

        // 3 · market-maker inventory (OTC transfer, not a trade) and a judge wallet ready to redeem W42
        vm.startBroadcast(provA);
        for (uint256 s = 1; s <= n; s++) SilicaToken(registry.getSeries(s).token).transfer(mm, 120e18);
        SilicaToken(registry.getSeries(1).token).transfer(judge, 20e18);
        vm.stopBroadcast();
        vm.startBroadcast(provB);
        for (uint256 s = 1; s <= n; s++) SilicaToken(registry.getSeries(s).token).transfer(mm, 60e18);
        vm.stopBroadcast();

        console2.log("seeded", n, "series");
    }

    function _provider(uint256 pk, address nodeKey, uint256 n, uint256[5] memory bonds, uint64[5] memory hrs) internal {
        vm.startBroadcast(pk);
        rm.setNodeKey(nodeKey);
        usdc.approve(address(vault), type(uint256).max);
        for (uint256 s = 1; s <= n && s <= 5; s++) {
            vault.depositBond(s, bonds[s - 1]);
            vault.mint(s, hrs[s - 1]);
        }
        vm.stopBroadcast();
    }
}
