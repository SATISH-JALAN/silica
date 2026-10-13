// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {SeriesRegistry} from "../src/SeriesRegistry.sol";
import {BondVault} from "../src/BondVault.sol";
import {RedemptionManager} from "../src/RedemptionManager.sol";
import {DeliveryOracle} from "../src/DeliveryOracle.sol";
import {SilicaBook} from "../src/SilicaBook.sol";
import {IBondVault, IRedemptionManager, ISeriesRegistry} from "../src/interfaces/ISilica.sol";

/// @notice Deploys the Silica core, wires every role, creates the H100·APAC series and
///         writes addresses to packages/shared/addresses.<chainId>.json.
///
/// Env: DEPLOYER_KEY, RELAYER_ADDRESS, PROVIDER_A_ADDRESS, PROVIDER_B_ADDRESS,
///      optional FORWARDER_ADDRESS (defaults to the CRE MockKeystoneForwarder on Monad Testnet),
///      optional DEMO_HOUR_SECONDS (default 300: one delivery hour = 5 minutes in demo mode).
contract Deploy is Script {
    // Monad Testnet, from smartcontractkit/chain-selectors
    uint64 constant MONAD_TESTNET_SELECTOR = 2183018362218727504;
    // CRE simulation forwarder on Monad Testnet (docs.chain.link forwarder directory)
    address constant MOCK_FORWARDER = 0xB9F79d863261869B234c481D1f9A7af84AeAd192;

    uint64 constant W42 = 1_791_763_200; // Mon 12 Oct 2026 00:00 UTC
    uint64 constant WEEK = 7 days;

    struct Out {
        MockUSDC usdc;
        SeriesRegistry registry;
        BondVault vault;
        RedemptionManager rm;
        DeliveryOracle oracle;
        SilicaBook book;
        uint256[5] series;
    }

    function run() external returns (Out memory o) {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        address admin = vm.addr(pk);
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        address forwarder = vm.envOr("FORWARDER_ADDRESS", MOCK_FORWARDER);
        uint64 hourSeconds = uint64(vm.envOr("DEMO_HOUR_SECONDS", uint256(300)));

        vm.startBroadcast(pk);
        o.usdc = new MockUSDC(admin);
        o.registry = new SeriesRegistry(admin);
        o.vault = new BondVault(admin, o.usdc, ISeriesRegistry(address(o.registry)));
        o.rm = new RedemptionManager(admin, ISeriesRegistry(address(o.registry)), IBondVault(address(o.vault)));
        o.oracle = new DeliveryOracle(
            admin,
            forwarder,
            MONAD_TESTNET_SELECTOR,
            ISeriesRegistry(address(o.registry)),
            IBondVault(address(o.vault)),
            IRedemptionManager(address(o.rm))
        );
        o.book = new SilicaBook(o.usdc, ISeriesRegistry(address(o.registry)));

        o.registry.setCore(address(o.vault), address(o.rm));
        o.registry.grantRole(o.registry.ORACLE_ROLE(), address(o.oracle));
        o.vault.grantRole(o.vault.ORACLE_ROLE(), address(o.oracle));
        o.vault.grantRole(o.vault.REDEMPTION_ROLE(), address(o.rm));
        o.vault.grantRole(o.vault.PROVIDER_ROLE(), vm.envAddress("PROVIDER_A_ADDRESS"));
        o.vault.grantRole(o.vault.PROVIDER_ROLE(), vm.envAddress("PROVIDER_B_ADDRESS"));
        o.rm.grantRole(o.rm.ORACLE_ROLE(), address(o.oracle));
        o.rm.setParams(30 minutes, hourSeconds);
        o.oracle.grantRole(o.oracle.RELAYER_ROLE(), relayer);
        o.oracle.setSimulationMode(true);

        // W42 is the live demo week; W44–W47 form the forward curve
        uint8[5] memory wks = [42, 44, 45, 46, 47];
        uint128[5] memory marks = [uint128(2_020000), 2_050000, 2_120000, 2_090000, 2_180000];
        for (uint256 i; i < 5; i++) {
            uint64 start = W42 + uint64(wks[i] - 42) * WEEK;
            string memory w = vm.toString(uint256(wks[i]));
            o.series[i] = o.registry.createSeries(
                "H100-80GB",
                "APAC",
                start,
                3000,
                15000,
                marks[i],
                string.concat("Silica H100 APAC W", w),
                string.concat("SIL-H100-APAC-W", w)
            );
        }
        vm.stopBroadcast();

        _write(o, admin, relayer, forwarder, hourSeconds, wks);
    }

    function _write(Out memory o, address admin, address relayer, address forwarder, uint64 hourSeconds, uint8[5] memory wks)
        internal
    {
        string memory k = "addresses";
        vm.serializeUint(k, "chainId", block.chainid);
        // a string: the selector exceeds 2^53 and would lose precision as a JSON number
        vm.serializeString(k, "chainSelector", vm.toString(uint256(MONAD_TESTNET_SELECTOR)));
        vm.serializeUint(k, "deployBlock", block.number);
        vm.serializeUint(k, "hourSeconds", hourSeconds);
        vm.serializeAddress(k, "admin", admin);
        vm.serializeAddress(k, "relayer", relayer);
        vm.serializeAddress(k, "forwarder", forwarder);
        vm.serializeAddress(k, "MockUSDC", address(o.usdc));
        vm.serializeAddress(k, "SeriesRegistry", address(o.registry));
        vm.serializeAddress(k, "BondVault", address(o.vault));
        vm.serializeAddress(k, "RedemptionManager", address(o.rm));
        vm.serializeAddress(k, "DeliveryOracle", address(o.oracle));
        vm.serializeAddress(k, "SilicaBook", address(o.book));

        string memory sk = "series";
        string memory seriesJson;
        for (uint256 i; i < 5; i++) {
            string memory one = string.concat("s", vm.toString(i));
            vm.serializeUint(one, "seriesId", o.series[i]);
            vm.serializeUint(one, "week", wks[i]);
            seriesJson = vm.serializeString(
                sk, vm.toString(o.series[i]), vm.serializeAddress(one, "token", o.registry.getSeries(o.series[i]).token)
            );
        }
        string memory json = vm.serializeString(k, "series", seriesJson);
        string memory path = string.concat(vm.projectRoot(), "/../packages/shared/addresses.", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("wrote", path);
    }
}
