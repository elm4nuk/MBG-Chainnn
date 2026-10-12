# MBG-Chain

Prototype aplikasi blockchain untuk melacak batch **Makan Bergizi Gratis (MBG)** dari dapur SPPG sampai disajikan di sekolah. Smart contract menegakkan aturan BGN: makanan harus dikonsumsi paling lambat **4 jam** setelah selesai dimasak.

DTSC6018001 Prototyping Blockchain Project · Kelompok 1 (Aditya, Raditya, Firaz, Khaidzir, William)

## Arsitektur singkat

```
Aplikasi React (frontend/) ──► client/mbgchain.js (viem) ──► node EVM (Hardhat lokal / Sepolia) ──► contracts/MBGChain.sol
```

- **Tanpa server back-end terpisah.** Logika bisnis dan data pencatatan ada di smart contract; aplikasi membaca dan menulis langsung lewat viem.
- **Jaringan berizin.** Hanya petugas yang didaftarkan admin BGN yang bisa mencatat. Membaca data terbuka untuk siapa pun (verifikasi publik oleh orang tua/pengawas).
- **Penerima menandatangani serah terima.** Kurir mencatat saat mengambil batch, PIC sekolah mencatat saat menerima.
- **Aturan 4 jam memakai waktu blok**, bukan jam perangkat pengguna. Penyajian setelah batas ditolak kontrak.
- **Tanpa pop-up dompet.** Akun petugas dikelola jaringan (di prototype: akun node Hardhat lokal), sesuai desain UI Session 10.

## Struktur folder

| Path | Isi |
|---|---|
| `contracts/MBGChain.sol` | Smart contract (Solidity ^0.8.24) |
| `client/mbgchain.js` | Penghubung aplikasi ↔ kontrak (viem), dipakai React, script, dan test |
| `frontend/` | Aplikasi web React.js + Vite (workspace npm), desain dari UI design Session 10 |
| `scripts/compile.js` · `deploy.js` | Kompilasi dengan solc-js dan deploy dengan viem |
| `scripts/chain.js` · `seed.js` · `demo.js` | Blockchain lokal Hardhat (`hardhat.config.js`), data demo, demo alur kritis tanpa UI |
| `scripts/start-demo.js` | Launcher lokal: cek port → tunggu RPC → deploy → seed → Vite |
| `scripts/uji-e2e.js` · `proses.js` | Runner browser dengan chain uji terpisah dan pengelolaan proses lokal |
| `test/MBGChain.test.js` | 25 unit test (Mocha) + tabel pemakaian gas |
| `tools/e2e_playwright.py` | Uji end-to-end aplikasi di browser (opsional, Python + Playwright) |
| `tools/responsif_playwright.py` | Pemeriksaan tata letak 375 / 768 / 1024 / 1440 px untuk semua peran |

## Menjalankan

Prasyarat: Node.js 22.13 atau lebih baru (Hardhat 3 membutuhkannya; Node 20 sudah end-of-life sejak April 2026).

Untuk presentasi di Mac, ikuti langkah lengkap di [DEMO-MAC.md](DEMO-MAC.md) (persiapan, alur demo, dan solusi masalah).

```bash
npm install          # sekali: kontrak, klien, dan aplikasi React
npm test             # compile + 25 unit test + tabel gas

npm run demo:start   # cara termudah: chain, deploy, seed, dan app dalam satu terminal
```

Launcher menunggu RPC siap (maksimal 20 detik) sebelum deploy dan seed, lalu membuka Vite di `http://localhost:5173`. Jika port RPC atau aplikasi sedang dipakai, launcher berhenti dengan penjelasan dan **tidak membunuh proses tersebut**. Tekan `Ctrl+C` untuk membersihkan hanya chain dan Vite yang dibuat launcher. Karena chain lokal (Hardhat) berjalan di memori, data demo dari launcher hilang saat launcher dihentikan.

Perintah lama tetap tersedia bila ingin menjalankan setiap tahap secara manual:

```bash
npm run chain        # terminal 1: blockchain lokal, biarkan tetap berjalan
npm run deploy       # terminal 2: compile + deploy dengan viem
npm run seed         # isi data demo (6 organisasi, 7 petugas, 6 batch)
npm run app          # buka http://localhost:5173
```

- Masuk memakai salah satu **akun demo** di bawah, kata sandi `mbgchain`. Verifikasi batch dan halaman pantau pengawas bisa dibuka tanpa login.
- `npm run app:host` membuka aplikasi HTTP untuk HP di Wi-Fi yang sama. Input kode batch manual tetap tersedia.
- **Alat demo presentasi:** menu Profil → *Alat demo · jaringan lokal* memajukan jam blockchain 15 menit / 1 jam, supaya batch terlihat berpindah ke Mendekati batas dan Kedaluwarsa tanpa menunggu.
- Untuk mengulang dari awal: hentikan `npm run chain` (Ctrl+C), lalu jalankan lagi `chain → deploy → seed`. Alamat kontrak lokal selalu `0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab`.
- `npm run demo` menjalankan alur kritis PIC sekolah lewat klien viem tanpa UI (mengubah data seed).
- Memakai node EVM lain (mis. Ganache GUI di port 7545 atau Anvil)? Isi `RPC_URL=...` di file `.env` sebelum `npm run deploy` dan `npm run app`.

Jika `npm run chain` melaporkan **port 8545 sudah dipakai**, biasanya chain dari percobaan sebelumnya masih berjalan. Kembali ke terminal chain tersebut lalu tekan Ctrl+C. Untuk melihat proses yang memakai port, jalankan `lsof -nP -iTCP:8545 -sTCP:LISTEN`.

### HTTPS lokal untuk kamera HP (opsional)

Kamera browser di HP memerlukan secure context. Opsi ini memakai OpenSSL yang sudah tersedia di macOS dan tidak menambah dependency Vite, memasang CA, atau mengubah trust store otomatis:

```bash
npm run cert:dev          # sekali; sertifikat 30 hari untuk localhost + IP LAN saat ini
npm run demo:start:https  # launcher lengkap, alamatnya memakai https://
```

Jika chain/deploy/seed sudah berjalan, gunakan `npm run app:https`. Sertifikat tersimpan di `.cert/` dan diabaikan Git. Sebelum memindai QR, salin sertifikat `.cert/mbg-chain-cert.pem` ke HP dan percayai secara **manual**, lalu buka alamat Network HTTPS yang dicetak. Buat ulang sertifikat bila alamat IP Mac berubah. Jangan lanjutkan melalui peringatan sertifikat lalu menganggap kamera pasti berfungsi: browser HP harus benar-benar mempercayai sertifikat tersebut. Opsi ini diverifikasi secara lokal di browser desktop; akses kamera pada HP fisik tetap perlu diuji pada perangkat dan Wi-Fi presentasi.

`vite-plugin-mkcert` tidak dipasang: versi terkini saat pemeriksaan membutuhkan Node ≥22.19 (proyek mensyaratkan ≥22.13) dan plugin tersebut dapat mengelola root CA. Konfigurasi berkas sertifikat menjaga persyaratan versi dan perubahan trust tetap eksplisit.

## Tampilan responsif

Satu aplikasi dan satu sumber data (smart contract) untuk semua ukuran layar; hanya komposisinya yang berubah.

| Lebar layar | Navigasi | Komposisi |
|---|---|---|
| HP, di bawah 768 px | Menu bawah (bottom navigation) | Satu kolom, kartu batch, tombol aksi besar menempel di bawah, detail sebagai halaman penuh |
| Tablet, 768–1023 px | Rail ringkas di kiri | Statistik dan daftar melebar; formulir transaksi tampil sebagai dialog di tengah |
| Desktop, 1024 px ke atas | Sidebar permanen + identitas akun + status jaringan | Daftar batch sebagai baris terstruktur, detail batch dua kolom (status & data | riwayat & bukti transaksi), tombol aksi di kanan header |

- Halaman **Masuk** berupa hero alur batch (SPPG → Kurir → Sekolah → Disajikan) dan kartu masuk; di HP hero dipadatkan agar formulir langsung terlihat.
- **Bukti transaksi** menampilkan event, waktu, pelaku (akun penanda tangan transaksi), nomor blok, dan hash. Di halaman petugas bagian ini dilipat agar layar fokus pada tindakan.
- Animasi hanya CSS (muncul ±220 ms, drawer, sheet, umpan balik transaksi) dan dimatikan otomatis bila sistem meminta *reduce motion*.

## Demo online (GitHub Pages)

https://elm4nuk.github.io/MBG-Chainnn/ menjalankan aplikasi yang sama tanpa server: blockchain Ganache versi browser berjalan **di browser pengunjung** (Hardhat dan Anvil tidak bisa berjalan di browser) (`frontend/src/lib/chainBrowser.js`). Saat halaman dibuka, kontrak MBGChain di-deploy dengan Web3.js lalu diisi data demo yang sama dengan `npm run seed` (`client/skenario-demo.js`), butuh beberapa detik.

- Data hanya ada di tab tersebut dan kembali ke awal saat halaman dimuat ulang; setiap pengunjung punya chain sendiri.
- Prototype klik Session 10 (bingkai iPhone) tetap ada di https://elm4nuk.github.io/MBG-Chainnn/prototype/.
- Deploy otomatis oleh GitHub Actions (`.github/workflows/ci.yml`) setiap push ke `main` yang lulus test dan E2E. Build lokal: `npm run pages:build` → `frontend/dist-pages/`; prototype disalin dari `docs/prototype/`.
- Uji asap: `python tools/pages_smoke.py https://elm4nuk.github.io/MBG-Chainnn/` (login, sajikan, tolak, verifikasi, pantau, HP & desktop).
- Untuk presentasi tetap disarankan `npm run demo:start` di laptop, karena tidak bergantung pada unduhan ±9 MB.

## Akun demo (jaringan lokal)

| ID petugas | Nama | Organisasi | Peran di aplikasi |
|---|---|---|---|
| ADM-BGN-001 | Admin BGN | Badan Gizi Nasional | Kelola organisasi & petugas |
| SPPG-CB-007 | Rina | SPPG Cakung Barat | Petugas dapur |
| KUR-MLC-012 | Budi | Mitra Logistik Cakung | Kurir |
| KUR-MLC-015 | Rudi | Mitra Logistik Cakung | Kurir |
| PIC-RI03-021 | Sinta | SDN Rawa Indah 03 | PIC sekolah (alur kritis) |
| PIC-RI05-004 | Dimas | SDN Rawa Indah 05 | PIC sekolah |
| PKM-CKG-002 | dr. Andi | Puskesmas Cakung | Petugas Puskesmas |
| SPPG-PG-003 | Yusuf | SPPG Pulo Gebang | Petugas dapur |

Data demo meniru skenario prototype Session 10: setelah `npm run seed`, B-0001 sudah lewat batas 25 menit, B-0002 tersisa 45 menit, B-0003 tersisa 1 jam 35 menit, dan B-0004 sedang diantar kurir.

## Fungsi smart contract

| Fungsi | Dipanggil oleh | Use case |
|---|---|---|
| `daftarkanOrganisasi`, `daftarkanPetugas`, `nonaktifkanPetugas` | Admin BGN | Kelola peserta jaringan |
| `daftarkanBatch` | Petugas dapur SPPG | UC-01 |
| `catatSelesaiMasak` | Petugas dapur SPPG | UC-02 (hitungan 4 jam dimulai) |
| `ambilBatch` | Kurir | UC-03 |
| `terimaBatch` | PIC sekolah tujuan | UC-04 |
| `cekKelayakan` (baca) | Siapa pun | UC-05, UC-09, UC-11 |
| `catatPenyajian` | PIC sekolah tujuan | UC-06 |
| `tolakBatch` | PIC sekolah tujuan | UC-07 |
| `laporkanInsiden` | PIC sekolah tujuan / Puskesmas | UC-08 |
| `lihatBatch`, `profilPetugas` (baca) | Siapa pun | UC-10, UC-12 |

## Pengujian

- `npm test`: 25 unit test untuk kontrak dan klien viem di Hardhat Network in-process (hardfork shanghai, angka gas sama dengan laporan), termasuk aturan 4 jam dengan memajukan jam blockchain.
- `npm run test:e2e` (opsional): menyalakan chain uji terpisah di port 8546, deploy + seed, build + preview, lalu menjalankan 30 langkah Playwright untuk semua peran. Runner memulihkan berkas deployment demo dan menghentikan hanya proses uji miliknya. Termasuk pemeriksaan navigasi Admin, panel bukti transaksi, fokus dialog, dan dashboard mobile tanpa overflow horizontal. Setelah itu `tools/responsif_playwright.py` membuka 19 halaman semua peran di lebar 375, 768, 1024, dan 1440 px (76 pemeriksaan: tanpa scroll horizontal, satu navigasi terlihat, tanpa error console) dan menyimpan screenshot di `tools/shots/responsif/`. Port bisa diganti dengan `E2E_CHAIN_PORT` / `E2E_APP_PORT`, interpreter Python dengan `PYTHON=`. Prasyarat: `pip install playwright && playwright install chromium`.

## Deploy ke testnet Sepolia (opsional)

1. Salin `.env.example` menjadi `.env`, isi `RPC_URL` (endpoint Sepolia) dan `PRIVATE_KEY` akun uji yang punya Sepolia ETH.
2. Jalankan `npm run deploy`. Hasilnya tersimpan di `deployments/sepolia.json`.

`seed.js` dan aplikasi demo dirancang untuk jaringan lokal: akun petugas di chain lokal dikelola node, sedangkan di testnet setiap petugas perlu penandatangan sendiri.

## CI (GitHub Actions)

Setiap push dan pull request: unit test di Node 20 dan 22, build biasa dan build Pages, E2E + pemeriksaan responsif dengan Playwright, serta Slither (scan keamanan kontrak, saat ini laporan saja). Push ke `main` yang lulus test dan E2E otomatis men-deploy GitHub Pages.

## Keterbatasan dan pengembangan berikutnya

Ringkasan untuk paper ada di [docs/FUTURE-WORK.md](docs/FUTURE-WORK.md): Ganache dan Web3.js sudah tidak dikembangkan (sudah dimigrasikan ke viem dan Hardhat; Ganache hanya tersisa untuk demo di browser), penanda tangan per petugas, AccessControl + Safe untuk admin, data pribadi on-chain, indexer, dan pilihan jaringan (Sepolia untuk uji publik, Hyperledger Besu untuk produksi).

## Catatan keamanan

- Akun chain lokal memakai mnemonic publik dan tidak dikunci; kata sandi akun demo hanya diperiksa di aplikasi. Hanya untuk jaringan lokal.
- Jangan pernah commit file `.env` atau private key.
