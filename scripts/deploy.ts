import { ethers } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";

dotenv.config();

/**
 * Deploys the MatchManager contract and logs helper data for the frontend.
 * A JSON file is also written under `deployments/` so future scripts can pick
 * up the last deployed address for quick verification or front-end wiring.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer signer available. Set PRIVATE_KEY in .env or configure accounts for this network.");
  }

  console.log(`Deploying with ${deployer.address}`);
  
  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} POL`);
  
  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient balance. Need at least 0.01 POL for deployment.");
  }

  console.log("Getting MatchManager factory...");
  const factory = await ethers.getContractFactory("MatchManager");
  
  console.log("Factory obtained. Deploying contract (this may take a while)...");
  
  // Deploy with explicit gas settings
  const contract = await factory.deploy({
    gasLimit: 3000000, // 3M gas limit
  });
  
  console.log("Deployment transaction sent:", contract.deploymentTransaction()?.hash);
  console.log("Waiting for 2 confirmations...");
  
  // Wait for deployment with timeout handling
  await contract.waitForDeployment();
  console.log("Contract deployment mined.");

  const address = await contract.getAddress();
  console.log(`MatchManager deployed to ${address}`);

  // Persist metadata for tooling + frontend .env sync.
  const deploymentsDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const outputPath = path.join(deploymentsDir, `match-manager-${Date.now()}.json`);
  const payload = {
    network: ethers.provider.network?.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    address
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Saved deployment info to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
