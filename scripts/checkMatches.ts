import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x8087441101595dd8FEcA1f02179a74ec2A1FeBBf";
  const contract = await ethers.getContractAt("MatchManager", contractAddress);
  
  const count = await contract.matchCount();
  console.log("Total matches en el contrato:", count.toString());
  
  // Mostrar los últimos 10 matches
  const start = Math.max(1, Number(count) - 9);
  for (let i = start; i <= Number(count); i++) {
    const m = await contract.matches(i);
    console.log(`\nMatch ${i}:`);
    console.log(`  Creator: ${m.creator}`);
    console.log(`  Challenger: ${m.challenger}`);
    console.log(`  isOpen: ${m.isOpen}`);
    console.log(`  isCompleted: ${m.isCompleted}`);
    console.log(`  isFree: ${m.isFree}`);
    console.log(`  goalsTarget: ${m.goalsTarget}`);
    console.log(`  stakeAmount: ${ethers.formatEther(m.stakeAmount)} POL`);
    console.log(`  stakeToken: ${m.stakeToken}`);
  }
}

main().catch(console.error);
