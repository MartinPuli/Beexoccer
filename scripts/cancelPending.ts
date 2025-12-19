import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Cancelling pending transactions for:", deployer.address);
  
  // Get current nonce
  const currentNonce = await deployer.getNonce();
  console.log("Current nonce:", currentNonce);
  
  // Get pending nonce
  const pendingNonce = await deployer.getNonce("pending");
  console.log("Pending nonce:", pendingNonce);
  
  if (currentNonce === pendingNonce) {
    console.log("✅ No pending transactions");
    return;
  }
  
  // Get current gas price
  const feeData = await deployer.provider.getFeeData();
  const gasPrice = feeData.gasPrice || 0n;
  console.log("Current gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
  
  // Send empty transaction with higher gas to cancel pending ones
  for (let nonce = currentNonce; nonce < pendingNonce; nonce++) {
    console.log(`\nCancelling transaction with nonce ${nonce}...`);
    
    const cancelTx = await deployer.sendTransaction({
      to: deployer.address,
      value: 0,
      nonce: nonce,
      gasPrice: gasPrice * 120n / 100n, // 20% higher gas
      gasLimit: 21000,
    });
    
    console.log("Cancel tx sent:", cancelTx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await cancelTx.wait();
    console.log("✅ Cancelled! Block:", receipt?.blockNumber);
  }
  
  console.log("\n✅ All pending transactions cancelled");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
