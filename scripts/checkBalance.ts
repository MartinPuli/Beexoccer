import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Checking deployer:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance (POL):", ethers.formatEther(balance));
  
  const network = await deployer.provider.getNetwork();
  console.log("Network:", network.name, "ChainId:", network.chainId.toString());
  
  // Try a simple call to test RPC responsiveness
  const blockNumber = await deployer.provider.getBlockNumber();
  console.log("Current block:", blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
