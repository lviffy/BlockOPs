import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("PaymentEscrow", function () {
  async function deployEscrowFixture() {
    const [owner, treasury, backend, user] = await ethers.getSigners();
    
    const PaymentEscrow = await ethers.getContractFactory("PaymentEscrow");
    const escrow = await PaymentEscrow.deploy(treasury.address, owner.address);
    
    return { escrow, owner, treasury, backend, user };
  }

  describe("Deployment", function () {
    it("Should set the correct treasury", async function () {
      const { escrow, treasury } = await loadFixture(deployEscrowFixture);
      expect(await escrow.treasury()).to.equal(treasury.address);
    });

    it("Should set the correct owner", async function () {
      const { escrow, owner } = await loadFixture(deployEscrowFixture);
      expect(await escrow.owner()).to.equal(owner.address);
    });
  });

  describe("Payment Creation", function () {
    it("Should create payment with native currency", async function () {
      const { escrow, user } = await loadFixture(deployEscrowFixture);
      
      const amount = ethers.parseEther("0.25");
      const tx = await escrow.connect(user).createPayment(
        "agent123",
        "aiWorkflow",
        ethers.ZeroAddress,
        amount,
        { value: amount }
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "PaymentCreated"
      );
      
      expect(event).to.not.be.undefined;
    });

    it("Should fail if payment amount doesn't match value sent", async function () {
      const { escrow, user } = await loadFixture(deployEscrowFixture);
      
      const amount = ethers.parseEther("0.25");
      await expect(
        escrow.connect(user).createPayment(
          "agent123",
          "aiWorkflow",
          ethers.ZeroAddress,
          amount,
          { value: ethers.parseEther("0.1") }
        )
      ).to.be.revertedWith("Incorrect payment amount");
    });
  });

  describe("Payment Execution", function () {
    it("Should execute payment to treasury", async function () {
      const { escrow, owner, treasury, backend, user } = await loadFixture(deployEscrowFixture);
      
      // Authorize backend
      await escrow.connect(owner).addAuthorizedBackend(backend.address);
      
      // Create payment
      const amount = ethers.parseEther("0.25");
      const tx = await escrow.connect(user).createPayment(
        "agent123",
        "aiWorkflow",
        ethers.ZeroAddress,
        amount,
        { value: amount }
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "PaymentCreated"
      );
      const paymentId = event.args[0];
      
      // Check treasury balance before
      const balanceBefore = await ethers.provider.getBalance(treasury.address);
      
      // Execute payment
      await escrow.connect(backend).executePayment(paymentId);
      
      // Check treasury balance after
      const balanceAfter = await ethers.provider.getBalance(treasury.address);
      expect(balanceAfter - balanceBefore).to.equal(amount);
    });

    it("Should fail if not authorized backend", async function () {
      const { escrow, user } = await loadFixture(deployEscrowFixture);
      
      const amount = ethers.parseEther("0.25");
      const tx = await escrow.connect(user).createPayment(
        "agent123",
        "aiWorkflow",
        ethers.ZeroAddress,
        amount,
        { value: amount }
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "PaymentCreated"
      );
      const paymentId = event.args[0];
      
      await expect(
        escrow.connect(user).executePayment(paymentId)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Payment Refund", function () {
    it("Should refund payment to user", async function () {
      const { escrow, owner, backend, user } = await loadFixture(deployEscrowFixture);
      
      // Authorize backend
      await escrow.connect(owner).addAuthorizedBackend(backend.address);
      
      // Create payment
      const amount = ethers.parseEther("0.25");
      const tx = await escrow.connect(user).createPayment(
        "agent123",
        "aiWorkflow",
        ethers.ZeroAddress,
        amount,
        { value: amount }
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "PaymentCreated"
      );
      const paymentId = event.args[0];
      
      // Check user balance before
      const balanceBefore = await ethers.provider.getBalance(user.address);
      
      // Refund payment
      await escrow.connect(backend).refundPayment(paymentId);
      
      // Check user balance after
      const balanceAfter = await ethers.provider.getBalance(user.address);
      expect(balanceAfter - balanceBefore).to.equal(amount);
    });

    it("Should not refund already executed payment", async function () {
      const { escrow, owner, backend, user } = await loadFixture(deployEscrowFixture);
      
      // Authorize backend
      await escrow.connect(owner).addAuthorizedBackend(backend.address);
      
      // Create and execute payment
      const amount = ethers.parseEther("0.25");
      const tx = await escrow.connect(user).createPayment(
        "agent123",
        "aiWorkflow",
        ethers.ZeroAddress,
        amount,
        { value: amount }
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "PaymentCreated"
      );
      const paymentId = event.args[0];
      
      await escrow.connect(backend).executePayment(paymentId);
      
      // Try to refund
      await expect(
        escrow.connect(backend).refundPayment(paymentId)
      ).to.be.revertedWith("Already executed");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to authorize backend", async function () {
      const { escrow, owner, backend } = await loadFixture(deployEscrowFixture);
      
      await escrow.connect(owner).addAuthorizedBackend(backend.address);
      expect(await escrow.authorizedBackends(backend.address)).to.be.true;
    });

    it("Should allow owner to set supported tokens", async function () {
      const { escrow, owner } = await loadFixture(deployEscrowFixture);
      
      const tokenAddress = "0x1234567890123456789012345678901234567890";
      await escrow.connect(owner).setSupportedToken(tokenAddress, true);
      expect(await escrow.supportedTokens(tokenAddress)).to.be.true;
    });

    it("Should allow owner to pause", async function () {
      const { escrow, owner, user } = await loadFixture(deployEscrowFixture);
      
      await escrow.connect(owner).pause();
      
      const amount = ethers.parseEther("0.25");
      await expect(
        escrow.connect(user).createPayment(
          "agent123",
          "aiWorkflow",
          ethers.ZeroAddress,
          amount,
          { value: amount }
        )
      ).to.be.reverted;
    });
  });
});
