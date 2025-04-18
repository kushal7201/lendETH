const hre = require("hardhat");
const { parseEther } = require("ethers");

async function main() {
  // Interest rate of 10% (1000 basis points)
  const interestRate = 1000;
  // Liquidation threshold of 75%
  const liquidationThreshold = 75;

  const LendingContract = await hre.ethers.getContractFactory("LendingContract");
  // Deploy with 100 ETH initial funding
  const lending = await LendingContract.deploy(interestRate, liquidationThreshold, {
    value: parseEther("100")
  });

  // Wait for deployment to complete
  await lending.waitForDeployment();
  
  const address = await lending.getAddress();
  console.log(`LendingContract deployed to ${address}`);
  console.log(`Funded with 100 ETH`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});