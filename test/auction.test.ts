import {
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { HederaConfig as config } from "./../src/config";
const txConfigure = config.TRANSACTION_CONFIGURES;
import BigNumber from "bignumber.js";
import {
  callContract,
  callContractWithRecord,
  convertToUint8,
  createClient,
  idToEvmAddress,
} from "../src/utils";
import { SmartContractID } from "../src/const";
const { expect } = require("chai");

describe("TEST AUCTION SMART CONTRACT", async () => {
  let deployClient, userClient;
  let tokenAddress, nftAddress;
  let startTime, endTime;
  const TOKEN_NAME = "Test TOKEN";
  const TOKEN_SYMBOL = "TK";
  const INITIAL_SUPPLY = new BigNumber(5000000000000);
  const DECIMAL = 2;
  const NFT_NAME = "Test NFT";
  const NFT_SYMBOL = "TNFT";
  const AUTO_RENEWABLE = new BigNumber(7000000);
  const deployerAddress = idToEvmAddress(config.ACCOUNTS.DEPLOYER.ID);
  const userAddress = idToEvmAddress(config.ACCOUNTS.USER.ID);
  const marketplaceAddress = idToEvmAddress(SmartContractID.RLF_MARKETPLACE);
  const serialNFT = new BigNumber(1);

  const deployTokenParams = new ContractFunctionParameters()
    .addString(TOKEN_NAME)
    .addString(TOKEN_SYMBOL)
    .addInt64(INITIAL_SUPPLY)
    .addInt32(DECIMAL)
    .addInt64(AUTO_RENEWABLE)
    .addAddress(deployerAddress);
  const deployNFTParams = new ContractFunctionParameters()
    .addString(NFT_NAME)
    .addString(NFT_SYMBOL)
    .addInt64(AUTO_RENEWABLE)
    .addAddress(deployerAddress);

  beforeEach(async () => {
    deployClient = createClient(
      config.ACCOUNTS.DEPLOYER.ID,
      config.ACCOUNTS.DEPLOYER.PRIVATEKEY
    );

    userClient = createClient(
      config.ACCOUNTS.USER.ID,
      config.ACCOUNTS.USER.PRIVATEKEY
    );

    const getTimeTx = new ContractCallQuery()
      .setContractId(SmartContractID.RLF_AUCTION)
      .setGas(config.TRANSACTION_CONFIGURES.DEFAULT_GAS)
      .setFunction("getTime");
    const getTimeTxSubmit = await getTimeTx.execute(deployClient);
    startTime = getTimeTxSubmit.getInt64(0);
    const ONE_DAY = 86400;
    endTime = startTime.plus(ONE_DAY);
  });

  it("Deploy all token and nft success, mint demo NFT", async () => {
    const serialNFT = new BigNumber(1);
    const metadata = "ipfs://test";
    const mintParams = new ContractFunctionParameters().addBytesArray([
      convertToUint8(metadata),
    ]);

    // create NFT
    const deployNFT = await callContractWithRecord(
      SmartContractID.RLF_NFT,
      txConfigure.MAX_GAS,
      "createFungible",
      deployNFTParams,
      deployClient
    );

    nftAddress = deployNFT.record.contractFunctionResult.getAddress(0);

    // mint NFT
    await callContract(
      SmartContractID.RLF_NFT,
      txConfigure.MAX_GAS,
      "mint",
      mintParams,
      deployClient
    );

    // Create Token
    const deployToken = await callContractWithRecord(
      SmartContractID.RLF_REAL,
      txConfigure.MAX_GAS,
      "createFungible",
      deployTokenParams,
      deployClient
    );

    // Associate nft and token for user
    const associateUserToken = new ContractExecuteTransaction()
      .setContractId(SmartContractID.RLF_REAL)
      .setGas(txConfigure.MAX_GAS)
      .setFunction("associateToken");
    const TokenContractExecuteSubmit = await associateUserToken.execute(
      userClient
    );
    await TokenContractExecuteSubmit.getReceipt(userClient);
    console.log(
      `Associate Token for test account at tx ${TokenContractExecuteSubmit.transactionId}`
    );

    const associateUserNFT = new ContractExecuteTransaction()
      .setContractId(SmartContractID.RLF_NFT)
      .setGas(txConfigure.MAX_GAS)
      .setFunction("associateNFT");
    const NFTContractExecuteSubmit = await associateUserNFT.execute(userClient);
    await NFTContractExecuteSubmit.getReceipt(userClient);
    console.log(
      `Associate NFT for test account at tx ${NFTContractExecuteSubmit.transactionId}`
    );

    tokenAddress = deployToken.record.contractFunctionResult.getAddress(0);

    const associateNFTParams = new ContractFunctionParameters().addAddress(
      nftAddress
    );
    const associateTokenParams = new ContractFunctionParameters().addAddress(
      tokenAddress
    );

    // associate nft and token for marketplace
    await callContract(
      SmartContractID.RLF_AUCTION,
      txConfigure.MAX_GAS,
      "tokenAssociate",
      associateNFTParams,
      deployClient
    );

    await callContract(
      SmartContractID.RLF_AUCTION,
      txConfigure.MAX_GAS,
      "tokenAssociate",
      associateTokenParams,
      deployClient
    );

    // Transfer Token for user
    const AMOUNT = new BigNumber(10000000000);
    const transferParams = new ContractFunctionParameters()
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
  });

  it("createAuction() success", async () => {
    const startPrice = new BigNumber(2000000);
    const ceilingPrice = new BigNumber(2000000);
    const minBid = new BigNumber(1000000);

    const createAuctionParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(startPrice)
      .addInt64(ceilingPrice)
      .addInt64(minBid)
      .addInt64(startTime)
      .addInt64(startTime.plus(1));

    const callReceipt = await callContract(
      SmartContractID.RLF_AUCTION,
      txConfigure.MAX_GAS,
      "createAuction",
      createAuctionParams,
      deployClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });

  it("cancelAuction() success and recreate auction", async () => {
    const startPrice = new BigNumber(2000000);
    const ceilingPrice = new BigNumber(2000000);
    const minBid = new BigNumber(1000000);
    console.log(`start time ${startTime}`);
    console.log(`end time: ${endTime}`);

    // const record = await getTimeTxSubmit.(deployClient);
    // const hederaCurrentTime = record.contractFunctionResult.getInt64(0);
    // console.log(`hedera current time ${hederaCurrentTime}`);

    const cancelAuctionParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT);
    await callContract(
      SmartContractID.RLF_AUCTION,
      txConfigure.MAX_GAS,
      "cancelAuction",
      cancelAuctionParams,
      deployClient
    );

    const createAuctionParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addAddress(tokenAddress)
      .addInt64(startPrice)
      .addInt64(ceilingPrice)
      .addInt64(minBid)
      .addInt64(startTime)
      .addInt64(endTime);

    const callReceipt = await callContract(
      SmartContractID.RLF_AUCTION,
      txConfigure.MAX_GAS,
      "createAuction",
      createAuctionParams,
      deployClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });

  it("placeBid() success and buy directly success", async () => {
    const startPrice = new BigNumber(2000000);
    const placeBidParams = new ContractFunctionParameters()
      .addAddress(nftAddress)
      .addInt64(serialNFT)
      .addInt64(startPrice);
    const callReceipt = await callContract(
      SmartContractID.RLF_AUCTION,
      txConfigure.MAX_GAS,
      "placeBid",
      placeBidParams,
      userClient
    );
    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");

    // THIS CODE NOT WORK AS NOT SUPPORT REVERT WITH

    // const cancelAuctionParams = new ContractFunctionParameters()
    //   .addAddress(nftAddress)
    //   .addInt64(serialNFT);
    // await expect(
    //   callContract(
    //     SmartContractID.RLF_AUCTION,
    //     txConfigure.MAX_GAS,
    //     "cancelAuction",
    //     cancelAuctionParams,
    //     deployClient
    //   )
    // ).to.be.revertedWith("CONTRACT_REVERT_EXECUTED");
  });
});
