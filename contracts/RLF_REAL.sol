// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;

import "./hedera/HederaResponseCodes.sol";
import "./hedera/IHederaTokenService.sol";
import "./hedera/HederaTokenService.sol";
import "./hedera/ExpiryHelper.sol";
import "./hedera/KeyHelper.sol";


contract RLF_REAL is HederaTokenService, ExpiryHelper, KeyHelper {
    address owner;
    address rlfToken;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner(address caller) {
        require(owner == caller, "invalid owner");

        _;
    }

    string memo = "memo";
    int64 maxSupply = 5000000000000;
    bool freezeDefaultStatus = false;

    function createFungible(
        string calldata name, 
        string calldata symbol, 
        int64 initialTotalSupply, 
        int32 decimals, 
        int64 autoRenewable
    ) public payable onlyOwner(msg.sender) returns (address) {
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);
        keys[0] = getSingleKey(KeyType.SUPPLY, KeyValueType.CONTRACT_ID, address(this));
        keys[1] = getSingleKey(KeyType.PAUSE, KeyValueType.CONTRACT_ID, address(this));

        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, address(this), autoRenewable
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, address(this), memo, false, 0, freezeDefaultStatus, keys, expiry
        );

        (int responseCode, address tokenAddress) =
        HederaTokenService.createFungibleToken(token, initialTotalSupply, decimals);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }

        rlfToken = tokenAddress;
        return tokenAddress;
    }

    function mint(
        address _receiver,
        int64 _amount
    ) external payable onlyOwner(msg.sender) returns (int) {
        int responseCodeTransfer = HederaTokenService.transferToken(
            rlfToken,
            address(this),
            _receiver,
            _amount
        );
        if (responseCodeTransfer != HederaResponseCodes.SUCCESS) {
            revert();
        }

        return responseCodeTransfer;
    }

    function setAddress(address _nftAddress) external payable onlyOwner(msg.sender) {
        rlfToken = _nftAddress;
    }

    function associateToken() external returns (int) {
        int responseCodeAssociate = HederaTokenService.associateToken(msg.sender, rlfToken);
        if (responseCodeAssociate != HederaResponseCodes.SUCCESS) {
            revert();
        }
        return responseCodeAssociate;
    }

    function transferFrom(
        address _sender,
        address _receiver,
        int64 _amount
    ) external payable returns (int) {
        int responseCodeTransfer = HederaTokenService.transferToken(
            rlfToken,
            _sender,
            _receiver,
            _amount
        );
        if (responseCodeTransfer != HederaResponseCodes.SUCCESS) {
            revert();
        }

        return responseCodeTransfer;
    }

    function approve(uint256 _amount) external payable returns (int) {
        int response = HederaTokenService.approve(rlfToken, msg.sender, _amount);

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to approve fungible token");
        }

        return response;
    }
}