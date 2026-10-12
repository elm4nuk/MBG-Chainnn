// Mode demo browser (build GitHub Pages): blockchain Ganache berjalan di browser pengunjung, tanpa server.
// Saat halaman dibuka: chain baru dibuat, MBGChain di-deploy dengan viem, lalu data demo yang sama dengan
// `npm run seed` diisi. Data hanya ada di tab ini dan kembali ke awal saat halaman dimuat ulang.
// Ganache dipakai di sini karena Hardhat dan Anvil tidak bisa berjalan di browser; chain lokal & test memakai Hardhat.
import { createPublicClient, createWalletClient, custom } from 'viem';
import ganacheUrl from 'ganache/dist/web/ganache.min.js?url';
import artefak from '@artefak';
import { isiDataDemo } from '@skenario';

let siap = null; // satu chain per tab, walau mulai() dipanggil lagi (Coba lagi / StrictMode)

function muatGanache() {
  if (window.Ganache) return Promise.resolve(window.Ganache);
  return new Promise((selesai, gagal) => {
    const s = document.createElement('script');
    s.src = ganacheUrl;
    s.async = true;
    s.onload = () => (window.Ganache ? selesai(window.Ganache) : gagal(new Error('Ganache tidak termuat.')));
    s.onerror = () => gagal(new Error('Berkas blockchain demo gagal diunduh. Periksa koneksi internet lalu muat ulang.'));
    document.head.appendChild(s);
  });
}

async function siapkan(kabar) {
  kabar('Mengunduh blockchain demo (Ganache)…');
  const Ganache = await muatGanache();
  // Sama dengan scripts/chain.js: akun deterministik, chainId 1337, jam mulai 5 jam sebelum sekarang.
  const provider = Ganache.provider({
    wallet: { deterministic: true, totalAccounts: 10, defaultBalance: 1000 },
    chain: { chainId: 1337, networkId: 1337, time: new Date(Date.now() - 5 * 60 * 60 * 1000) },
    logging: { quiet: true },
  });
  const transport = custom(provider, { retryCount: 0 });
  const publik = createPublicClient({ transport, pollingInterval: 100 });
  const dompet = createWalletClient({ transport });
  const [admin] = await dompet.getAddresses();

  kabar('Men-deploy smart contract MBGChain…');
  // Gas wajib diisi: tanpa itu Ganache memakai batas bawaan 90.000 (terlalu kecil untuk deploy).
  const gas = await publik.estimateGas({ account: admin, data: artefak.bytecode });
  const hash = await dompet.deployContract({ abi: artefak.abi, bytecode: artefak.bytecode, account: admin, gas: (gas * 12n) / 10n, chain: null });
  const { contractAddress: address } = await publik.waitForTransactionReceipt({ hash });

  kabar('Mengisi data demo (organisasi, petugas, 6 batch)…');
  const { akunDemo } = await isiDataDemo(provider, address, artefak.abi);

  // Seperti scripts/chain.js: blok kosong tiap 5 detik agar jam chain terus berjalan.
  setInterval(() => provider.request({ method: 'evm_mine', params: [] }).catch(() => {}), 5000);

  const kontrak = { jaringan: 'demo browser', chainId: 1337, address, blockNumber: 1, abi: artefak.abi };
  return { provider, kontrak, akunDemo };
}

export function siapkanChainBrowser(kabar = () => {}) {
  if (!siap) siap = siapkan(kabar).catch((e) => { siap = null; throw e; });
  return siap;
}
