// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
import "./hedera/HederaResponseCodes.sol";
import "./hedera/IHederaTokenService.sol";
import "./hedera/HederaTokenService.sol";
import "./hedera/ExpiryHelper.sol";
import "./hedera/KeyHelper.sol";

contract RLF_REAL is ExpiryHelper, HederaTokenService, KeyHelper {
    address owner;
    address rlfToken;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner(address caller) {
        require(owner == caller, "invalid owner");

        _;
    }

    // create a fungible Token with no custom fees
    function createFungible(
        string memory name,
        string memory symbol,
        int64 initialSupply,
        int32 decimals,
        int64 autoRenewPeriod
    ) external payable onlyOwner(msg.sender) returns (address) {
        // IHederaTokenService.HederaToken memory token;
        // IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);
        // keys[0] = getSingleKey(KeyType.SUPPLY, KeyValueType.CONTRACT_ID, address(this));
        // keys[1] = getSingleKey(KeyType.PAUSE, KeyValueType.CONTRACT_ID, address(this));

        // token.name = name;
        // token.symbol = symbol;
        // token.treasury = address(this);
        // token.memo = "memo";
        // token.tokenSupplyType = false;
        // token.freezeDefault = false;
        // token.tokenKeys = keys;
        // // create the expiry schedule for the token using ExpiryHelper
        // token.expiry = createAutoRenewExpiry(address(this), autoRenewPeriod);

        // // call HTS precompiled contract, passing initial supply and decimals
        // (int responseCode, address tokenAddress) = HederaTokenService.createFungibleToken(
        //     token,
        //     initialSupply,
        //     decimals
        // );
        // if (responseCode != HederaResponseCodes.SUCCESS) {
        //     revert();
        // }

        // rlfToken = tokenAddress;
        // return tokenAddress;

        string memory memo = "memo";
        int64 initialTotalSupply = initialSupply;
        int64 maxSupply = initialSupply;
        bool freezeDefaultStatus = false;

        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);
        keys[0] = getSingleKey(KeyType.SUPPLY, KeyValueType.CONTRACT_ID, address(this));
        keys[1] = getSingleKey(KeyType.PAUSE, KeyValueType.CONTRACT_ID, address(this));

        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, address(this), autoRenewPeriod
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, address(this), memo, true, maxSupply, freezeDefaultStatus, keys, expiry
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
