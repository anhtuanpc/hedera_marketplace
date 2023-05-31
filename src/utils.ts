import {
  Client,
  ContractCreateFlow,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  AccountId,
  TransactionReceipt,
  TransactionResponse,
  AccountAllowanceApproveTransaction,
  NftId,
  TokenId,
  TokenAssociateTransaction,
} from "@hashgraph/sdk";
import { HederaConfig } from "./config";
import { hethers } from "@hashgraph/hethers";

const fs = require("fs");
const config = HederaConfig;

export function createClient(id: string, privateKey: string): Client {
  return Client.forTestnet().setOperator(id, privateKey);
}

export async function getContractBinary(contractName: string): Promise<any> {
  const path = `./artifact/artifact_${contractName}_sol_${contractName}.bin`;

  return fs.readFileSync(path);
}

export async function deployContract(
  contractName: string,
  gasDeploy: number,
  constructorParams: ContractFunctionParameters,
  client: Client
): Promise<TransactionReceipt> {
  console.log(`--> Deploy contract ${contractName}`);

  const bytecode = await getContractBinary(contractName);
  const createDeployTx = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(gasDeploy)
    .setConstructorParameters(constructorParams);

  const submitDeployTx = await createDeployTx.execute(client);
  console.log(
    `Deploy successfully at tx: ${submitDeployTx.transactionId.toString()}`
  );

  return await submitDeployTx.getReceipt(client);
}

export async function callContract(
  contractId: string,
  gas: number,
  functionName: string,
  params: ContractFunctionParameters,
  client: Client
): Promise<TransactionReceipt> {
  const submitTx = await _callContract(
    contractId,
    gas,
    functionName,
    params,
    client
  );

  return await submitTx.getReceipt(client);
}

export async function callContractWithRecord(
  contractId: string,
  gas: number,
  functionName: string,
  params: ContractFunctionParameters,
  client: Client
): Promise<any> {
  const submitTx = await _callContract(
    contractId,
    gas,
    functionName,
    params,
    client
  );
  const receipt = await submitTx.getReceipt(client);
  const record = await submitTx.getRecord(client);
  return { receipt, record };
}

export async function approveNFT(
  nftAddress: string,
  serialNumber: number,
  ownerId: string,
  spenderId: string,
  client: Client
) {
  console.log(
    `--> Approve NFT ${nftAddress} with sericalNumber ${serialNumber} from ${ownerId} to ${spenderId}`
  );

  const nftId = evmAddressToId(nftAddress);
  const tokenId = TokenId.fromString(nftId);
  const nft = new NftId(tokenId, serialNumber);
  const approveTx = new AccountAllowanceApproveTransaction()
    .approveTokenNftAllowance(nft, ownerId, spenderId)
    .freezeWith(client);
  const submitTx = await approveTx.execute(client);

  console.log(
    `<-- Call successfully at tx: ${submitTx.transactionId.toString()}`
  );
}

export async function approveToken(
  tokenAddress: string,
  ownerId: string,
  spenderId: string,
  amount: number,
  client: Client
) {
  console.log(
    `--> Approve Token ${tokenAddress} from ${ownerId} to ${spenderId}`
  );

  const tokenId = evmAddressToId(tokenAddress);
  const Token = TokenId.fromString(tokenId);
  const approveTx = new AccountAllowanceApproveTransaction()
    .approveTokenAllowance(Token, ownerId, spenderId, amount)
    .freezeWith(client);
  const submitTx = await approveTx.execute(client);

  console.log(
    `<-- Call successfully at tx: ${submitTx.transactionId.toString()}`
  );
}

export async function associate(token: string, client: Client) {
  console.log(
    `--> Associate token: ${token} for user ${client.operatorAccountId.toString()}`
  );
  const tokenId = evmAddressToId(token);
  const Token = TokenId.fromString(tokenId);
  const associateToken = new TokenAssociateTransaction()
    .setAccountId(client.operatorAccountId.toString())
    .setTokenIds([Token]);
  const contractExecuteSubmit = await associateToken.execute(client);
  await contractExecuteSubmit.getReceipt(client);
  console.log(
    `<-- Associate token for test account at tx ${contractExecuteSubmit.transactionId}`
  );
}

export function idToEvmAddress(id: string): string {
  return hethers.utils.getAddressFromAccount(id);
}

export function evmAddressToId(address: string): string {
  return AccountId.fromSolidityAddress(address).toString();
}

export function convertToUint8(value: string) {
  return new TextEncoder().encode(value);
}

async function _callContract(
  contractId: string,
  gas: number,
  functionName: string,
  params: ContractFunctionParameters,
  client: Client
): Promise<TransactionResponse> {
  console.log(`--> Call function ${functionName} at contract: ${contractId}`);

  const createTx = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(gas)
    .setPayableAmount(config.TRANSACTION_CONFIGURES.DEFAULT_PAY_AMOUNT)
    .setFunction(functionName, params)
    .freezeWith(client);

  const submitTx = await createTx.execute(client);

  console.log(
    `<-- Call successfully at tx: ${submitTx.transactionId.toString()}`
  );
  return submitTx;
}
