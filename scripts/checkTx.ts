import { ethers } from "hardhat";

async function main() {
  const txHash = process.argv[2];
  if (!txHash) {
    console.error("Usage: npx hardhat run scripts/checkTx.ts --network polygon <TX_HASH>");
    process.exit(1);
  }

  console.log(`Checking transaction: ${txHash}`);
  
  const provider = ethers.provider;
  
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      console.log("❌ Transaction not found in mempool");
      return;
    }
    
    console.log("✅ Transaction found!");
    console.log("From:", tx.from);
    console.log("To:", tx.to || "Contract Creation");
    console.log("Gas Limit:", tx.gasLimit.toString());
    console.log("Gas Price:", ethers.formatUnits(tx.gasPrice || 0n, "gwei"), "gwei");
    
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      console.log("⏳ Transaction is pending (not yet mined)");
      return;
    }
    
    console.log("\n✅ Transaction MINED!");
    console.log("Block:", receipt.blockNumber);
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
    
    if (receipt.contractAddress) {
      console.log("\n🎉 Contract deployed at:", receipt.contractAddress);
    }
  } catch (error) {
    console.error("Error checking transaction:", error);
  }
}

main().catch(console.error);
