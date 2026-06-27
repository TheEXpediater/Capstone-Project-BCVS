import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverSrc = path.resolve(__dirname, '..');
const contractsDir = path.resolve(serverSrc, 'modules/contracts');
const sourceDir = path.resolve(contractsDir, 'source');
const artifactsDir = path.resolve(contractsDir, 'artifacts');

const sources = {
  'MerkleAnchor.sol': {
    content: fs.readFileSync(path.resolve(sourceDir, 'MerkleAnchor.sol'), 'utf8'),
  },
};

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors || [];
const fatal = errors.filter((item) => item.severity === 'error');

for (const item of errors) {
  const line = item.formattedMessage || item.message;
  if (item.severity === 'error') console.error(line);
  else console.warn(line);
}

if (fatal.length) {
  process.exitCode = 1;
} else {
  fs.mkdirSync(artifactsDir, { recursive: true });

  const compiled = output.contracts?.['MerkleAnchor.sol']?.MerkleAnchor;
  if (!compiled?.abi || !compiled?.evm?.bytecode?.object) {
    console.error('MerkleAnchor compile output is missing ABI or bytecode.');
    process.exitCode = 1;
  } else {
    const artifact = {
      _format: 'solc-artifact-1',
      contractName: 'MerkleAnchor',
      sourceName: 'server/src/modules/contracts/source/MerkleAnchor.sol',
      abi: compiled.abi,
      bytecode: `0x${compiled.evm.bytecode.object}`,
      deployedBytecode: `0x${compiled.evm.deployedBytecode.object || ''}`,
      linkReferences: {},
      deployedLinkReferences: {},
    };

    const artifactPath = path.resolve(artifactsDir, 'MerkleAnchor.json');
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`Wrote ${path.relative(process.cwd(), artifactPath)}`);
  }
}
