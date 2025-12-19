import { ethers } from "hardhat";

async function main() {
  // Dirección del contrato MatchManager desplegado
  const MATCH_MANAGER_ADDRESS = "0x440DeA5a2801E6caF07574bf4B940df1CdFb2353";
  
  // Obtener el signer (el que desplegó el contrato es el owner)
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  
  console.log("🔐 Configurando trustedSigner...");
  console.log("   Contrato:", MATCH_MANAGER_ADDRESS);
  console.log("   Signer (owner):", signerAddress);
  
  // Conectar al contrato
  const MatchManager = await ethers.getContractFactory("MatchManager");
  const contract = MatchManager.attach(MATCH_MANAGER_ADDRESS);
  
  // Verificar owner actual
  const currentOwner = await contract.owner();
  console.log("   Owner actual del contrato:", currentOwner);
  
  if (currentOwner.toLowerCase() !== signerAddress.toLowerCase()) {
    console.error("❌ Error: Tu wallet no es el owner del contrato.");
    console.error("   Tu wallet:", signerAddress);
    console.error("   Owner:", currentOwner);
    process.exit(1);
  }
  
  // El trustedSigner será el mismo owner (tu wallet del server)
  // Podés cambiarlo por la dirección que firmará los resultados desde el servidor
  const TRUSTED_SIGNER = signerAddress; // O poner otra dirección aquí
  
  console.log("   Nuevo trustedSigner:", TRUSTED_SIGNER);
  
  // Verificar trustedSigner actual
  const currentTrustedSigner = await contract.trustedSigner();
  console.log("   trustedSigner actual:", currentTrustedSigner);
  
  if (currentTrustedSigner.toLowerCase() === TRUSTED_SIGNER.toLowerCase()) {
    console.log("✅ El trustedSigner ya está configurado correctamente.");
    return;
  }
  
  // Ejecutar la transacción
  console.log("\n📝 Enviando transacción...");
  const tx = await contract.setTrustedSigner(TRUSTED_SIGNER);
  console.log("   TX Hash:", tx.hash);
  
  console.log("⏳ Esperando confirmación...");
  await tx.wait();
  
  // Verificar
  const newTrustedSigner = await contract.trustedSigner();
  console.log("\n✅ trustedSigner actualizado:", newTrustedSigner);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
