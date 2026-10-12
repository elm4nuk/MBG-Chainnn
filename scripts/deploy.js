// Deploy MBGChain dengan Web3.js, lalu simpan alamat + ABI ke deployments/<jaringan>.json
// agar bisa dipakai front-end (React), script seed, dan script demo.
//
//   Lokal (default) : RPC_URL=http://127.0.0.1:8545  -> akun pertama node menjadi admin BGN
//   Ganache GUI     : RPC_URL=http://127.0.0.1:7545
//   Testnet Sepolia : isi RPC_URL dan PRIVATE_KEY di file .env (lihat .env.example)
import fs from 'node:fs';
import path from 'node:path';
import { Web3 } from 'web3';
import { ROOT, bacaJson, muatEnv, namaJaringan, tulisJson } from './util.js';

muatEnv();
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const artefak = bacaJson('build/MBGChain.json');
if (!artefak) {
  console.error('build/MBGChain.json belum ada. Jalankan: npm run compile');
  process.exit(1);
}

const web3 = new Web3(RPC_URL);
let admin;
try {
  if (process.env.PRIVATE_KEY) {
    const kunci = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`;
    const akun = web3.eth.accounts.privateKeyToAccount(kunci);
    web3.eth.accounts.wallet.add(akun);   // transaksi ditandatangani lokal oleh Web3.js
    admin = akun.address;
  } else {
    [admin] = await web3.eth.getAccounts(); // akun yang dikelola node lokal
  }
} catch (e) {
  console.error(`Tidak bisa terhubung ke ${RPC_URL}. Sudah menjalankan "npm run chain"?`);
  process.exit(1);
}

const chainId = Number(await web3.eth.getChainId());
const jaringan = namaJaringan(chainId);
console.log(`Deploy MBGChain ke jaringan ${jaringan} (chainId ${chainId}) dari akun admin ${admin}`);

const deployTx = new web3.eth.Contract(artefak.abi).deploy({ data: artefak.bytecode });
const gas = await deployTx.estimateGas({ from: admin });
let txHash;
const kontrak = await deployTx
  .send({ from: admin, gas: String(Math.ceil(Number(gas) * 1.2)) })
  .on('transactionHash', (h) => {
    txHash = h;
    console.log(`  transaksi dikirim : ${h}`);
  });
const receipt = await web3.eth.getTransactionReceipt(txHash);

const info = {
  jaringan,
  chainId,
  // URL RPC testnet (Alchemy/Infura) bisa berisi API key, jadi hanya alamat node lokal yang disimpan.
  ...(jaringan === 'lokal' && { rpcUrl: RPC_URL }),
  address: kontrak.options.address,
  admin,
  txHash,
  blockNumber: Number(receipt.blockNumber),
  gasUsed: Number(receipt.gasUsed),
  waktuDeploy: new Date().toISOString(),
  compiler: artefak.compiler,
  evmVersion: artefak.evmVersion,
  abi: artefak.abi,
};
const file = tulisJson(`deployments/${jaringan}.json`, info);
// Salinan untuk aplikasi React (dibaca saat aplikasi dibuka): hanya untuk jaringan lokal.
if (jaringan === 'lokal' && fs.existsSync(path.join(ROOT, 'frontend'))) {
  tulisJson('frontend/public/kontrak.json', { jaringan, chainId, address: info.address, blockNumber: info.blockNumber, abi: info.abi });
}

// Cek koneksi: baca kembali data dari kontrak yang baru di-deploy.
const cek = new web3.eth.Contract(artefak.abi, info.address);
const [adminTerbaca, batas] = await Promise.all([cek.methods.admin().call(), cek.methods.BATAS_KONSUMSI().call()]);
console.log(`✔ MBGChain ter-deploy di ${info.address}`);
console.log(`  blok ${info.blockNumber} · gas ${info.gasUsed.toLocaleString('id-ID')} · admin terbaca ${adminTerbaca}`);
console.log(`  BATAS_KONSUMSI terbaca dari kontrak = ${Number(batas) / 3600} jam`);
console.log(`  alamat + ABI disimpan di ${path.relative(ROOT, file)}${jaringan === 'lokal' ? ' (+ frontend/public/kontrak.json)' : ''}`);
