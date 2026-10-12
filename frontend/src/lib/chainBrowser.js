// Mode demo browser (build GitHub Pages): blockchain Ganache berjalan di browser pengunjung, tanpa server.
// Saat halaman dibuka: chain baru dibuat, MBGChain di-deploy dengan Web3.js, lalu data demo yang sama dengan
// `npm run seed` diisi. Data hanya ada di tab ini dan kembali ke awal saat halaman dimuat ulang.
import { Web3 } from 'web3';
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
  const web3 = new Web3(provider);
  const [admin] = await web3.eth.getAccounts();

  kabar('Men-deploy smart contract MBGChain…');
  const deployTx = new web3.eth.Contract(artefak.abi).deploy({ data: artefak.bytecode });
  const gas = await deployTx.estimateGas({ from: admin });
  const kontrakWeb3 = await deployTx.send({ from: admin, gas: String(gas) });
  const address = kontrakWeb3.options.address;

  kabar('Mengisi data demo (organisasi, petugas, 6 batch)…');
  const { akunDemo } = await isiDataDemo(web3, new web3.eth.Contract(artefak.abi, address));

  // Seperti scripts/chain.js: blok kosong tiap 5 detik agar jam chain terus berjalan.
  setInterval(() => provider.request({ method: 'evm_mine', params: [] }).catch(() => {}), 5000);

  const kontrak = { jaringan: 'demo browser', chainId: 1337, address, blockNumber: 1, abi: artefak.abi };
  return { provider, kontrak, akunDemo };
}

export function siapkanChainBrowser(kabar = () => {}) {
  if (!siap) siap = siapkan(kabar).catch((e) => { siap = null; throw e; });
  return siap;
}
