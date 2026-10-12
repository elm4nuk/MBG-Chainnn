// Layar hasil pencatatan: Pending → Confirmed / Failed / Rejected (state UI Session 10).
import { useState } from 'react';
import { AppBar, Ikon, useToast } from './ui.jsx';
import { useSesi } from '../lib/sesi.jsx';
import { angkaID, jam, jamDetik, pendek } from '../lib/format.js';

export default function TxLayar({ tx, teks, onSelesai, labelSelesai = 'Kembali ke Beranda', onKembali, onUlang, aksiDitolak }) {
  const { kontrak } = useSesi();
  const [buka, setBuka] = useState(false);
  const [toast, tampil] = useToast();

  if (tx.tahap === 'memeriksa' || tx.tahap === 'menunggu') {
    const kirim = tx.tahap === 'menunggu';
    return (
      <>
        <AppBar judul="Hasil pencatatan" />
        <div className="status-wrap" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <h2>{teks.menunggu}</h2>
          <p>Biasanya hanya beberapa detik. Jangan tutup aplikasi.</p>
          <ol className="steps">
            <li className={kirim ? 'done' : 'now'}><span className="ic">{kirim && <Ikon n="check" />}</span><span>{kirim ? `Dikirim · ${jam(tx.dikirim)}` : 'Memeriksa aturan smart contract'}</span></li>
            <li className={kirim ? 'now' : 'todo'}><span className="ic" /><span>Menunggu konfirmasi jaringan</span></li>
            <li className="todo"><span className="ic" /><span>Tercatat permanen</span></li>
          </ol>
        </div>
      </>
    );
  }

  if (tx.tahap === 'tercatat') {
    const b = tx.bukti;
    const salin = async () => {
      try { await navigator.clipboard.writeText(b.txHash); tampil('ID transaksi disalin.'); } catch { tampil(`Salin manual: ${b.txHash}`); }
    };
    return (
      <>
        <AppBar judul="Hasil pencatatan" />
        <div className="status-wrap" role="status">
          <div className="badge-big ok"><Ikon n="check" /></div>
          <h2>{teks.tercatat}</h2>
          <p>{typeof teks.pesan === 'function' ? teks.pesan(b) : teks.pesan}</p>
          <div className="card tx">
            <button type="button" className="tx-toggle" aria-expanded={buka} onClick={() => setBuka(!buka)}>Lihat detail pencatatan<Ikon n="chev" /></button>
            {buka && (
              <dl className="kv">
                <dt>ID transaksi</dt><dd className="mono">{pendek(b.txHash, 10, 6)} <button type="button" className="mini" onClick={salin}><Ikon n="copy" />Salin</button></dd>
                <dt>Blok</dt><dd>#{angkaID(b.blok)}</dd>
                <dt>Waktu tercatat</dt><dd>{jamDetik(b.waktu)}</dd>
                <dt>Gas</dt><dd>{angkaID(b.gas)}</dd>
                <dt>Jaringan</dt><dd>MBG-Chain {kontrak?.jaringan} · chainId {kontrak?.chainId}</dd>
              </dl>
            )}
          </div>
        </div>
        <div className="actions"><button type="button" className="btn primary block" onClick={onSelesai}>{labelSelesai}</button></div>
        {toast}
      </>
    );
  }

  const e = tx.error || {};
  if (e.jenis === 'jaringan') {
    return (
      <>
        <AppBar judul="Hasil pencatatan" />
        <div className="status-wrap" role="alert">
          <div className="badge-big bad"><Ikon n="x" /></div>
          <h2>Pencatatan gagal</h2>
          <p>Koneksi ke jaringan MBG-Chain terputus sebelum data tercatat. Tidak ada perubahan yang tersimpan.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onKembali}>Kembali</button>
          <button type="button" className="btn primary" onClick={onUlang}>Coba lagi</button>
        </div>
      </>
    );
  }
  const batas = e.kode === 'BatasWaktuTerlewati' && e.detail ? Number(e.detail.batasKonsumsi ?? e.detail[0]) : 0;
  return (
    <>
      <AppBar judul="Hasil pencatatan" />
      <div className="status-wrap" role="alert">
        <div className="badge-big bad"><Ikon n="x" /></div>
        <h2>{teks.ditolak || 'Ditolak sistem'}</h2>
        <p>{batas ? `Batas konsumsi (${jam(batas)}) sudah terlewati. Batch ini tidak boleh disajikan.` : e.message}</p>
        {e.kode && <p className="muted" style={{ fontSize: 12.5 }}>Kode dari smart contract: <span className="mono">{e.kode}</span></p>}
      </div>
      <div className="actions">
        {aksiDitolak && e.kode === aksiDitolak.kode
          ? <button type="button" className="btn primary block" onClick={aksiDitolak.onClick}>{aksiDitolak.label}</button>
          : <button type="button" className="btn primary block" onClick={onKembali}>Kembali</button>}
      </div>
    </>
  );
}
