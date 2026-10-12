# MBG-Chain · Panduan Demo di macOS

Langkah menjalankan prototype MBG-Chain di Mac untuk demo. Setelah `npm install` selesai, semuanya jalan **offline**: blockchain lokal, tanpa server lain.

> **Gladi dulu H-1** di Mac yang dipakai demo: jalankan langkah 1–3 sekali sampai bisa login.

## 1. Persiapan (sekali saja, butuh internet)

Buka **Terminal**: ⌘ Space → ketik `Terminal` → Enter. Cek Node.js:

```bash
node -v
```

Butuh **v20.19 atau lebih baru** (yang sudah dites: v22). Kalau muncul `command not found` atau versinya lebih lama, unduh installer `node-v22.x.x.pkg` dari https://nodejs.org/dist/latest-v22.x/, jalankan, lalu tutup dan buka lagi Terminal.

Ekstrak zip project (klik dua kali) atau `git clone`, lalu:

```bash
cd ~/Downloads/mbg-chain    # sesuaikan; atau ketik "cd " lalu drag folder dari Finder ke Terminal
npm install
npm test                    # harus berakhir dengan: 25 passing
```

Kalau saat `npm install` muncul pop-up *command line developer tools*, pilih **Install** atau **Not Now**. Dua-duanya aman.

## 2. Jalankan (hari H, ±15 menit sebelum tampil)

Jam blockchain berjalan sungguhan. Setelah `seed`, B-0002 cuma punya **45 menit** sebelum kedaluwarsa, jadi jangan jalankan terlalu awal.

Cara paling ringkas, jalankan satu perintah dan biarkan terminal terbuka:

```bash
npm run demo:start
```

Launcher memeriksa port, menunggu chain siap, lalu menjalankan deploy, seed, dan aplikasi dalam urutan yang benar. Buka **http://localhost:5173** di Chrome. Tekan Control+C untuk menghentikan seluruh proses yang dibuat launcher.

Jika ingin menjalankan manual, gunakan dua terminal:

```bash
npm run chain               # Terminal 1; tunggu sampai tabel akun muncul
npm run deploy              # ✔ MBGChain ter-deploy di 0xe78A…a8Ab
npm run seed                # ✔ Data demo terisi: 6 organisasi, 7 petugas, 6 batch
npm run app                 # Terminal 2
```

## 3. Alur demo

Di halaman Masuk, buka **Akun demo**, klik akun, lalu **Masuk**. Kata sandi semua akun: `mbgchain`.

| ID petugas | Nama | Peran |
|---|---|---|
| PIC-RI03-021 | Sinta | PIC sekolah (alur utama) |
| SPPG-CB-007 | Rina | Petugas dapur SPPG |
| KUR-MLC-012 | Budi | Kurir |
| PKM-CKG-002 | dr. Andi | Petugas Puskesmas |
| ADM-BGN-001 | Admin BGN | Kelola organisasi & petugas |

Urutan yang disarankan, masuk sebagai **Sinta**:

1. **Beranda**: ada peringatan B-0001 (lewat batas) dan B-0002 (mendekati batas).
2. **B-0002** → Sajikan → isi porsi, mis. `118` (maks. 120) → Tinjau penyajian → Konfirmasi → tunggu *Penyajian tercatat* → **Lihat detail pencatatan** untuk hash transaksi dan nomor blok.
3. **B-0001**: tombol Sajikan nonaktif karena lewat 4 jam → **Tolak batch** → isi catatan → Tinjau penolakan → Konfirmasi tolak.
4. **Profil → Alat demo · jaringan lokal → +1 jam**: B-0003 pindah ke *Mendekati batas* tanpa menunggu.
5. **Keluar** → **Verifikasi batch tanpa login** → ketik `B-0002` → Buka: riwayat lengkap dan bukti transaksi, tanpa akun.
6. **Pantau batch (pengawas BGN / Dinkes)** di halaman Masuk: ringkasan semua batch.

Jangan jalankan `npm run demo` sebelum tampil karena perintah itu mengubah data seed yang sedang aktif. `npm run test:e2e` aman memakai chain pengujian terpisah di port 8546 dan memulihkan berkas deployment; jangan menjalankan `tools/e2e_playwright.py` secara manual terhadap chain demo jika ingin mempertahankan state presentasi.

## 4. Ulang dari awal

Di Terminal 1 tekan **Control + C** (bukan ⌘), lalu:

```bash
npm run chain                     # di Terminal 1
npm run deploy && npm run seed    # di tab baru (⌘ T), setelah tabel akun muncul
```

`npm run app` biarkan tetap jalan, cukup refresh browser.

## 5. Demo di HP (opsional)

Untuk input kode manual saja, ganti `npm run app` dengan `npm run app:host`, lalu buka alamat **Network** yang dicetak Vite (mis. `http://192.168.1.5:5173`) di HP yang tersambung ke Wi-Fi yang sama.

Untuk kamera QR, buat sertifikat lokal lalu gunakan launcher HTTPS:

```bash
npm run cert:dev
npm run demo:start:https
```

- Kalau macOS menanyakan *incoming network connections* untuk `node`, pilih **Allow**.
- Salin `.cert/mbg-chain-cert.pem` ke HP dan percayai sertifikat secara manual. Aplikasi tidak mengubah trust perangkat.
- Buka alamat Network `https://…:5173` yang dicetak launcher. Bila IP Mac berubah, buat ulang sertifikat.
- Kamera HP fisik harus diuji lagi pada perangkat dan Wi-Fi presentasi. Jika HTTPS belum dipercaya atau kamera ditolak, pakai kolom *Atau masukkan kode batch*.
- Wi-Fi kampus sering memblokir koneksi antarperangkat. Kalau HP tidak bisa membuka alamatnya, sambungkan Mac ke hotspot HP.

## 6. Kalau ada masalah

- **`EADDRINUSE … 127.0.0.1:8545`**: chain lama masih jalan. Temukan terminal yang menjalankannya dan tekan Control+C. Gunakan `lsof -nP -iTCP:8545 -sTCP:LISTEN` hanya untuk melihat proses; jangan menghentikan proses yang tidak dikenali.
- **Aplikasi menampilkan *Kontrak belum di-deploy***: jalankan `npm run deploy` dan `npm run seed` di tab lain, lalu refresh.
- **Aplikasi menampilkan *Tidak terhubung ke jaringan***: Terminal 1 tertutup atau berhenti. Ulangi langkah 4.
- **`Data demo sudah ada`** saat seed: data sudah terisi, lanjut saja.
- **B-0002 sudah *Kedaluwarsa* sebelum tampil**: seed terlalu awal. Ulangi langkah 4.
- **`bigint: Failed to load bindings, pure JS will be used`** atau **`DeprecationWarning … punycode`**: aman, abaikan.
- **Error aneh setelah menyalin folder dari laptop lain**: `rm -rf node_modules && npm install`.
