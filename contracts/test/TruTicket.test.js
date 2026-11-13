const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

// Prices are in paise, like the database. 49900 = Rs 499.00. Cap 11000 bps = 110%.
const FACE = 49900n;
const CAP_BPS = 11000;
const MAX_ASK = (FACE * BigInt(CAP_BPS)) / 10000n; // 54890
const EVENT = ethers.id("event-uuid-1");

async function deploy() {
  const [admin, buyer, friend, other, verifier, stranger] = await ethers.getSigners();
  const T = await ethers.getContractFactory("TruTicket");
  const c = await T.deploy();
  await c.waitForDeployment();
  const cutoff = BigInt((await time.latest()) + 30 * 24 * 3600);
  await c.setPolicy(EVENT, CAP_BPS, 2, cutoff);
  const tx = await c.mintTicket(buyer.address, EVENT, FACE);
  await tx.wait();
  const tokenId = 1n;
  return { c, admin, buyer, friend, other, verifier, stranger, tokenId, cutoff };
}

describe("TruTicket", function () {
  describe("mint and policy", function () {
    it("mints with face value and owner", async function () {
      const { c, buyer, tokenId } = await deploy();
      expect(await c.ownerOf(tokenId)).to.equal(buyer.address);
      const t = await c.tickets(tokenId);
      expect(t.faceValueMinor).to.equal(FACE);
      expect(t.transferCount).to.equal(0);
    });

    it("refuses to mint for an event with no policy", async function () {
      const { c, buyer } = await deploy();
      await expect(c.mintTicket(buyer.address, ethers.id("no-policy"), FACE)).to.be.revertedWith("No policy for event");
    });

    it("only an organiser can set a policy", async function () {
      const { c, stranger } = await deploy();
      await expect(c.connect(stranger).setPolicy(EVENT, CAP_BPS, 2, 1)).to.be.reverted;
    });

    it("rejects a cap below 100% or above 200%", async function () {
      const { c } = await deploy();
      await expect(c.setPolicy(EVENT, 9999, 2, 1)).to.be.revertedWith("Invalid cap");
      await expect(c.setPolicy(EVENT, 20001, 2, 1)).to.be.revertedWith("Invalid cap");
    });
  });

  describe("direct transfer", function () {
    it("a wallet cannot send its ticket directly", async function () {
      const { c, buyer, friend, tokenId } = await deploy();
      await expect(c.connect(buyer).transferFrom(buyer.address, friend.address, tokenId)).to.be.revertedWith(
        "Direct transfer not allowed"
      );
    });

    it("safeTransferFrom is blocked too", async function () {
      const { c, buyer, friend, tokenId } = await deploy();
      await expect(
        c.connect(buyer)["safeTransferFrom(address,address,uint256)"](buyer.address, friend.address, tokenId)
      ).to.be.revertedWith("Direct transfer not allowed");
    });

    it("burn is refused", async function () {
      const { c, buyer, tokenId } = await deploy();
      await expect(c.connect(buyer).transferFrom(buyer.address, ethers.ZeroAddress, tokenId)).to.be.reverted;
    });
  });

  describe("resale", function () {
    it("lists at the cap and refuses above it", async function () {
      const { c, buyer, tokenId } = await deploy();
      await expect(c.connect(buyer).listForResale(tokenId, MAX_ASK + 1n)).to.be.revertedWith("Price exceeds cap");
      await expect(c.connect(buyer).listForResale(tokenId, MAX_ASK)).to.emit(c, "TicketListed");
    });

    it("refuses a zero price", async function () {
      const { c, buyer, tokenId } = await deploy();
      await expect(c.connect(buyer).listForResale(tokenId, 0)).to.be.revertedWith("Price exceeds cap");
    });

    it("only the owner can list", async function () {
      const { c, stranger, tokenId } = await deploy();
      await expect(c.connect(stranger).listForResale(tokenId, MAX_ASK)).to.be.revertedWith("Not owner");
    });

    it("settles through the marketplace and moves the ticket", async function () {
      const { c, admin, buyer, friend, tokenId } = await deploy();
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      await expect(c.settleResale(tokenId, friend.address))
        .to.emit(c, "TicketResold")
        .withArgs(tokenId, buyer.address, friend.address, MAX_ASK);
      expect(await c.ownerOf(tokenId)).to.equal(friend.address);
      expect((await c.tickets(tokenId)).transferCount).to.equal(1);
      expect((await c.listings(tokenId)).active).to.equal(false);
    });

    it("only the marketplace can settle", async function () {
      const { c, buyer, stranger, tokenId } = await deploy();
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      await expect(c.connect(stranger).settleResale(tokenId, stranger.address)).to.be.reverted;
    });

    it("refuses a second resale past the transfer limit", async function () {
      const { c, buyer, friend, other, tokenId } = await deploy();
      // Limit is 2 in deploy(). First resale: buyer -> friend. Second: friend -> other. Third must fail.
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      await c.settleResale(tokenId, friend.address);
      await c.connect(friend).listForResale(tokenId, MAX_ASK);
      await c.settleResale(tokenId, other.address);
      await expect(c.connect(other).listForResale(tokenId, MAX_ASK)).to.be.revertedWith("Transfer limit reached");
    });

    it("a listing cannot be settled after the cutoff", async function () {
      // Cutoff at 2 days, so it passes before the 7-day listing expiry.
      const { c, buyer, friend, tokenId } = await deploy();
      const cutoff = BigInt((await time.latest()) + 2 * 24 * 3600);
      await c.setPolicy(EVENT, CAP_BPS, 2, cutoff);
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      await time.increaseTo(cutoff + 1n);
      await expect(c.settleResale(tokenId, friend.address)).to.be.revertedWith("Resale cutoff passed");
    });

    it("settle re-checks the cap if the organiser lowers it after listing", async function () {
      const { c, buyer, friend, tokenId } = await deploy();
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      const cutoff = BigInt((await time.latest()) + 30 * 24 * 3600);
      await c.setPolicy(EVENT, 10000, 2, cutoff); // cap now 100%, below the listed 110%
      await expect(c.settleResale(tokenId, friend.address)).to.be.revertedWith("Price exceeds cap");
    });

    it("settle re-checks the transfer limit if the organiser lowers it after listing", async function () {
      const { c, buyer, friend, other, tokenId } = await deploy();
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      await c.settleResale(tokenId, friend.address); // transferCount = 1, limit 2
      await c.connect(friend).listForResale(tokenId, MAX_ASK); // allowed: 1 < 2
      const cutoff = BigInt((await time.latest()) + 30 * 24 * 3600);
      await c.setPolicy(EVENT, CAP_BPS, 1, cutoff); // limit now 1, already used
      await expect(c.settleResale(tokenId, other.address)).to.be.revertedWith("Transfer limit reached");
    });

    it("the marketplace can list on behalf of the owner (custodial wallets do not sign)", async function () {
      const { c, buyer, friend, tokenId } = await deploy();
      await expect(c.listForResaleFor(tokenId, MAX_ASK)).to.emit(c, "TicketListed").withArgs(tokenId, buyer.address, MAX_ASK, anyValue);
      await c.settleResale(tokenId, friend.address);
      expect(await c.ownerOf(tokenId)).to.equal(friend.address);
    });

    it("only the marketplace can list on behalf of the owner", async function () {
      const { c, stranger, tokenId } = await deploy();
      await expect(c.connect(stranger).listForResaleFor(tokenId, MAX_ASK)).to.be.reverted;
    });

    it("a listing expires after 7 days", async function () {
      const { c, buyer, friend, tokenId } = await deploy();
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      await time.increase(7 * 24 * 3600 + 1);
      await expect(c.settleResale(tokenId, friend.address)).to.be.revertedWith("Listing expired");
    });

    it("a cancelled listing cannot be settled", async function () {
      const { c, buyer, friend, tokenId } = await deploy();
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      await c.connect(buyer).cancelListing(tokenId);
      await expect(c.settleResale(tokenId, friend.address)).to.be.revertedWith("No active listing");
    });

    it("a stranger cannot cancel someone else's listing", async function () {
      const { c, buyer, stranger, tokenId } = await deploy();
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      await expect(c.connect(stranger).cancelListing(tokenId)).to.be.revertedWith("Not authorized");
    });

    it("a listed ticket cannot be allocated to a group member", async function () {
      const { c, buyer, friend, tokenId } = await deploy();
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      await expect(c.allocate(tokenId, friend.address)).to.be.revertedWith("Ticket listed");
    });
  });

  describe("group allocation", function () {
    it("moves the ticket at zero price and does not use a transfer", async function () {
      const { c, buyer, friend, tokenId } = await deploy();
      await expect(c.allocate(tokenId, friend.address)).to.emit(c, "TicketAllocated").withArgs(tokenId, buyer.address, friend.address);
      expect(await c.ownerOf(tokenId)).to.equal(friend.address);
      expect((await c.tickets(tokenId)).transferCount).to.equal(0);
    });

    it("refuses to allocate to the current owner", async function () {
      const { c, buyer, tokenId } = await deploy();
      await expect(c.allocate(tokenId, buyer.address)).to.be.revertedWith("Already owner");
    });

    it("only the marketplace (backend) can allocate", async function () {
      const { c, stranger, friend, tokenId } = await deploy();
      await expect(c.connect(stranger).allocate(tokenId, friend.address)).to.be.reverted;
    });
  });

  describe("redemption", function () {
    it("redeems once", async function () {
      const { c, admin, tokenId } = await deploy();
      await expect(c.redeem(tokenId)).to.emit(c, "TicketRedeemed").withArgs(tokenId, admin.address);
      await expect(c.redeem(tokenId)).to.be.revertedWith("Already redeemed");
    });

    it("only a verifier can redeem", async function () {
      const { c, stranger, tokenId } = await deploy();
      await expect(c.connect(stranger).redeem(tokenId)).to.be.reverted;
    });

    it("a listed ticket cannot be redeemed", async function () {
      const { c, buyer, tokenId } = await deploy();
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      await expect(c.redeem(tokenId)).to.be.revertedWith("Ticket listed");
    });

    it("a redeemed ticket cannot be resold", async function () {
      const { c, buyer, friend, tokenId } = await deploy();
      await c.redeem(tokenId);
      await expect(c.connect(buyer).listForResale(tokenId, MAX_ASK)).to.be.revertedWith("Ticket not usable");
      await expect(c.allocate(tokenId, friend.address)).to.be.revertedWith("Ticket not usable");
    });

    it("a revoked ticket cannot be redeemed", async function () {
      const { c, tokenId } = await deploy();
      await c.revoke(tokenId, "chargeback");
      await expect(c.redeem(tokenId)).to.be.revertedWith("Ticket revoked");
    });

    it("a redeemed ticket cannot be revoked", async function () {
      const { c, tokenId } = await deploy();
      await c.redeem(tokenId);
      await expect(c.revoke(tokenId, "late")).to.be.revertedWith("Already redeemed");
    });
  });

  describe("pause", function () {
    it("pause stops mint, list, settle and redeem; unpause restores them", async function () {
      const { c, buyer, friend, tokenId } = await deploy();
      await c.pause();
      await expect(c.redeem(tokenId)).to.be.revertedWithCustomError(c, "EnforcedPause");
      await expect(c.connect(buyer).listForResale(tokenId, MAX_ASK)).to.be.revertedWithCustomError(c, "EnforcedPause");
      await expect(c.allocate(tokenId, friend.address)).to.be.revertedWithCustomError(c, "EnforcedPause");
      await expect(c.mintTicket(buyer.address, EVENT, FACE)).to.be.revertedWithCustomError(c, "EnforcedPause");
      await c.unpause();
      await expect(c.redeem(tokenId)).to.emit(c, "TicketRedeemed");
    });

    it("only admin can pause", async function () {
      const { c, stranger } = await deploy();
      await expect(c.connect(stranger).pause()).to.be.reverted;
    });
  });

  describe("views", function () {
    it("reports the max resale price and whether a ticket can move", async function () {
      const { c, buyer, tokenId } = await deploy();
      expect(await c.maxResalePrice(tokenId)).to.equal(MAX_ASK);
      expect(await c.canTransfer(tokenId)).to.equal(true);
      await c.connect(buyer).listForResale(tokenId, MAX_ASK);
      expect(await c.canTransfer(tokenId)).to.equal(false);
    });
  });
});
