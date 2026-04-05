import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/utils/ApiError.js';
import { getContractModel } from './model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const artifactPath = path.resolve(__dirname, './artifacts/AdminContract.json');

function requireBlockchainEnv() {
  if (!env.blockchain.rpcUrl) {
    throw new ApiError(500, 'Missing RPC_URL in server .env');
  }

  if (!env.blockchain.contractOperatorPrivateKey) {
    throw new ApiError(500, 'Missing CONTRACT_OPERATOR_PRIVATE_KEY in server .env');
  }
}

function getProvider() {
  requireBlockchainEnv();
  return new ethers.JsonRpcProvider(env.blockchain.rpcUrl);
}

function getWallet() {
  const provider = getProvider();
  return new ethers.Wallet(env.blockchain.contractOperatorPrivateKey, provider);
}

function loadArtifact() {
  if (!fs.existsSync(artifactPath)) {
    throw new ApiError(
      500,
      'AdminContract artifact not found. Copy AdminContract.json into server/src/modules/contracts/artifacts/'
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  if (!artifact.abi || !artifact.bytecode || artifact.bytecode === '0x') {
    throw new ApiError(500, 'AdminContract artifact is invalid or bytecode is missing.');
  }

  return artifact;
}

function getExplorerBaseUrl(chainId) {
  if (Number(chainId) === 80002) {
    return 'https://amoy.polygonscan.com';
  }

  return null;
}

async function getAccountInfo(provider, wallet) {
  const network = await provider.getNetwork();
  const balanceWei = await provider.getBalance(wallet.address);

  return {
    address: wallet.address,
    chainId: Number(network.chainId || env.blockchain.chainId),
    network: network.name,
    balanceWei: balanceWei.toString(),
    balanceNative: ethers.formatEther(balanceWei),
    gasToken: 'POL',
  };
}

async function getFeePerGas(provider) {
  const feeData = await provider.getFeeData();
  const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;

  if (!feePerGas) {
    throw new ApiError(500, 'Could not fetch fee data.');
  }

  return feePerGas;
}

async function buildEstimateInternal() {
  const provider = getProvider();
  const wallet = getWallet();
  const artifact = loadArtifact();

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const deployTx = await factory.getDeployTransaction();

  const gasLimit = await provider.estimateGas({
    ...deployTx,
    from: wallet.address,
  });

  const feePerGas = await getFeePerGas(provider);
  const totalCostWei = gasLimit * feePerGas;
  const network = await provider.getNetwork();
  const account = await getAccountInfo(provider, wallet);

  return {
    contractName: 'AdminContract',
    chainId: Number(network.chainId || env.blockchain.chainId),
    network: network.name,
    gasToken: 'POL',
    walletAddress: wallet.address,
    gasLimit: gasLimit.toString(),
    feePerGasWei: feePerGas.toString(),
    feePerGasGwei: ethers.formatUnits(feePerGas, 'gwei'),
    totalCostWei: totalCostWei.toString(),
    totalCostNative: ethers.formatEther(totalCostWei),
    account,
  };
}

export async function getBlockchainRuntimeOverview() {
  const provider = getProvider();
  const wallet = getWallet();
  const network = await provider.getNetwork();
  const account = await getAccountInfo(provider, wallet);

  return {
    health: {
      ok: true,
      walletAddress: wallet.address,
      chainId: Number(network.chainId || env.blockchain.chainId),
      network: network.name,
    },
    account,
  };
}

export async function getContractsDashboard() {
  const Contract = getContractModel();

  const [overview, contracts] = await Promise.all([
    getBlockchainRuntimeOverview(),
    Contract.find().sort({ createdAt: -1 }).lean(),
  ]);

  return {
    ...overview,
    contracts,
  };
}

export async function estimateDeployment() {
  return buildEstimateInternal();
}

export async function deployContract() {
  const provider = getProvider();
  const wallet = getWallet();
  const artifact = loadArtifact();
  const Contract = getContractModel();

  let deploymentRecord = null;

  try {
    const estimate = await buildEstimateInternal();
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    deploymentRecord = await Contract.create({
      contractName: estimate.contractName,
      deployerAddress: wallet.address,
      chainId: estimate.chainId,
      network: estimate.network,
      gasToken: estimate.gasToken,
      estimatedCostNative: estimate.totalCostNative,
      estimatedCostWei: estimate.totalCostWei,
      status: 'pending',
    });

    const contract = await factory.deploy();
    const deployTx = contract.deploymentTransaction();

    await contract.waitForDeployment();

    const address = await contract.getAddress();
    const explorerBaseUrl = getExplorerBaseUrl(estimate.chainId);
    const explorerUrl =
      explorerBaseUrl && deployTx?.hash
        ? `${explorerBaseUrl}/tx/${deployTx.hash}`
        : null;

    deploymentRecord.address = address;
    deploymentRecord.txHash = deployTx?.hash ?? null;
    deploymentRecord.explorerUrl = explorerUrl;
    deploymentRecord.status = 'success';
    deploymentRecord.errorMessage = null;
    await deploymentRecord.save();

    const account = await getAccountInfo(provider, wallet);

    return {
      success: true,
      id: deploymentRecord._id,
      contractName: estimate.contractName,
      address,
      owner: wallet.address,
      txHash: deployTx?.hash ?? null,
      chainId: estimate.chainId,
      network: estimate.network,
      explorerUrl,
      account,
    };
  } catch (error) {
    if (deploymentRecord) {
      deploymentRecord.status = 'failed';
      deploymentRecord.errorMessage = error.message || 'Deploy error';
      await deploymentRecord.save();
    }

    throw new ApiError(500, error.message || 'Deploy error');
  }
}