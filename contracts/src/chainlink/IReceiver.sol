// SPDX-License-Identifier: MIT
// Adapted from Chainlink CRE "Building Consumer Contracts" (docs.chain.link/cre).
pragma solidity ^0.8.26;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @notice Interface the Chainlink KeystoneForwarder calls to deliver a CRE report.
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}
