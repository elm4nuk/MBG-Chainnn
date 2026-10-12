// Sesi aplikasi: koneksi ke smart contract (Web3.js lewat client/mbgchain.js), akun yang login, dan jam chain.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { MBGChainClient } from '@client';

const Ctx = createContext(null);
const KUNCI = 'mbgchain.akun';
const simpan = {
  baca() { try { return sessionStorage.getItem(KUNCI); } catch { return null; } },
  tulis(v) { try { if (v) sessionStorage.setItem(KUNCI, v); else sessionStorage.removeItem(KUNCI); } catch { /* mode privat */ } },
};

async function ambilJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} tidak ditemukan`);
  return r.json();
}

export function SesiProvider({ children }) {
  const [s, setS] = useState({ status: 'memuat' }); // memuat | siap | belumDeploy | putus
  const [profil, setProfil] = useState(null);
  const [detak, setDetak] = useState(0);
  const jamChain = useRef({ chain: Date.now() / 1000, at: Date.now() });

  const segarkanJam = useCallback(async (klien) => {
    const t = await klien.waktuChain();
    jamChain.current = { chain: t, at: Date.now() };
  }, []);

  const mulai = useCallback(async () => {
    setS({ status: 'memuat' });
    let kontrak;
    try { kontrak = await ambilJson('/kontrak.json'); } catch { setS({ status: 'belumDeploy' }); return; }
    const akunDemo = await ambilJson('/akun-demo.json').catch(() => null);
    const klien = MBGChainClient.hubungkan(`${window.location.origin}/rpc`, kontrak);
    try {
      await segarkanJam(klien);
      await klien.kontrak.methods.admin().call(); // memastikan kontrak ada di jaringan ini
    } catch (e) {
      setS({ status: 'putus', kontrak, pesan: e.message });
      return;
    }
    const tersimpan = simpan.baca();
    if (tersimpan) {
      try { setProfil(await klien.masuk(tersimpan)); } catch { simpan.tulis(null); }
    }
    setS({ status: 'siap', klien, kontrak, akunDemo });
  }, [segarkanJam]);

  useEffect(() => { mulai(); }, [mulai]);

  // detak 15 detik untuk hitung mundur; jam chain disinkronkan ulang tiap menit
  useEffect(() => {
    const t = setInterval(() => setDetak((d) => d + 1), 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (s.klien && detak % 4 === 0) segarkanJam(s.klien).catch(() => {});
  }, [detak, s.klien, segarkanJam]);

  const sekarang = useCallback(() => jamChain.current.chain + (Date.now() - jamChain.current.at) / 1000, []);

  const masuk = useCallback(async (akun) => {
    const p = await s.klien.masuk(akun);
    simpan.tulis(akun);
    setProfil(p);
    return p;
  }, [s.klien]);

  const keluar = useCallback(() => {
    simpan.tulis(null);
    if (s.klien) s.klien.akun = null;
    setProfil(null);
  }, [s.klien]);

  const value = useMemo(() => ({
    ...s, profil, masuk, keluar, sekarang, detak, coba: mulai,
    sinkron: () => (s.klien ? segarkanJam(s.klien) : Promise.resolve()),
  }), [s, profil, masuk, keluar, sekarang, detak, mulai, segarkanJam]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSesi = () => useContext(Ctx);

/** Memuat data async dengan status loading/error; muat ulang lewat reload(). */
export function useMuat(fn, deps = []) {
  const [st, setSt] = useState({ data: null, loading: true, error: null });
  const versi = useRef(0);
  const jalan = useCallback(async (diam = false) => {
    const v = ++versi.current;
    if (!diam) setSt((x) => ({ ...x, loading: true, error: null }));
    try {
      const data = await fn();
      if (v === versi.current) setSt({ data, loading: false, error: null });
    } catch (error) {
      if (v === versi.current) setSt((x) => ({ data: x.data, loading: false, error }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { jalan(); }, [jalan]);
  return { ...st, reload: jalan };
}

/**
 * Status satu transaksi, mengikuti state UI Session 10:
 * memeriksa → menunggu (Pending) → tercatat (Confirmed) | gagal (Rejected/Failed).
 */
export function useTx() {
  const [tx, setTx] = useState(null);
  const { sinkron } = useSesi();
  const jalankan = useCallback(async (aksi) => {
    const mulai = Date.now();
    setTx({ tahap: 'memeriksa', aksi });
    try {
      const bukti = await aksi((tahap, data) => {
        if (tahap === 'menunggu') setTx((t) => ({ ...t, tahap: 'menunggu', txHash: data.txHash, dikirim: Date.now() / 1000 }));
      });
      // tampilkan "menunggu konfirmasi" sebentar agar tidak berkedip di jaringan lokal yang sangat cepat
      await new Promise((r) => setTimeout(r, Math.max(0, 1100 - (Date.now() - mulai))));
      setTx((t) => ({ ...t, tahap: 'tercatat', bukti }));
      sinkron().catch(() => {});
      return bukti;
    } catch (error) {
      await new Promise((r) => setTimeout(r, 500));
      setTx((t) => ({ ...t, tahap: 'gagal', error }));
      sinkron().catch(() => {}); // jam chain ikut diperbarui, mis. setelah ditolak karena batas 4 jam
      return null;
    }
  }, [sinkron]);
  const ulangi = useCallback(() => (tx?.aksi ? jalankan(tx.aksi) : null), [tx, jalankan]);
  return { tx, jalankan, ulangi, tutup: () => setTx(null) };
}
