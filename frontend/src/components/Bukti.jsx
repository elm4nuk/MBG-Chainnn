// Bukti transaksi satu batch dari event smart contract (UC-10): dipakai verifikasi publik, panel detail
// dashboard, dan halaman detail tiap peran. Pelaku = akun yang menandatangani transaksi (dibaca dari blok).
import { useState } from 'react';
import { useMuat, useSesi } from '../lib/sesi.jsx';
import { jamDetik, pendek } from '../lib/format.js';
import { Ikon, Pesan, Skeleton, useToast } from './ui.jsx';

export const NAMA_EVENT = {
  BatchDidaftarkan: 'Didaftarkan dapur',
  BatchSelesaiMasak: 'Selesai masak',
  BatchDiambil: 'Diambil kurir',
  BatchDiterima: 'Diterima sekolah',
  BatchDisajikan: 'Disajikan',
  BatchDitolak: 'Ditolak',
  InsidenDilaporkan: 'Laporan insiden',
};

/** Jejak audit + nama penanda tangan tiap transaksi. */
export function useJejak(kode) {
  const { klien } = useSesi();
  return useMuat(async () => {
    const jejak = await klien.jejakAudit(kode);
    const profil = new Map();
    return Promise.all(jejak.map(async (e) => {
      const tx = await klien.web3.eth.getTransaction(e.txHash);
      const dari = tx?.from;
      if (dari && !profil.has(dari)) profil.set(dari, klien.profil(dari).catch(() => null));
      const p = dari ? await profil.get(dari) : null;
      return { ...e, dari, pelaku: p?.nama || '', organisasi: p?.organisasi || '' };
    }));
  }, [kode]);
}

export function BuktiBlockchain({ jejak }) {
  const [toast, tampil] = useToast();
  const salin = async (hash) => {
    try { await navigator.clipboard.writeText(hash); tampil('Hash transaksi disalin.'); } catch { tampil(`Salin manual: ${hash}`); }
  };
  return (
    <section className="card bukti">
      <h3>Bukti di blockchain</h3>
      <p className="help">Setiap tahap adalah transaksi yang ditandatangani petugasnya dan tidak dapat diubah.</p>
      <ol className="tl">
        {jejak.map((e) => (
          <li key={`${e.txHash}-${e.event}`}>
            <span className={`ic${e.event === 'BatchDitolak' || e.event === 'InsidenDilaporkan' ? ' bad' : ''}`}>
              <Ikon n={e.event === 'InsidenDilaporkan' ? 'flag' : e.event === 'BatchDitolak' ? 'x' : 'check'} />
            </span>
            <div>
              <b>{NAMA_EVENT[e.event] || e.event} · {jamDetik(e.waktu)}</b>
              {e.pelaku && <span>Oleh {e.pelaku}{e.organisasi ? ` · ${e.organisasi}` : ''}</span>}
              {e.event === 'BatchDitolak' && e.data.catatan && <span>Catatan: {e.data.catatan}</span>}
              {e.event === 'InsidenDilaporkan' && <span>{e.data.keterangan}</span>}
              <span className="bukti-tx">
                <span className="angka">Blok #{e.blok}</span>
                <span>tx <span className="mono" title={e.txHash}>{pendek(e.txHash, 10, 6)}</span></span>
                <button type="button" className="salin" aria-label={`Salin hash transaksi ${NAMA_EVENT[e.event] || e.event}`} onClick={() => salin(e.txHash)}><Ikon n="copy" /></button>
              </span>
            </div>
          </li>
        ))}
      </ol>
      {toast}
    </section>
  );
}

function IsiBukti({ kode }) {
  const { data, loading, error, reload } = useJejak(kode);
  if (loading && !data) return <Skeleton n={1} teks="Membaca bukti transaksi dari blockchain…" />;
  if (error) return <Pesan>{error.message} <button type="button" className="inline-action" onClick={() => reload()}>Coba lagi</button></Pesan>;
  return <BuktiBlockchain jejak={data} />;
}

/** Bukti transaksi yang baru dimuat saat dibuka, agar layar petugas lapangan tetap fokus pada tindakan. */
export function BuktiBatch({ kode }) {
  const [buka, setBuka] = useState(false);
  return (
    <section className="card bukti-lipat">
      <button type="button" className="tx-toggle" aria-expanded={buka} onClick={() => setBuka(!buka)}>
        <span><Ikon n="shield" />Bukti transaksi blockchain</span><Ikon n="chev" />
      </button>
      {buka && <IsiBukti kode={kode} />}
    </section>
  );
}
