import { SmartContractID } from "./../src/const";
// import { SmartContractID as contractID } from "src/const";
import { HederaConfig as config } from "./../src/config";
const txConfigure = config.TRANSACTION_CONFIGURES;

import {
  approveToken,
  associate,
  callContract,
  callContractWithRecord,
  convertToUint8,
  createClient,
  idToEvmAddress,
} from "../src/utils";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import BigNumber from "bignumber.js";
const { expect } = require("chai");

describe("TEST TOKEN SMART CONTRACT", () => {
  let deployClient, userClient;
  let tokenAddress;
  const TOKEN_NAME = "TestTOKEN";
  const TOKEN_SYMBOL = "TK";
  const INITIAL_SUPPLY = new BigNumber(1000);
  const DECIMAL = 8;
  const AUTO_RENEWABLE = new BigNumber(8000000);
  const deployerAddress = idToEvmAddress(config.ACCOUNTS.DEPLOYER.ID);
  const userAddress = idToEvmAddress(config.ACCOUNTS.USER.ID);
  // const deployParams = new ContractFunctionParameters()
  //   .addString(TOKEN_NAME)
  //   .addString(TOKEN_SYMBOL)
  //   .addInt64(INITIAL_SUPPLY)
  //   .addInt32(DECIMAL)
  //   .addInt64(AUTO_RENEWABLE);
  const deployParams = new ContractFunctionParameters();

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

  it("createFungible() success", async () => {
    const { receipt, record } = await callContractWithRecord(
      SmartContractID.RLF_REAL,
      txConfigure.MAX_GAS,
      "createFungibleTokenPublic",
      deployParams,
      deployClient
    );

    const status = receipt.status.toString();
    tokenAddress = record.contractFunctionResult.getAddress(0);

    expect(status).to.equal("SUCCESS");
  });

  it("associateToken() success", async () => {
    await associate(tokenAddress, deployClient);
    await associate(tokenAddress, userClient);
  });

  it("transferFrom() success", async () => {
    const AMOUNT = new BigNumber(100000000000);
    const transferParams = new ContractFunctionParameters()
      .addAddress(deployerAddress)
      .addAddress(userAddress)
      .addInt64(AMOUNT);

    await approveToken(
      tokenAddress,
      config.ACCOUNTS.DEPLOYER.ID,
      SmartContractID.RLF_REAL,
      AMOUNT.toNumber(),
      deployClient
    );

    const callReceipt = await callContract(
      SmartContractID.RLF_REAL,
      txConfigure.MAX_GAS,
      "transferFrom",
      transferParams,
      deployClient
    );

    const status = callReceipt.status.toString();
    expect(status).to.equal("SUCCESS");
  });
});
