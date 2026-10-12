// Deploy MBGChain dengan viem, lalu simpan alamat + ABI ke deployments/<jaringan>.json
// agar bisa dipakai front-end (React), script seed, dan script demo.
//
//   Lokal (default) : RPC_URL=http://127.0.0.1:8545  -> akun pertama node menjadi admin BGN
//   Testnet Sepolia : isi RPC_URL dan PRIVATE_KEY di file .env (lihat .env.example)
import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, createWalletClient, defineChain, getAddress, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ROOT, bacaJson, muatEnv, namaJaringan, tulisJson } from './util.js';

muatEnv();
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const artefak = bacaJson('build/MBGChain.json');
if (!artefak) {
  console.error('build/MBGChain.json belum ada. Jalankan: npm run compile');
  process.exit(1);
}

const publik = createPublicClient({ transport: http(RPC_URL, { retryCount: 0 }), pollingInterval: 250 });
let chainId;
try {
  chainId = await publik.getChainId();
} catch {
  console.error(`Tidak bisa terhubung ke ${RPC_URL}. Sudah menjalankan "npm run chain"?`);
  process.exit(1);
}
const jaringan = namaJaringan(chainId);
const chain = defineChain({ id: chainId, name: jaringan, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } });
const dompet = createWalletClient({ chain, transport: http(RPC_URL, { retryCount: 0 }) });

let admin;
if (process.env.PRIVATE_KEY) {
  const kunci = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`;
  admin = privateKeyToAccount(kunci);                // transaksi ditandatangani lokal oleh viem
} else {
  admin = getAddress((await dompet.getAddresses())[0]); // akun yang dikelola node lokal
}
const alamatAdmin = typeof admin === 'string' ? admin : admin.address;
console.log(`Deploy MBGChain ke jaringan ${jaringan} (chainId ${chainId}) dari akun admin ${alamatAdmin}`);

const gas = await publik.estimateGas({ account: admin, data: artefak.bytecode });
const txHash = await dompet.deployContract({ abi: artefak.abi, bytecode: artefak.bytecode, account: admin, gas: (gas * 12n) / 10n });
console.log(`  transaksi dikirim : ${txHash}`);
const receipt = await publik.waitForTransactionReceipt({ hash: txHash });
if (receipt.status !== 'success' || !receipt.contractAddress) {
  console.error('Deploy gagal dieksekusi di jaringan.');
  process.exit(1);
}

const info = {
  jaringan,
  chainId,
  // URL RPC testnet (Alchemy/Infura) bisa berisi API key, jadi hanya alamat node lokal yang disimpan.
  ...(jaringan === 'lokal' && { rpcUrl: RPC_URL }),
  address: getAddress(receipt.contractAddress),
  admin: alamatAdmin,
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
const baca = (functionName) => publik.readContract({ address: info.address, abi: artefak.abi, functionName });
const [adminTerbaca, batas] = await Promise.all([baca('admin'), baca('BATAS_KONSUMSI')]);
console.log(`✔ MBGChain ter-deploy di ${info.address}`);
console.log(`  blok ${info.blockNumber} · gas ${info.gasUsed.toLocaleString('id-ID')} · admin terbaca ${adminTerbaca}`);
console.log(`  BATAS_KONSUMSI terbaca dari kontrak = ${Number(batas) / 3600} jam`);
console.log(`  alamat + ABI disimpan di ${path.relative(ROOT, file)}${jaringan === 'lokal' ? ' (+ frontend/public/kontrak.json)' : ''}`);
