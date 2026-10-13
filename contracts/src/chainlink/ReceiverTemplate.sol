// SPDX-License-Identifier: MIT
// Adapted from Chainlink's CRE ReceiverTemplate (docs.chain.link/cre/guides/workflow/
// using-evm-client/onchain-write/building-consumer-contracts). Checks that the caller
// is the configured forwarder and, once set, the workflow identity in the metadata.
pragma solidity ^0.8.26;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IReceiver} from "./IReceiver.sol";

abstract contract ReceiverTemplate is Ownable, IReceiver {
    address private s_forwarderAddress;
    address private s_expectedAuthor;
    bytes10 private s_expectedWorkflowName;
    bytes32 private s_expectedWorkflowId;

    error InvalidSender(address sender, address expected);
    error InvalidAuthor(address received, address expected);
    error InvalidWorkflowName(bytes10 received, bytes10 expected);
    error InvalidWorkflowId(bytes32 received, bytes32 expected);

    event ForwarderAddressUpdated(address indexed previous, address indexed current);
    event ExpectedAuthorUpdated(address indexed previous, address indexed current);
    event ExpectedWorkflowNameUpdated(bytes10 indexed previous, bytes10 indexed current);
    event ExpectedWorkflowIdUpdated(bytes32 indexed previous, bytes32 indexed current);

    constructor(address forwarderAddress, address owner_) Ownable(owner_) {
        s_forwarderAddress = forwarderAddress;
        emit ForwarderAddressUpdated(address(0), forwarderAddress);
    }

    /// @inheritdoc IReceiver
    function onReport(bytes calldata metadata, bytes calldata report) external override {
        if (msg.sender != s_forwarderAddress) revert InvalidSender(msg.sender, s_forwarderAddress);

        if (s_expectedWorkflowId != bytes32(0) || s_expectedAuthor != address(0) || s_expectedWorkflowName != bytes10(0)) {
            (bytes32 workflowId, bytes10 workflowName, address workflowOwner) = _decodeMetadata(metadata);
            if (s_expectedWorkflowId != bytes32(0) && workflowId != s_expectedWorkflowId) {
                revert InvalidWorkflowId(workflowId, s_expectedWorkflowId);
            }
            if (s_expectedAuthor != address(0) && workflowOwner != s_expectedAuthor) {
                revert InvalidAuthor(workflowOwner, s_expectedAuthor);
            }
            if (s_expectedWorkflowName != bytes10(0) && workflowName != s_expectedWorkflowName) {
                revert InvalidWorkflowName(workflowName, s_expectedWorkflowName);
            }
        }

        _processReport(report);
    }

    function getForwarderAddress() external view returns (address) {
        return s_forwarderAddress;
    }

    function setForwarderAddress(address forwarder) external onlyOwner {
        emit ForwarderAddressUpdated(s_forwarderAddress, forwarder);
        s_forwarderAddress = forwarder;
    }

    /// @dev Leave unset while simulating: the mock forwarder supplies no workflow metadata.
    function setExpectedAuthor(address author) external onlyOwner {
        emit ExpectedAuthorUpdated(s_expectedAuthor, author);
        s_expectedAuthor = author;
    }

    function setExpectedWorkflowName(bytes10 name) external onlyOwner {
        emit ExpectedWorkflowNameUpdated(s_expectedWorkflowName, name);
        s_expectedWorkflowName = name;
    }

    function setExpectedWorkflowId(bytes32 id) external onlyOwner {
        emit ExpectedWorkflowIdUpdated(s_expectedWorkflowId, id);
        s_expectedWorkflowId = id;
    }

    /// @dev Metadata layout: workflowId (32) | workflowName (10) | workflowOwner (20).
    function _decodeMetadata(bytes memory metadata)
        internal
        pure
        returns (bytes32 workflowId, bytes10 workflowName, address workflowOwner)
    {
        assembly ("memory-safe") {
            workflowId := mload(add(metadata, 32))
            workflowName := mload(add(metadata, 64))
            workflowOwner := shr(mul(12, 8), mload(add(metadata, 74)))
        }
    }

    function _processReport(bytes calldata report) internal virtual;

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
