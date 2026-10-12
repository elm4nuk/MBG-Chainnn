// Skenario data demo (organisasi, petugas, 6 batch di berbagai tahap) yang dipakai bersama oleh
// scripts/seed.js (Node, chain lokal) dan mode demo browser di GitHub Pages (Ganache di browser).
// Skenario meniru prototype UI (Session 10): pada "sekarang", batch B-0001 sudah lewat batas 25 menit,
// B-0002 tersisa 45 menit, dan B-0003 tersisa 1 jam 35 menit.
// Hanya untuk jaringan lokal (Ganache/Hardhat) karena memakai evm_increaseTime untuk memajukan jam.

export const ORGANISASI = [
  ['dapur', 1, 'SPPG Cakung Barat'], ['mitra', 2, 'Mitra Logistik Cakung'], ['sdn03', 3, 'SDN Rawa Indah 03'],
  ['sdn05', 3, 'SDN Rawa Indah 05'], ['puskesmas', 4, 'Puskesmas Cakung'], ['dapurLain', 1, 'SPPG Pulo Gebang'],
];

/**
 * Isi kontrak yang baru di-deploy dengan data demo. Akun node (deterministik) dipakai sebagai petugas.
 * @returns {{ akunDemo: object, idBatch: number[] }}
 */
export async function isiDataDemo(web3, kontrak) {
  const [admin, dapur, budi, rudi, sinta, dimas, andi, yusuf] = await web3.eth.getAccounts();
  const rpc = (method, params = []) => web3.requestManager.send({ method, params });

  async function tx(dari, fungsi, ...args) {
    const metode = kontrak.methods[fungsi](...args);
    const gas = await metode.estimateGas({ from: dari });
    return metode.send({ from: dari, gas: String(Math.ceil(Number(gas) * 1.2)) });
  }

  let menitSekarang = 0;
  async function pada(menit) {           // majukan jam chain ke menit ke-n sejak awal skenario
    if (menit > menitSekarang) {
      await rpc('evm_increaseTime', [Math.round((menit - menitSekarang) * 60)]);
      await rpc('evm_mine');
    }
    menitSekarang = menit;
  }

  // 1. Organisasi (oleh admin BGN)
  const org = {};
  for (const [kunci, jenis, nama] of ORGANISASI) {
    const r = await tx(admin, 'daftarkanOrganisasi', jenis, nama);
    org[kunci] = Number(r.events.OrganisasiDidaftarkan.returnValues.id);
  }

  // 2. Petugas. ID petugas dipakai di layar Masuk (PIC-RI03-021 sama dengan prototype).
  const PETUGAS = [
    { id: 'SPPG-CB-007', akun: dapur, org: 'dapur', nama: 'Rina' },
    { id: 'KUR-MLC-012', akun: budi, org: 'mitra', nama: 'Budi' },
    { id: 'KUR-MLC-015', akun: rudi, org: 'mitra', nama: 'Rudi' },
    { id: 'PIC-RI03-021', akun: sinta, org: 'sdn03', nama: 'Sinta' },
    { id: 'PIC-RI05-004', akun: dimas, org: 'sdn05', nama: 'Dimas' },
    { id: 'PKM-CKG-002', akun: andi, org: 'puskesmas', nama: 'dr. Andi' },
    { id: 'SPPG-PG-003', akun: yusuf, org: 'dapurLain', nama: 'Yusuf' },
  ];
  for (const p of PETUGAS) await tx(admin, 'daftarkanPetugas', p.akun, org[p.org], p.nama);

  // 3. Batch. Menit relatif terhadap awal skenario (menit 0 ≈ 05.55, menit 300 ≈ 10.55 di prototype).
  async function daftar(sekolah, menu, porsi) {
    const r = await tx(dapur, 'daftarkanBatch', org[sekolah], menu, porsi);
    return Number(r.events.BatchDidaftarkan.returnValues.id);
  }
  const A = await daftar('sdn03', 'Nasi uduk, telur balado, tumis kangkung, jeruk', 120);
  const B = await daftar('sdn03', 'Nasi, ayam teriyaki, tumis buncis, pisang', 120);
  const C = await daftar('sdn03', 'Nasi, ikan kembung bumbu kuning, sayur sop, semangka', 96);
  const D = await daftar('sdn03', 'Nasi, semur daging, tumis wortel, pepaya', 120);
  const F = await daftar('sdn05', 'Nasi, ayam goreng, capcay, pisang', 90);

  await pada(5);   await tx(dapur, 'catatSelesaiMasak', F);
  await pada(30);  await tx(rudi, 'ambilBatch', F);
  await pada(35);  await tx(dapur, 'catatSelesaiMasak', A);       // 06.30
  await pada(70);  await tx(dimas, 'terimaBatch', F, 90);
  await pada(80);  await tx(rudi, 'ambilBatch', A);               // 07.15
  await pada(100); await tx(dimas, 'catatPenyajian', F, 88);
  await pada(105); await tx(dapur, 'catatSelesaiMasak', B);       // 07.40
  await pada(135); await tx(budi, 'ambilBatch', B);               // 08.10
  await pada(140); await tx(sinta, 'terimaBatch', A, 120);        // 08.20
  await pada(155); await tx(dapur, 'catatSelesaiMasak', C);       // 08.30
  await pada(185); await tx(budi, 'ambilBatch', C);               // 09.00
  await pada(190); await tx(sinta, 'terimaBatch', B, 120);        // 09.05
  await pada(225); await tx(sinta, 'terimaBatch', C, 96);         // 09.40
  await pada(265); await tx(dapur, 'catatSelesaiMasak', D);
  await pada(280); await tx(budi, 'ambilBatch', D);
  await pada(290); const E = await daftar('sdn03', 'Nasi, tahu bacem, sayur bayam, melon', 110);
  await pada(300);                                                 // "sekarang" ≈ 10.55

  // 4. Akun demo untuk layar Masuk di front-end.
  const namaOrg = Object.fromEntries(ORGANISASI.map(([k, , n]) => [k, n]));
  const akunDemo = {
    catatan: 'Akun demo jaringan lokal (Ganache, mnemonic deterministik). Jangan dipakai di jaringan publik.',
    admin: { id: 'ADM-BGN-001', akun: admin, nama: 'Admin BGN' },
    petugas: PETUGAS.map((p) => ({ id: p.id, akun: p.akun, nama: p.nama, organisasiId: org[p.org], organisasi: namaOrg[p.org] })),
  };
  return { akunDemo, idBatch: [A, B, C, D, E, F].sort((x, y) => x - y) };
}
