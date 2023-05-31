import { config } from "dotenv";

config({ path: (process.cwd(), ".env") });

export const HederaConfig = {
  TRANSACTION_CONFIGURES: {
    DEFAULT_GAS: 500000,
    MAX_GAS: process.env.MAX_GAS_DEPLOY_SC
      ? parseInt(process.env.MAX_GAS_DEPLOY_SC)
      : 6000000,
    DEFAULT_PAY_AMOUNT: 50,
  },
  ACCOUNTS: {
    DEPLOYER: {
      ID: process.env.OPERATOR_ID ? process.env.OPERATOR_ID : "0.0.3737829",
      PRIVATEKEY: process.env.OPERATOR_PVKEY
        ? process.env.OPERATOR_PVKEY
        : "302e020100300506032b6570042204201633852c3d9fca87ceae3b73b7e45e92781b8ade8d332d208e9712e3aa7cb634",
      PUBLICKEY: process.env.OPERATOR_PBKEY
        ? process.env.OPERATOR_PBKEY
        : "302a300506032b65700321005fa498cdfc45d0c0ccfdfa68c88c4ed1ffb37bd8e2f365ad38fa0046149afe27",
    },
    USER: {
      ID: process.env.ALICE_ID ? process.env.ALICE_ID : "0.0.3489176",
      PRIVATEKEY: process.env.ALICE_PVKEY
        ? process.env.ALICE_PVKEY
        : "302e020100300506032b657004220420a086a7add8ff8afd72c8c464ced8cc9367da76bb2806436de9c52d8808b08ce6",
      PUBLICKEY: process.env.ALICE_PBKEY
        ? process.env.ALICE_PBKEY
        : "302a300506032b65700321005fa498cdfc45d0c0ccfdfa68c88c4ed1ffb37bd8e2f365ad38fa0046149afe27",
    },
    OTHER_USER: {
      ID: process.env.BOB_ID ? process.env.BOB_ID : "0.0.3981309",
      PRIVATEKEY: process.env.BOB_PVKEY
        ? process.env.BOB_PVKEY
        : "302e020100300506032b657004220420e37aac74c60548ebe232be97d8ea11dd59245e1fa7354a3f2814a180f3289069",
      PUBLICKEY: process.env.BOB_PBKEY
        ? process.env.BOB_PBKEY
        : "302a300506032b6570032100d9479cbb89e24686945c02f462aa8a6dfa0aebcf70e302c85dad94b964e9186e",
    },
  },
  CONTRACT_NAMES: {
    NFT: "RLF_NFT",
    TOKEN: "RLF_REAL",
    MARKETPLACE: "RLF_Marketplace",
    AUCTION: "RLF_Auction",
  },
};
