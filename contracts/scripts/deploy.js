// Deploys TruTicket to Polygon Amoy (testnet). Run from the contracts folder:
//   npx hardhat run scripts/deploy.js --network amoy
// Needs POLYGON_AMOY_PRIVATE_KEY in contracts/.env (never commit it). The deployer wallet
// gets every role, so it is also the operator wallet the backend uses. Needs test MATIC.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`network=${network.name} deployer=${deployer.address} balance=${ethers.formatEther(balance)} MATIC`);
  if (balance === 0n) throw new Error("Deployer has no test MATIC. Get some from the Amoy faucet first.");

  const T = await ethers.getContractFactory("TruTicket");
  const c = await T.deploy();
  await c.waitForDeployment();
  const address = await c.getAddress();
  const receipt = await c.deploymentTransaction().wait();

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    contract: address,
    operator: deployer.address,
    deployTx: receipt.hash,
    deployedAt: new Date().toISOString(),
  };
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 2));
  console.log(`Verify (optional): npx hardhat verify --network amoy ${address}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
