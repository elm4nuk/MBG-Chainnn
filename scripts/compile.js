// Kompilasi contracts/MBGChain.sol dengan solc-js -> build/MBGChain.json (ABI + bytecode).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import { ROOT, tulisJson } from './util.js';

const NAMA = 'MBGChain';
const EVM_VERSION = 'paris'; // aman untuk Hardhat node, Ganache (demo browser), dan testnet Sepolia

export function kompilasi() {
  const sumber = fs.readFileSync(path.join(ROOT, 'contracts', `${NAMA}.sol`), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { [`${NAMA}.sol`]: { content: sumber } },
    settings: {
      evmVersion: EVM_VERSION,
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
    },
  };
  const hasil = JSON.parse(solc.compile(JSON.stringify(input)));
  const pesan = hasil.errors || [];
  for (const p of pesan) (p.severity === 'error' ? console.error : console.warn)(p.formattedMessage);
  if (pesan.some((p) => p.severity === 'error')) throw new Error('Kompilasi gagal');

  const c = hasil.contracts[`${NAMA}.sol`][NAMA];
  return {
    contractName: NAMA,
    compiler: solc.version(),
    evmVersion: EVM_VERSION,
    abi: c.abi,
    bytecode: '0x' + c.evm.bytecode.object,
    deployedBytes: c.evm.deployedBytecode.object.length / 2,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const artefak = kompilasi();
  tulisJson(`build/${NAMA}.json`, artefak);
  console.log(`✔ ${NAMA} dikompilasi dengan solc ${artefak.compiler} (EVM ${EVM_VERSION})`);
  console.log(`  ${artefak.abi.length} entri ABI · bytecode runtime ${artefak.deployedBytes} byte → build/${NAMA}.json`);
}
