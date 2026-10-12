// Bukti transaksi satu batch dari event smart contract (UC-10): dipakai verifikasi publik dan panel detail dashboard.
import { jamDetik, pendek } from '../lib/format.js';
import { Ikon } from './ui.jsx';

export const NAMA_EVENT = {
  BatchDidaftarkan: 'Didaftarkan dapur',
  BatchSelesaiMasak: 'Selesai masak',
  BatchDiambil: 'Diambil kurir',
  BatchDiterima: 'Diterima sekolah',
  BatchDisajikan: 'Disajikan',
  BatchDitolak: 'Ditolak',
  InsidenDilaporkan: 'Laporan insiden',
};

export function BuktiBlockchain({ jejak }) {
  return (
    <section className="card">
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
              <span>Blok #{e.blok} · tx <span className="mono" title={e.txHash}>{pendek(e.txHash, 10, 6)}</span></span>
              {e.event === 'BatchDitolak' && e.data.catatan && <span>Catatan: {e.data.catatan}</span>}
              {e.event === 'InsidenDilaporkan' && <span>{e.data.keterangan}</span>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
