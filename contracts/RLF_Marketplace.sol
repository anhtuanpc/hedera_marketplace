// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./hedera/HederaTokenService.sol";

contract RLF_Marketplace is Ownable, ReentrancyGuard, HederaTokenService {
    struct ListNFT {
        address nft;
        int64 tokenId;
        address seller;
        address payToken;
        int64 price;
        bool sold;
    }

    struct OfferNFT {
        address nft;
        int64 tokenId;
        address offerer;
        address payToken;
        int64 offerPrice;
        bool accepted;
    }

    mapping(address => bool) private payableToken;
    address[] private tokens;
    int64 public royalFee = 500;
    int64 constant divisor = 10000;

    // nft => tokenId => list struct
    mapping(address => mapping(int64 => ListNFT)) private listNfts;

    // nft => tokenId => offerer address => offer struct
    mapping(address => mapping(int64 => mapping(address => OfferNFT))) private offerNfts;

    // auciton index => bidding counts => bidder address => bid price
    mapping(int64 => mapping(int64 => mapping(address => int64))) private bidPrices;

    mapping(address => mapping(int64 => address[])) public offerList;

    // events
    event ListedNFT(
        address indexed nft,
        int64 indexed tokenId,
        address payToken,
        int64 price,
        address indexed seller
    );
    event BoughtNFT(
        address indexed nft,
        int64 indexed tokenId,
        address payToken,
        int64 price,
        address seller,
        address indexed buyer
    );
    event OfferredNFT(
        address indexed nft,
        int64 indexed tokenId,
        address payToken,
        int64 offerPrice,
        address indexed offerer
    );
    event CanceledOfferredNFT(
        address indexed nft,
        int64 indexed tokenId,
        address payToken,
        int64 offerPrice,
        address indexed offerer
    );
    event AcceptedNFT(
        address indexed nft,
        int64 indexed tokenId,
        address payToken,
        int64 offerPrice,
        address offerer,
        address indexed nftOwner
    );

    modifier isListedNFT(address _nft, int64 _tokenId) {
        ListNFT memory listedNFT = listNfts[_nft][_tokenId];
        require(listedNFT.seller != address(0) && !listedNFT.sold, "not listed");
        _;
    }

    modifier isNotListedNFT(address _nft, int64 _tokenId) {
        ListNFT memory listedNFT = listNfts[_nft][_tokenId];
        require(listedNFT.seller == address(0) || listedNFT.sold, "already listed");
        _;
    }

    modifier isOfferredNFT(
        address _nft,
        int64 _tokenId,
        address _offerer
    ) {
        OfferNFT memory offer = offerNfts[_nft][_tokenId][_offerer];
        require(offer.offerPrice > 0 && offer.offerer != address(0), "not offerred nft");
        _;
    }

    function setRoyalFee(int64 _royalFee) public onlyOwner {
        require(_royalFee < divisor, "invalid royal fee");
        royalFee = _royalFee;
    }

    function tokenAssociate(address tokenId) external payable {
        int response = HederaTokenService.associateToken(address(this), tokenId);

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Associate Failed");
        }
    }

    function putNftOnMarketplace(
        address _nft,
        int64 _tokenId,
        address _payToken,
        int64 _price
    ) external payable {
        transferNFTInternal(_nft, msg.sender, address(this), _tokenId);
        listNfts[_nft][_tokenId] = ListNFT({
            nft: _nft,
            tokenId: _tokenId,
            seller: msg.sender,
            payToken: _payToken,
            price: _price,
            sold: false
        });
        emit ListedNFT(_nft, _tokenId, _payToken, _price, msg.sender);
    }

    function putNftOffMarketplace(
        address _nft,
        int64 _tokenId
    ) external payable isListedNFT(_nft, _tokenId) {
        ListNFT memory listedNFT = listNfts[_nft][_tokenId];
        require(listedNFT.seller == msg.sender, "not listed owner");
        transferNFTInternal(_nft, address(this), msg.sender, _tokenId);
        delete listNfts[_nft][_tokenId];
        address winner = address (0); // no winner as put off NFT
        returnFee(_nft, _tokenId, winner);
    }

    function buy(
        address _nft,
        int64 _tokenId,
        address _payToken,
        int64 _price
    ) external payable isListedNFT(_nft, _tokenId) nonReentrant {
        ListNFT storage listedNft = listNfts[_nft][_tokenId];
        require(_payToken != address(0) && _payToken == listedNft.payToken, "invalid pay token");
        require(!listedNft.sold, "nft already sold");
        require(_price >= listedNft.price, "invalid price");
        listedNft.sold = true;
        int64 totalPrice = _price;

        // Transfer to nft owner
        int64 buyFee = getRoyalFeeAmount(totalPrice);
        transferTokenInternal(listedNft.payToken, msg.sender, owner(), buyFee);
        transferTokenInternal(listedNft.payToken, msg.sender, listedNft.seller, totalPrice -  buyFee);

        // Transfer NFT to buyer
        transferNFTInternal(listedNft.nft, address(this), msg.sender, listedNft.tokenId);

        emit BoughtNFT(
            listedNft.nft,
            listedNft.tokenId,
            listedNft.payToken,
            _price,
            listedNft.seller,
            msg.sender
        );

        returnFee(_nft, _tokenId, address(0));
    }

    function makeOffer(
        address _nft,
        int64 _tokenId,
        address _payToken,
        int64 _offerPrice
    ) external payable isListedNFT(_nft, _tokenId) nonReentrant {
        require(_offerPrice > 0, "price can not 0");
        ListNFT memory nft = listNfts[_nft][_tokenId];
        OfferNFT storage _offerNft = offerNfts[_nft][_tokenId][msg.sender];

        if(_offerNft.offerer == address(0)) {
            transferTokenInternal(nft.payToken, msg.sender, address(this), _offerPrice);
            _offerNft.nft = nft.nft;
            _offerNft.tokenId = nft.tokenId;
            _offerNft.offerer = msg.sender;
            _offerNft.payToken = _payToken;
            _offerNft.offerPrice = _offerPrice;
            _offerNft.accepted = false;
            offerList[_nft][_tokenId].push(msg.sender);
        } else {
            require(_payToken == _offerNft.payToken, "Invalid tokenID");
            int64 initialOfferPrice = _offerNft.offerPrice;
            if(_offerPrice >= initialOfferPrice) {
                int64 extraFee = _offerPrice - initialOfferPrice;
                transferTokenInternal(nft.payToken, msg.sender, address(this), extraFee);
                _offerNft.offerPrice = _offerPrice;
            } else {
                int64 repayFee = initialOfferPrice - _offerPrice;
                transferTokenInternal(nft.payToken, address(this), msg.sender, repayFee);
                _offerNft.offerPrice = _offerPrice; 
            }
        }

        emit OfferredNFT(nft.nft, nft.tokenId, nft.payToken, _offerPrice, msg.sender);
    }

    function cancelOffer(
        address _nft,
        int64 _tokenId
    ) external payable isOfferredNFT(_nft, _tokenId, msg.sender) nonReentrant {
        OfferNFT memory offer = offerNfts[_nft][_tokenId][msg.sender];
        require(offer.offerer == msg.sender, "not offerer");
        require(!offer.accepted, "offer already accepted");
        delete offerNfts[_nft][_tokenId][msg.sender];
        removeOfferer(offerList[_nft][_tokenId], msg.sender);
        transferTokenInternal(offer.payToken, address(this), msg.sender, offer.offerPrice);
        emit CanceledOfferredNFT(
            offer.nft,
            offer.tokenId,
            offer.payToken,
            offer.offerPrice,
            msg.sender
        );
    }

    function acceptOfferNFT(
        address _nft,
        int64 _tokenId,
        address _offerer
    )
        external
        payable
        isOfferredNFT(_nft, _tokenId, _offerer)
        isListedNFT(_nft, _tokenId)
        nonReentrant
    {
        require(listNfts[_nft][_tokenId].seller == msg.sender, "not listed owner");
        OfferNFT storage offer = offerNfts[_nft][_tokenId][_offerer];
        ListNFT storage list = listNfts[offer.nft][offer.tokenId];
        require(!list.sold, "already sold");
        require(!offer.accepted, "offer already accepted");

        list.sold = true;
        offer.accepted = true;

        int64 offerPrice = offer.offerPrice;
        int64 totalPrice = offerPrice;

        // Transfer to seller
        int64 buyFee = getRoyalFeeAmount(totalPrice);

        transferTokenInternal(offer.payToken, address(this), owner(), buyFee);
        transferTokenInternal(offer.payToken, address(this), list.seller, totalPrice - buyFee);

        // Transfer NFT to offerer
        transferNFTInternal(list.nft, address(this), offer.offerer, list.tokenId);

        emit AcceptedNFT(
            offer.nft,
            offer.tokenId,
            offer.payToken,
            offer.offerPrice,
            offer.offerer,
            list.seller
        );

        returnFee(_nft, _tokenId, _offerer);
    }

    function getListedNFT(address _nft, int64 _tokenId) public view returns (ListNFT memory) {
        return listNfts[_nft][_tokenId];
    }

    function transferTokenInternal(address _token, address _sender, address _receiver, int64 _amount) internal {
        int response = HederaTokenService.transferToken(
            _token,
            _sender,
            _receiver,
            _amount
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer token");
        }
    }

    function transferNFTInternal(address _token, address _sender, address _receiver, int64 _amount) internal {
        int response = HederaTokenService.transferNFT(
            _token,
            _sender,
            _receiver,
            _amount
        );

        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer nft");
        }
    }

    function getRoyalFeeAmount(int64 _tokenAmount) public view returns (int64) {
        return (_tokenAmount * royalFee) / divisor;
    }

    function removeOfferer(address[] storage array, address canceller) internal {
        for (uint256 i = 0; i < array.length; i++) {
            if(array[i] == canceller) {
                array[i] = address(0);
                break;
            }
        }
    }

    function returnFee(address _nft, int64 _tokenId, address _winner) internal {
        address[] memory _offerList = offerList[_nft][_tokenId];
        for(uint256 i = 0; i < _offerList.length; i++) {
            // _winner will be the zero address if cancel all offers
            if(_offerList[i] != address(0) && (_winner == address(0) || _offerList[i] != _winner)) {
                OfferNFT memory offer = offerNfts[_nft][_tokenId][_offerList[i]];
                transferTokenInternal(offer.payToken, address(this), _offerList[i], offer.offerPrice);
                delete offerNfts[_nft][_tokenId][_offerList[i]];
            }
        }
        delete offerList[_nft][_tokenId];
    }
}
