import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import dotenv from "dotenv";

dotenv.config();

const { POLYGON_RPC, POLYGON_AMOY_RPC, PRIVATE_KEY } = process.env;

const sharedAccounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    polygon: {
      // Use Ankr public RPC (more reliable than polygon-rpc.com)
      url: POLYGON_RPC || "https://rpc.ankr.com/polygon",
      accounts: sharedAccounts,
      chainId: 137,
      timeout: 120_000, // 2 minutes timeout
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1.2, // 20% extra gas to ensure transaction goes through
    },
    polygonAmoy: {
      url: POLYGON_AMOY_RPC || "https://polygon-amoy.drpc.org",
      accounts: sharedAccounts,
      chainId: 80002,
      timeout: 60_000,
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy: "",
    },
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
