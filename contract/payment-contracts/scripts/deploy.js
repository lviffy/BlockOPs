import { ethers } from "hardhat";

async function main() {
  console.log("Starting PaymentEscrow deployment...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  // Get treasury address from environment
  const treasuryAddress = process.env.TREASURY_ADDRESS;
  if (!treasuryAddress || treasuryAddress === "your_treasury_address_here") {
    throw new Error("Please set TREASURY_ADDRESS in .env file");
  }
  
  console.log("Treasury address:", treasuryAddress);
  console.log("Deployer address:", deployer.address);
  
  // Deploy PaymentEscrow
  console.log("\nDeploying PaymentEscrow contract...");
  const PaymentEscrow = await ethers.getContractFactory("PaymentEscrow");
  const escrow = await PaymentEscrow.deploy(treasuryAddress, deployer.address);
  
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  
  console.log("✅ PaymentEscrow deployed to:", escrowAddress);
  
  // Setup USDC token support if provided
  const usdcAddress = process.env.USDC_ADDRESS;
  if (usdcAddress && usdcAddress !== "your_usdc_address_here") {
    console.log("\nSetting up USDC token support...");
    const tx = await escrow.setSupportedToken(usdcAddress, true);
    await tx.wait();
    console.log("✅ USDC token supported at:", usdcAddress);
  } else {
    console.log("\n⚠️  USDC_ADDRESS not set in .env - skipping token setup");
    console.log("You can add it later using setSupportedToken()");
  }
  
  // Authorize backend (you'll need to set this later)
  console.log("\n⚠️  Remember to authorize your backend address after deployment:");
  console.log("escrow.addAuthorizedBackend(YOUR_BACKEND_ADDRESS)");
  
  console.log("\n📝 Deployment Summary:");
  console.log("=====================");
  console.log("PaymentEscrow:", escrowAddress);
  console.log("Treasury:", treasuryAddress);
  console.log("Owner:", deployer.address);
  
  console.log("\n📋 Add to your .env file:");
  console.log("PAYMENT_CONTRACT_ADDRESS=" + escrowAddress);
  
  console.log("\n✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
