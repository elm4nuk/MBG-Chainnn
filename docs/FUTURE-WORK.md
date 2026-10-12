# MBG-Chain · Keterbatasan dan Pengembangan Berikutnya

Bahan bagian *Discussion / Future Work* paper IEEE. Disusun dari keterbatasan di laporan Cicilan 2 (Tabel 7) dan review kode Oktober 2026.

## 1. Tooling yang sudah tidak dikembangkan

| Komponen sekarang | Status | Rencana | Catatan |
|---|---|---|---|
| Ganache 7.9 (chain lokal & unit test) | Consensys menghentikan Truffle dan Ganache sejak akhir 2023 | **Sudah diganti** Hardhat 3 Network (`hardhat.config.js`, hardfork shanghai, mnemonic sama sehingga alamat dan gas tetap) | Ganache versi browser masih dipakai khusus demo online, karena Hardhat/Anvil tidak berjalan di browser. Alternatif berikutnya: Tevm (EVM di browser berbasis viem). |
| Web3.js 4.16 (`client/mbgchain.js`) | ChainSafe mengarsipkan Web3.js pada Maret 2025 | **Sudah diganti** viem 2.56 | API klien dipertahankan sehingga layar React tidak berubah; 25 unit test dan E2E menjadi pengaman migrasi. |

## 2. Keamanan dan tata kelola

- **Penanda tangan per petugas.** Di prototype, kata sandi hanya diperiksa aplikasi dan akun dikelola node chain lokal. Di jaringan sungguhan setiap petugas perlu penanda tangan sendiri tanpa pop-up dompet: layanan penanda tangan institusi (mis. EthSigner pada Hyperledger Besu) atau smart account ERC-4337 dengan passkey.
- **Admin tunggal.** `admin` adalah satu alamat `immutable`. Rencana: peran berbasis OpenZeppelin `AccessControl` dan multisig Safe untuk admin BGN.
- **Data pribadi on-chain.** Nama petugas tersimpan sebagai `string` di kontrak dan terbaca publik. Untuk kepatuhan UU Pelindungan Data Pribadi, simpan hanya ID/hash di kontrak dan nama di basis data off-chain.
- **Analisis statis.** Slither dijalankan di CI (laporan saja); setelah temuan awal ditinjau, CI dapat dibuat gagal untuk tingkat *medium* ke atas. Fuzz test dapat ditambahkan dengan Foundry.

## 3. Skala data

- Daftar batch dan jejak audit dibaca dari event mulai blok 0 (`getPastEvents(..., fromBlock: 0)`). Untuk data besar: indexer (Ponder atau The Graph), atau minimal mulai dari blok deploy.

## 4. Jaringan

| Tahap | Jaringan | Alasan |
|---|---|---|
| Demo kelas | Chain lokal Hardhat dan demo online di browser | Tanpa biaya, data bisa diatur, jam bisa dimajukan untuk aturan 4 jam |
| Uji publik | Sepolia / Base Sepolia | Bukti bahwa kontrak berjalan di jaringan publik; butuh akun uji + faucet dan penanda tangan per petugas |
| Produksi | EVM berizin, mis. Hyperledger Besu (QBFT) dengan node BGN, Dinkes, SPPG | Testnet publik bukan jaringan berizin; README menyebut "berizin" pada tingkat kontrak, bukan jaringan |

## 5. Pengalaman pengguna lapangan

- PWA (mis. `vite-plugin-pwa`) agar kurir dan PIC sekolah bisa memasang aplikasi di HP dan tetap membuka data terakhir saat sinyal lemah.
- Kamera QR di HP membutuhkan HTTPS (sudah tersedia `npm run demo:start:https` dengan sertifikat lokal; demo online di GitHub Pages sudah HTTPS).
- Usability test 3–5 PIC sekolah memakai template Session 10.

## 6. Bukti serah terima

- Ethereum Attestation Service (EAS) dapat dipakai untuk bukti serah terima yang ditandatangani dan dapat diverifikasi lintas aplikasi.

## Yang tidak direkomendasikan

- **Menulis ulang chain atau kontrak dengan Rust (Solana/Substrate).** Masalah MBG adalah pelacakan dan aturan 4 jam, dan sudah terselesaikan dengan Solidity di EVM.
- **Next.js.** Aplikasi statis tanpa server dan berada di balik login; React + Vite sudah cukup.
