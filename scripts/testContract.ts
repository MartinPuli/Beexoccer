import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x9197Aa4F607fC2e245411eb69ab2d72CDa02CC2b";
  
  console.log("🔍 Conectando al contrato:", contractAddress);
  
  const MatchManager = await ethers.getContractFactory("MatchManager");
  const contract = MatchManager.attach(contractAddress);
  
  // Obtener el signer
  const [signer] = await ethers.getSigners();
  console.log("👤 Signer:", signer.address);
  
  // Ver el estado actual
  const matchCount = await contract.matchCount();
  console.log("📊 Total de partidas:", matchCount.toString());
  
  // Intentar crear una partida gratuita
  console.log("\n🎮 Creando partida GRATUITA...");
  try {
    const tx = await contract.createMatch(
      3,      // goalsTarget
      true,   // isFree
      0,      // stakeAmount
      ethers.ZeroAddress  // stakeToken
    );
    console.log("⏳ TX Hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Partida creada en bloque:", receipt?.blockNumber);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.data) {
      console.error("📋 Data:", error.data);
    }
  }
}

main().catch(console.error);
