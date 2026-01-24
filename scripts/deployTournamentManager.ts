import hre from "hardhat";

async function main() {
  console.log("🚀 Deploying TournamentManager...");

  const TournamentManager = await hre.ethers.getContractFactory("TournamentManager");
  const tournamentManager = await TournamentManager.deploy();
  
  await tournamentManager.waitForDeployment();

  const address = await tournamentManager.getAddress();
  console.log("✅ TournamentManager deployed to:", address);
  
  // Store address for reference
  console.log("\n📋 Store this address in your .env or config:");
  console.log(`TOURNAMENT_MANAGER_ADDRESS=${address}`);

  // Verify on Polygonscan if it's a named network
  const network = hre.network.name;
  if (network === "polygon") {
    console.log("\n⏳ Waiting 5 blocks before Polygonscan verification...");
    await tournamentManager.deploymentTransaction()?.wait(5);
    
    console.log("\n🔍 Verifying on Polygonscan...");
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Polygonscan");
    } catch (error) {
      console.log("⚠️ Verification failed (you can verify manually later):", error);
    }
  }

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
