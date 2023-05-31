// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "./hedera/HederaResponseCodes.sol";
import "./hedera/IHederaTokenService.sol";
import "./hedera/HederaTokenService.sol";
import "./hedera/ExpiryHelper.sol";
import "./hedera/KeyHelper.sol";

contract RLF_NFT is ExpiryHelper, KeyHelper, HederaTokenService {
    address owner;
    address nftToken;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner(address caller) {
        require(owner == caller, "invalid owner");

        _;
    }

    function createFungible(
        string memory name,
        string memory symbol,
        int64 autoRenewPeriod
    ) external payable onlyOwner(msg.sender) returns (address createdTokenAddress) {
        IHederaTokenService.HederaToken memory nft;
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);
        keys[0] = getSingleKey(KeyType.SUPPLY, KeyValueType.CONTRACT_ID, address(this));
        keys[1] = getSingleKey(KeyType.PAUSE, KeyValueType.CONTRACT_ID, address(this));

        nft.name = name;
        nft.symbol = symbol;
        nft.treasury = address(this);
        nft.memo = "memo";
        nft.tokenSupplyType = false;
        nft.freezeDefault = false;
        nft.tokenKeys = keys;
        nft.expiry = createAutoRenewExpiry(address(this), autoRenewPeriod);
        (int responseCode, address tokenAddress) = HederaTokenService.createNonFungibleToken(nft);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        nftToken = tokenAddress;
        createdTokenAddress = tokenAddress;
    }

    function mint(address _receiver, bytes[] memory _metadata) external payable onlyOwner(msg.sender) returns (int, int64, int64[] memory) {
        (
            int responseCodeTransfer,
            int64 newTotalSupply,
            int64[] memory serialNumbers
        ) = HederaTokenService.mintToken(nftToken, 0, _metadata);
        if (responseCodeTransfer != HederaResponseCodes.SUCCESS) {
            revert();
        }

        responseCodeTransfer = HederaTokenService.transferNFT(
            nftToken,
            address(this),
            _receiver,
            serialNumbers[0]
        );

        if (responseCodeTransfer != HederaResponseCodes.SUCCESS) {
            revert();
        }

        return (responseCodeTransfer, newTotalSupply, serialNumbers);
    }

    function setAddress(address _nftAddress) external payable onlyOwner(msg.sender) {
        nftToken = _nftAddress;
    }

    function associateNFT() external returns (int) {
        int responseCodeAssociate = HederaTokenService.associateToken(msg.sender, nftToken);
        if (responseCodeAssociate != HederaResponseCodes.SUCCESS) {
            revert();
        }
        return responseCodeAssociate;
    }

    function transferFrom(
        address _sender,
        address _receiver,
        int64 _serialNumber
    ) external payable returns (int) {
        int response = HederaTokenService.transferNFT(nftToken, _sender, _receiver, _serialNumber);

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer non-fungible token");
        }

        return response;
    }

    function approve(address _spender, uint256 _serialNumber) external payable returns (int) {
        int response = HederaTokenService.approveNFT(nftToken, _spender, _serialNumber);

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to approve non-fungible token");
        }

        return response;
    }
}
