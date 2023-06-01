import {
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  PrivateKey,
  TokenAssociateTransaction,
  TransactionReceipt,
} from "@hashgraph/sdk";
import { HederaConfig as config } from "./config";
import {
  callContractWithRecord,
  convertToUint8,
  createClient,
  deployContract,
  idToEvmAddress,
} from "./utils";
import { SmartContractID } from "./const";
import BigNumber from "bignumber.js";

const deployerClient = createClient(
  config.ACCOUNTS.DEPLOYER.ID,
  config.ACCOUNTS.DEPLOYER.PRIVATEKEY
);
const userClient = createClient(
  config.ACCOUNTS.USER.ID,
  config.ACCOUNTS.USER.PRIVATEKEY
);
const txConfigure = config.TRANSACTION_CONFIGURES;

async function main(): Promise<void> {
  // await deployToken();
  // await deployNFT();
  await deployMarketplace();
  await deployAuction();
}

async function deployToken(): Promise<void> {
  const contractName = config.CONTRACT_NAMES.TOKEN;
  await deploy(contractName);
}

async function deployNFT(): Promise<TransactionReceipt> {
  const contractName = config.CONTRACT_NAMES.NFT;
  return await deploy(contractName);
}

async function deployAuction(): Promise<TransactionReceipt> {
  const contractName = config.CONTRACT_NAMES.AUCTION;
  return deploy(contractName);
}

async function deployMarketplace(): Promise<TransactionReceipt> {
  const contractName = config.CONTRACT_NAMES.MARKETPLACE;
  return deploy(contractName);
}

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

async function deploy(name: string): Promise<TransactionReceipt> {
  const params = new ContractFunctionParameters();
  const receipt = await deployContract(
    name,
    txConfigure.MAX_GAS,
    params,
    deployerClient
  );

  console.log(
    `Deploy successfully ${name} contract with ID: ${receipt.contractId.toString()}`
  );
  return receipt;
}

main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
