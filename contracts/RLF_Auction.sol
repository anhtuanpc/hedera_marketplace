// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./hedera/HederaTokenService.sol";
import "./hedera/IHederaTokenService.sol";

library SafeCast {
    function toInt64(int256 value) internal pure returns (int64 downcasted) {
        downcasted = int64(value);
        require(downcasted == value, "SafeCast: value doesn't fit in 64 bits");
    }

    function toInt256(uint256 value) internal pure returns (int256) {
        require(value <= uint256(type(int256).max), "SafeCast: value doesn't fit in an int256");
        return int256(value);
    }
}

contract RLF_Auction is Ownable, ReentrancyGuard, HederaTokenService {
    struct AuctionNFT {
        address nft;
        int64 tokenId;
        address creator;
        address payToken;
        int64 initialPrice;
        int64 ceilingPrice;
        int64 minBid;
        int64 startTime;
        int64 endTime;
        address lastBidder;
        int64 heighestBid;
        address winner;
        bool success;
    }

    mapping(address => bool) private payableToken;
    address[] private tokens;

    // nft => tokenId => acuton struct
    mapping(address => mapping(int64 => AuctionNFT)) private auctionNfts;

    // auciton index => bidding counts => bidder address => bid price
    mapping(int64 => mapping(int64 => mapping(address => int64))) private bidPrices;

    // events
    event CreatedAuction(
        address indexed nft,
        int64 indexed tokenId,
        address payToken,
        int64 price,
        int64 minBid,
        int64 startTime,
        int64 endTime,
        address indexed creator
    );

    event PlacedBid(
        address indexed nft,
        int64 indexed tokenId,
        address payToken,
        int64 bidPrice,
        address indexed bidder
    );

    event ResultedAuction(
        address indexed nft,
        int64 indexed tokenId,
        address creator,
        address indexed winner,
        int64 price,
        address caller
    );

    // variables for fees here...
    int64 public royalFee = 500;
    int64 constant divisor = 10000;

    modifier isAuction(address _nft, int64 _tokenId) {
        AuctionNFT memory auction = auctionNfts[_nft][_tokenId];
        require(auction.nft != address(0) && !auction.success, "auction not created yet");
        _;
    }

    modifier isNotAuction(address _nft, int64 _tokenId) {
        AuctionNFT memory auction = auctionNfts[_nft][_tokenId];
        require(auction.nft == address(0) || auction.success, "auction already created");
        _;
    }

    function tokenAssociate(address tokenId) external payable {
        int response = HederaTokenService.associateToken(address(this), tokenId);

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Associate Failed");
        }
    }

    // funciton to update royalFee...
    function setRoyalFee(int64 _royalFee) public onlyOwner {
        require(_royalFee < divisor, "invalid royal fee");
        royalFee = _royalFee;
    }

    function createAuction(
        address _nft,
        int64 _tokenId,
        address _payToken,
        int64 _price,
        int64 _ceilingPrice,
        int64 _minBid,
        int64 _startTime,
        int64 _endTime
    ) external payable isNotAuction(_nft, _tokenId) {
        require(_endTime > _startTime, "invalid end time");
        require(_ceilingPrice >= _price, "invalid ceiling price");
        require(_price >= _minBid, "invalid price");

        int response = HederaTokenService.transferNFT(_nft, msg.sender, address(this), _tokenId);

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer nft");
        }

        auctionNfts[_nft][_tokenId] = AuctionNFT({
            nft: _nft,
            tokenId: _tokenId,
            creator: msg.sender,
            payToken: _payToken,
            initialPrice: _price,
            ceilingPrice: _ceilingPrice,
            minBid: _minBid,
            startTime: _startTime,
            endTime: _endTime,
            lastBidder: address(0),
            heighestBid: _price - _minBid,
            winner: address(0),
            success: false
        });

        emit CreatedAuction(
            _nft,
            _tokenId,
            _payToken,
            _price,
            _minBid,
            _startTime,
            _endTime,
            msg.sender
        );
    }

    function cancelAuction(
        address _nft,
        int64 _tokenId
    ) external payable isAuction(_nft, _tokenId) {
        AuctionNFT memory auction = auctionNfts[_nft][_tokenId];
        require(auction.creator == msg.sender, "not auction creator");
        require(auction.lastBidder == address(0), "already have bidder");
        int response = HederaTokenService.transferNFT(_nft, address(this), msg.sender, _tokenId);

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer nft");
        }
        delete auctionNfts[_nft][_tokenId];
    }

    function placeBid(
        address _nft,
        int64 _tokenId,
        int64 _bidPrice
    ) external payable isAuction(_nft, _tokenId) nonReentrant {
        require(
            castToInt64(block.timestamp) >= auctionNfts[_nft][_tokenId].startTime,
            "auction not start"
        );
        require(
            castToInt64(block.timestamp) <= auctionNfts[_nft][_tokenId].endTime,
            "auction ended"
        );
        require(
            _bidPrice >=
                auctionNfts[_nft][_tokenId].heighestBid + auctionNfts[_nft][_tokenId].minBid,
            "less than min bid price"
        );

        AuctionNFT storage auction = auctionNfts[_nft][_tokenId];
        int response = HederaTokenService.transferToken(
            auction.payToken,
            msg.sender,
            address(this),
            _bidPrice
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer token");
        }

        if (auction.lastBidder != address(0)) {
            address lastBidder = auction.lastBidder;
            int64 lastBidPrice = auction.heighestBid;

            // Transfer back to last bidder
            response = HederaTokenService.transferToken(
                auction.payToken,
                address(this),
                lastBidder,
                lastBidPrice
            );

            if (response != HederaResponseCodes.SUCCESS) {
                revert("Failed to transfer token");
            }
        }

        // Set new heighest bid price
        auction.lastBidder = msg.sender;
        auction.heighestBid = _bidPrice;

        emit PlacedBid(_nft, _tokenId, auction.payToken, _bidPrice, msg.sender);

        if (_bidPrice >= auction.ceilingPrice) {
            _processEndAuction(_nft, _tokenId);
        }
    }

    function completeBid(address _nft, int64 _tokenId) external payable nonReentrant {
        require(!auctionNfts[_nft][_tokenId].success, "already resulted");
        require(
            msg.sender == owner() ||
                msg.sender == auctionNfts[_nft][_tokenId].creator ||
                msg.sender == auctionNfts[_nft][_tokenId].lastBidder,
            "not creator, winner, or owner"
        );
        require(
            castToInt64(block.timestamp) > auctionNfts[_nft][_tokenId].endTime ||
                msg.sender == auctionNfts[_nft][_tokenId].creator,
            "auction not ended or require owner for soon complete"
        );

        _processEndAuction(_nft, _tokenId);
    }

    function getRoyalFeeAmount(int64 _tokenAmount) public view returns (int64) {
        return (_tokenAmount * royalFee) / divisor;
    }

    // for test only
    function getTime() public view returns (int64) {
        return castToInt64(block.timestamp);
    }

    function _processEndAuction(address _nft, int64 _tokenId) internal {
        AuctionNFT storage auction = auctionNfts[_nft][_tokenId];
        auction.success = true;
        auction.winner = auction.creator;

        int64 heighestBid = auction.heighestBid;
        int64 totalPrice = heighestBid;
        int64 royalFeeAmount = getRoyalFeeAmount(totalPrice);

        // Transfer to auction creator, the royalFee to admin wallet
        int response = HederaTokenService.transferToken(
            auction.payToken,
            address(this),
            auction.creator,
            totalPrice - royalFeeAmount
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer token");
        }
        response = HederaTokenService.transferToken(
            auction.payToken,
            address(this),
            owner(),
            royalFeeAmount
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer token");
        }
        // Transfer NFT to the winnertoken
        response = HederaTokenService.transferNFT(
            auction.nft,
            address(this),
            auction.lastBidder,
            auction.tokenId
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer nft");
        }
        emit ResultedAuction(
            _nft,
            _tokenId,
            auction.creator,
            auction.lastBidder,
            auction.heighestBid,
            msg.sender
        );
    }

    function castToInt64(uint256 input) internal pure returns (int64) {
        int256 middle = SafeCast.toInt256(input);
        return SafeCast.toInt64(middle);
    }
}
