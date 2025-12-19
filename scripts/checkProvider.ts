import { ethers } from "hardhat";

async function main() {
  const provider = ethers.provider;
  console.log('Provider exists:', !!provider);
  try {
    const network = await provider.getNetwork();
    console.log('Network:', network);
  } catch (err) {
    console.error('Error getting network:', err);
  }

  try {
    const signers = await ethers.getSigners();
    console.log('Signers count:', signers.length);
    if (signers.length > 0) {
      const bal = await signers[0].getBalance();
      console.log('Deployer address:', await signers[0].getAddress());
      console.log('Deployer balance (wei):', bal.toString());
    }
  } catch (err) {
    console.error('Error getting signers/balance:', err);
  }
}

main().catch((e) => { console.error('fatal', e); process.exit(1); });
