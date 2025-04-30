const hre = require("hardhat");

async function main() {
  // Interest rate of 10% (1000 basis points)
  const interestRate = 10000000;
  // Liquidation threshold of 75%
  const liquidationThreshold = 75;

  const LendingContract = await hre.ethers.getContractFactory("LendingContract");
  // Deploy without initial funding since liquidity will be provided by lenders
  const lending = await LendingContract.deploy(interestRate, liquidationThreshold);

  // Wait for deployment to complete
  await lending.waitForDeployment();
  
  const address = await lending.getAddress();
  console.log(`LendingContract deployed to ${address}`);
  console.log('Initial pool balance: 0 ETH (Lenders can now provide liquidity)');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});