// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MerkleAnchor {
    address public owner;

    mapping(bytes32 => bool) private anchoredRoots;
    mapping(bytes32 => uint256) private anchoredAt;

    event RootAnchored(
        bytes32 indexed root,
        address indexed actor,
        uint256 timestamp
    );

    error ZeroRoot();
    error AlreadyAnchored();
    error NotOwner();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function anchorRoot(bytes32 root) external onlyOwner {
        if (root == bytes32(0)) revert ZeroRoot();
        if (anchoredRoots[root]) revert AlreadyAnchored();

        anchoredRoots[root] = true;
        anchoredAt[root] = block.timestamp;

        emit RootAnchored(root, msg.sender, block.timestamp);
    }

    function isRootAnchored(bytes32 root) external view returns (bool) {
        return anchoredRoots[root];
    }

    function getRootAnchoredAt(bytes32 root) external view returns (uint256) {
        return anchoredAt[root];
    }
}
