import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const TournamentManager = await ethers.getContractFactory("TournamentManager");
  const tournamentManager = await TournamentManager.deploy();

  await tournamentManager.waitForDeployment();

  const address = await tournamentManager.getAddress();

  console.log("TournamentManager deployed to:", address);
  console.log("Don't forget to update your frontend .env or config with this address!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
