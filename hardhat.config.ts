import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import dotenv from "dotenv";

dotenv.config();

const { POLYGON_AMOY_RPC, PRIVATE_KEY } = process.env;

const sharedAccounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    polygonAmoy: {
      url: POLYGON_AMOY_RPC || "https://polygon-amoy.g.alchemy.com/v2/demo",
      accounts: sharedAccounts,
      chainId: 80002
    }
  },
  etherscan: {
    apiKey: {
      polygonAmoy: "" // TODO: add PolygonScan API key when verification is required.
    }
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6"
  }
};

export default config;
