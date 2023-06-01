import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { HederaConfig as config } from "./../src/config";
const txConfigure = config.TRANSACTION_CONFIGURES;
import BigNumber from "bignumber.js";
import {
  approveNFT,
  approveToken,
  associate,
  callContract,
  callContractWithRecord,
  convertToUint8,
  createClient,
  idToEvmAddress,
} from "../src/utils";
import { SmartContractID } from "../src/const";
const { expect } = require("chai");

describe("TEST MARKETPLACE SMART CONTRACT", () => {
  let deployClient, userClient, otherUserClient;
  let tokenAddress, nftAddress;
  const TOKEN_NAME = "Test TOKEN";
  const TOKEN_SYMBOL = "TK";
  const INITIAL_SUPPLY = new BigNumber(5000000000000);
  const DECIMAL = 2;
  const NFT_NAME = "Test NFT";
  const NFT_SYMBOL = "TNFT";
  const AUTO_RENEWABLE = new BigNumber(7000000);
  const deployerAddress = idToEvmAddress(config.ACCOUNTS.DEPLOYER.ID);
  const userAddress = idToEvmAddress(config.ACCOUNTS.USER.ID);
  const otherUserAddress = idToEvmAddress(config.ACCOUNTS.OTHER_USER.ID);
  const metadata = "ipfs://test";
  const mintNFTParams = new ContractFunctionParameters()
    .addAddress(deployerAddress)
    .addBytesArray([convertToUint8(metadata)]);
  const mintTokenParams = new ContractFunctionParameters()
    .addAddress(deployerAddress)
    .addInt64(INITIAL_SUPPLY);

  // const marketplaceAddress = idToEvmAddress(SmartContractID.RLF_MARKETPLACE);
  const deployTokenParams = new ContractFunctionParameters()
    .addString(TOKEN_NAME)
    .addString(TOKEN_SYMBOL)
    .addInt64(INITIAL_SUPPLY)
    .addInt32(DECIMAL)
    .addInt64(AUTO_RENEWABLE);

  const deployNFTParams = new ContractFunctionParameters()
    .addString(NFT_NAME)
    .addString(NFT_SYMBOL)
    .addInt64(AUTO_RENEWABLE);

  beforeEach(() => {
    deployClient = createClient(
      config.ACCOUNTS.DEPLOYER.ID,
      config.ACCOUNTS.DEPLOYER.PRIVATEKEY
    );

    userClient = createClient(
      config.ACCOUNTS.USER.ID,
      config.ACCOUNTS.USER.PRIVATEKEY
    );

    otherUserClient = createClient(
      config.ACCOUNTS.OTHER_USER.ID,
      config.ACCOUNTS.OTHER_USER.PRIVATEKEY
    );
  });

  it("Deploy all token and nft success, mint demo NFT", async () => {
    const serialNFT = new BigNumber(1);

    // create NFT and Token
    const deployNFT = await callContractWithRecord(
      SmartContractID.RLF_NFT,
      txConfigure.MAX_GAS,
      "createFungible",
      deployNFTParams,
      deployClient
    );
    nftAddress = deployNFT.record.contractFunctionResult.getAddress(0);

    const deployToken = await callContractWithRecord(
      SmartContractID.RLF_REAL,
      txConfigure.MAX_GAS,
      "createFungible",
      deployTokenParams,
      deployClient
    );
    tokenAddress = deployToken.record.contractFunctionResult.getAddress(0);

    // Associate nft and token for user  and deployer

    await associate(nftAddress, deployClient);
    await associate(nftAddress, userClient);
    await associate(nftAddress, otherUserClient);
    await associate(tokenAddress, deployClient);
    await associate(tokenAddress, userClient);
    await associate(tokenAddress, otherUserClient);

    // mint NFT and Tokens
    await callContract(
      SmartContractID.RLF_NFT,
      txConfigure.MAX_GAS,
      "mint",
      mintNFTParams,
      deployClient
    );
    await callContract(
      SmartContractID.RLF_REAL,
      txConfigure.MAX_GAS,
      "mint",
      mintTokenParams,
      deployClient
    );

    // associate nft and token for marketplace
    const associateNFTParams = new ContractFunctionParameters().addAddress(
      nftAddress
    );
    const associateTokenParams = new ContractFunctionParameters().addAddress(
      tokenAddress
    );
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "tokenAssociate",
      associateNFTParams,
      deployClient
    );
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "tokenAssociate",
      associateTokenParams,
      deployClient
    );

    // Transfer Token for user
    const AMOUNT = new BigNumber(10000000000);
    await approveToken(
      tokenAddress,
      config.ACCOUNTS.DEPLOYER.ID,
      SmartContractID.RLF_REAL,
      AMOUNT.toNumber(),
      deployClient
    );

    let transferParams = new ContractFunctionParameters()
      .addAddress(deployerAddress)
      .addAddress(userAddress)
      .addInt64(AMOUNT);
    await callContract(
      SmartContractID.RLF_REAL,
      txConfigure.MAX_GAS,
      "transferFrom",
      transferParams,
      deployClient
    );

    await approveToken(
      tokenAddress,
      config.ACCOUNTS.DEPLOYER.ID,
      SmartContractID.RLF_REAL,
      AMOUNT.toNumber(),
      deployClient
    );

    transferParams = new ContractFunctionParameters()
      .addAddress(deployerAddress)
      .addAddress(otherUserAddress)
      .addInt64(AMOUNT);
    await callContract(
      SmartContractID.RLF_REAL,
      txConfigure.MAX_GAS,
      "transferFrom",
      transferParams,
      deployClient
    );
  });

  it("putNftOnMarketplace() success", async () => {
    const serialNFT = new BigNumber(1);
    const price = new BigNumber(1500000);

    await approveNFT(
      nftAddress,
      serialNFT.toNumber(),
      config.ACCOUNTS.DEPLOYER.ID,
      SmartContractID.RLF_MARKETPLACE,
      deployClient
    );

    const putNftOnParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(price);

    const callReceipt = await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "putNftOnMarketplace",
      putNftOnParams,
      deployClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });

  it("user make offer and other user buy successfully", async () => {
    const serialNFT = new BigNumber(1);
    const offerPrice = new BigNumber(1000000);
    const price = new BigNumber(1500000);

    await approveToken(
      tokenAddress,
      config.ACCOUNTS.USER.ID,
      SmartContractID.RLF_MARKETPLACE,
      offerPrice.toNumber(),
      userClient
    );

    let makeOfferParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(offerPrice);
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "makeOffer",
      makeOfferParams,
      userClient
    );

    await approveToken(
      tokenAddress,
      config.ACCOUNTS.OTHER_USER.ID,
      SmartContractID.RLF_MARKETPLACE,
      offerPrice.toNumber(),
      otherUserClient
    );

    makeOfferParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(offerPrice);
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "makeOffer",
      makeOfferParams,
      otherUserClient
    );

    await approveToken(
      tokenAddress,
      config.ACCOUNTS.OTHER_USER.ID,
      SmartContractID.RLF_MARKETPLACE,
      price.toNumber(),
      otherUserClient
    );

    const buyParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(price);
    const callReceipt = await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "buy",
      buyParams,
      otherUserClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });

  it("cancel offer and return for all user", async () => {
    const serialNFT = new BigNumber(2);
    const price = new BigNumber(15000000);
    const offerPrice = new BigNumber(1000000);

    // mint NFT and put on marketplace
    await callContract(
      SmartContractID.RLF_NFT,
      txConfigure.MAX_GAS,
      "mint",
      mintNFTParams,
      deployClient
    );

    await approveNFT(
      nftAddress,
      serialNFT.toNumber(),
      config.ACCOUNTS.DEPLOYER.ID,
      SmartContractID.RLF_MARKETPLACE,
      deployClient
    );

    const putNftOnParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(price);

    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "putNftOnMarketplace",
      putNftOnParams,
      deployClient
    );

    // make offer
    await approveToken(
      tokenAddress,
      config.ACCOUNTS.USER.ID,
      SmartContractID.RLF_MARKETPLACE,
      offerPrice.toNumber(),
      userClient
    );

    let makeOfferParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(offerPrice);
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "makeOffer",
      makeOfferParams,
      userClient
    );

    await approveToken(
      tokenAddress,
      config.ACCOUNTS.OTHER_USER.ID,
      SmartContractID.RLF_MARKETPLACE,
      price.toNumber(),
      otherUserClient
    );
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "makeOffer",
      makeOfferParams,
      otherUserClient
    );

    //cancel offer
    const putNftOffParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT);
    const callReceipt = await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "putNftOffMarketplace",
      putNftOffParams,
      deployClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });

  it("put nft off and one of user cancel offer, return all fund", async () => {
    const serialNFT = new BigNumber(2);
    const price = new BigNumber(15000000);
    const offerPrice = new BigNumber(1000000);

    await approveNFT(
      nftAddress,
      serialNFT.toNumber(),
      config.ACCOUNTS.DEPLOYER.ID,
      SmartContractID.RLF_MARKETPLACE,
      deployClient
    );

    const putNftOnParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(price);
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "putNftOnMarketplace",
      putNftOnParams,
      deployClient
    );
    // make offer
    await approveToken(
      tokenAddress,
      config.ACCOUNTS.USER.ID,
      SmartContractID.RLF_MARKETPLACE,
      offerPrice.toNumber(),
      userClient
    );

    let makeOfferParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(offerPrice);
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "makeOffer",
      makeOfferParams,
      userClient
    );

    await approveToken(
      tokenAddress,
      config.ACCOUNTS.OTHER_USER.ID,
      SmartContractID.RLF_MARKETPLACE,
      price.toNumber(),
      otherUserClient
    );
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "makeOffer",
      makeOfferParams,
      otherUserClient
    );

    // other user cancel offer
    const cancelOfferParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT);
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "cancelOffer",
      cancelOfferParams,
      otherUserClient
    );

    // put off NFT success and return fund
    const putNftOffParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT);
    const callReceipt = await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "putNftOffMarketplace",
      putNftOffParams,
      deployClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });

  // it("putNftOffMarketplace() success", async () => {
  //   const serialNFT = new BigNumber(1);
  //   const putNftOffParams = new ContractFunctionParameters()
  //     .addAddress(nftAddress)
  //     .addInt64(serialNFT);
  //   const callReceipt = await callContract(
  //     SmartContractID.RLF_MARKETPLACE,
  //     txConfigure.MAX_GAS,
  //     "putNftOffMarketplace",
  //     putNftOffParams,
  //     deployClient
  //   );

  //   const status = callReceipt.status.toString();
  //   expect(status).to.equal("SUCCESS");
  // });

  it("put on and buy() success", async () => {
    const serialNFT = new BigNumber(2);
    const price = new BigNumber(10000000);
    await approveNFT(
      nftAddress,
      serialNFT.toNumber(),
      config.ACCOUNTS.DEPLOYER.ID,
      SmartContractID.RLF_MARKETPLACE,
      deployClient
    );

    const putNftOnParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(price);

    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "putNftOnMarketplace",
      putNftOnParams,
      deployClient
    );

    await approveToken(
      tokenAddress,
      config.ACCOUNTS.USER.ID,
      SmartContractID.RLF_MARKETPLACE,
      price.toNumber(),
      userClient
    );

    const buyParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(price);
    const callReceipt = await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "buy",
      buyParams,
      userClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });

  it("push on nft and makeOffer() success", async () => {
    const serialNFT = new BigNumber(2);
    const initialPrice = new BigNumber(10000000000);
    const offerPrice = new BigNumber(1000000);

    await approveNFT(
      nftAddress,
      serialNFT.toNumber(),
      config.ACCOUNTS.USER.ID,
      SmartContractID.RLF_MARKETPLACE,
      userClient
    );

    const putNftOnParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(initialPrice);
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "putNftOnMarketplace",
      putNftOnParams,
      userClient
    );

    await approveToken(
      tokenAddress,
      config.ACCOUNTS.DEPLOYER.ID,
      SmartContractID.RLF_MARKETPLACE,
      offerPrice.toNumber(),
      deployClient
    );

    const makeOfferParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(offerPrice);
    const callReceipt = await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "makeOffer",
      makeOfferParams,
      deployClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });

  it("cancelOffer() success and create other offer", async () => {
    const serialNFT = new BigNumber(2);
    const cancelOfferParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT);
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "cancelOffer",
      cancelOfferParams,
      deployClient
    );

    const offerPrice = new BigNumber(2000000);
    await approveToken(
      tokenAddress,
      config.ACCOUNTS.DEPLOYER.ID,
      SmartContractID.RLF_MARKETPLACE,
      offerPrice.toNumber(),
      deployClient
    );

    const makeOfferParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(offerPrice);
    const callReceipt = await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "makeOffer",
      makeOfferParams,
      deployClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });

  it("create higher offer and re-create lower offer at the same nft", async () => {
    const serialNFT = new BigNumber(2);

    const additionalOfferPrice = new BigNumber(1000000);
    const higherOfferPrice = new BigNumber(3000000);
    const lowerOfferPrice = new BigNumber(2000000);

    await approveToken(
      tokenAddress,
      config.ACCOUNTS.DEPLOYER.ID,
      SmartContractID.RLF_MARKETPLACE,
      additionalOfferPrice.toNumber(),
      deployClient
    );

    const makeHigherOfferParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(higherOfferPrice);
    await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "makeOffer",
      makeHigherOfferParams,
      deployClient
    );

    const makeLowerOfferParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(lowerOfferPrice);
    const callReceipt = await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "makeOffer",
      makeLowerOfferParams,
      deployClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });

  it("acceptOfferNFT() success", async () => {
    const serialNFT = new BigNumber(2);
    const acceptOfferParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(deployerAddress);

    const callReceipt = await callContract(
      SmartContractID.RLF_MARKETPLACE,
      txConfigure.MAX_GAS,
      "acceptOfferNFT",
      acceptOfferParams,
      userClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });
});
