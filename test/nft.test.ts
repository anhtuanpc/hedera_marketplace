// import { SmartContractID as contractID } from "src/const";
import { HederaConfig as config } from "./../src/config";
const txConfigure = config.TRANSACTION_CONFIGURES;

import {
  approveNFT,
  associate,
  callContract,
  callContractWithRecord,
  convertToUint8,
  createClient,
  idToEvmAddress,
} from "../src/utils";
import { SmartContractID } from "../src/const";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import BigNumber from "bignumber.js";
import { hethers } from "@hashgraph/hethers";
const { expect } = require("chai");

describe("TEST NFT SMART CONTRACT", () => {
  let deployClient, userClient;
  let nftAddress;
  const NFT_NAME = "Test NFT";
  const NFT_SYMBOL = "TNFT";
  const AUTO_RENEWABLE = new BigNumber(7000000);
  const deployerAddress = idToEvmAddress(config.ACCOUNTS.DEPLOYER.ID);
  const userAddress = idToEvmAddress(config.ACCOUNTS.USER.ID);
  const deployParams = new ContractFunctionParameters()
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
  });

  it("createFungibe() - test mint NFT success", async () => {
    const { receipt, record } = await callContractWithRecord(
      SmartContractID.RLF_NFT,
      txConfigure.MAX_GAS,
      "createFungible",
      deployParams,
      deployClient
    );

    const status = receipt.status.toString();
    nftAddress = record.contractFunctionResult.getAddress(0);

    expect(status).to.equal("SUCCESS");
  });

  it("associate() success", async () => {
    await associate(nftAddress, deployClient);
    await associate(nftAddress, userClient);
  });

  it("mint() - mint NFT success", async () => {
    const metadata = "ipfs://test";

    const mintParams = new ContractFunctionParameters()
      .addAddress(deployerAddress)
      .addBytesArray([convertToUint8(metadata)]);

    const callReceipt = await callContract(
      SmartContractID.RLF_NFT,
      txConfigure.MAX_GAS,
      "mint",
      mintParams,
      deployClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });

  it("transferFrom() success", async () => {
    const serialNFT = new BigNumber(1);
    const transferParams = new ContractFunctionParameters()
      .addAddress(deployerAddress)
      .addAddress(userAddress)
      .addInt64(serialNFT);

    await approveNFT(
      nftAddress,
      serialNFT.toNumber(),
      config.ACCOUNTS.DEPLOYER.ID,
      SmartContractID.RLF_NFT,
      deployClient
    );

    const callReceipt = await callContract(
      SmartContractID.RLF_NFT,
      txConfigure.MAX_GAS,
      "transferFrom",
      transferParams,
      deployClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });
});
