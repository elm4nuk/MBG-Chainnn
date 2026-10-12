// Jaringan lokal Hardhat (pengganti Ganache, yang sudah tidak dikembangkan Consensys).
// Mnemonic sama dengan mode deterministik Ganache, jadi alamat akun demo dan alamat kontrak
// (0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab) tetap sama dengan laporan Cicilan 1 dan 2.
// Hardfork dikunci "shanghai" agar angka gas sama dengan tabel gas di laporan.
// Kontrak tetap dikompilasi oleh scripts/compile.js (solc-js 0.8.30), bukan oleh Hardhat.
const akun = {
  mnemonic: 'myth like bonus scare over problem client lizard pioneer submit female collect',
  count: 10,
  accountsBalance: (1000n * 10n ** 18n).toString(), // 1000 ETH per akun
};
const dasar = { type: 'edr-simulated', chainType: 'l1', chainId: 1337, hardfork: 'shanghai', accounts: akun };

export default {
  networks: {
    // npm run chain: jam dimulai 5 jam sebelum sekarang (seed memajukannya kembali), blok kosong tiap 5 detik
    lokal: { ...dasar, initialDate: new Date(Date.now() - 5 * 60 * 60 * 1000), mining: { auto: true, interval: 5000 } },
    // npm test: blockchain in-process, satu blok per transaksi
    uji: dasar,
  },
};
