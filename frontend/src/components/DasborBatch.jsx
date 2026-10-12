// Dashboard batch untuk pengawas BGN / Dinkes dan Admin BGN (UC-09, UC-11): ringkasan, tabel dengan cari,
// saring, dan urut, serta panel detail pencatatan berisi riwayat dan bukti transaksi. Semua data dibaca
// langsung dari smart contract (lihatBatch, cekKelayakan, event), tanpa data contoh.
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMuat, useSesi } from '../lib/sesi.jsx';
import { angkaID, durasi, jam, tanggal } from '../lib/format.js';
import { ChipBatch, Hero, Ikon, InfoBatch, Kosong, Overlay, Pesan, Riwayat, Skeleton, Statistik, useKelayakan } from './ui.jsx';
import { BuktiBlockchain, useJejak } from './Bukti.jsx';

const FILTER = [
  { kode: 'risiko', teks: 'Berisiko' },
  { kode: 'jalan', teks: 'Berjalan' },
  { kode: 'selesai', teks: 'Selesai' },
  { kode: 'semua', teks: 'Semua' },
];

// Urutan "waktu": batch yang paling mendesak dulu, batch yang sudah selesai paling akhir.
const URUT = {
  waktu: (p, q) => (p.b.status >= 4) - (q.b.status >= 4) || (p.k.batas || 9e12) - (q.k.batas || 9e12) || p.b.id - q.b.id,
  kode: (p, q) => p.b.id - q.b.id,
  porsi: (p, q) => porsiTampil(p.b) - porsiTampil(q.b) || p.b.id - q.b.id,
};
const porsiTampil = (b) => b.porsiSelesai || b.porsiDiterima || b.porsi;

function keterangan({ b, k }) {
  if (b.status >= 4) return b.status === 4 ? `${b.porsiSelesai} porsi disajikan ${jam(b.riwayat.at(-1)?.waktu)}` : `Ditolak ${jam(b.riwayat.at(-1)?.waktu)} · ${b.alasanTolak}`;
  if (!b.waktuMasak) return 'Belum dimasak';
  return k.kode === 3 ? `Lewat ${durasi(k.lewat)}` : `Sisa ${durasi(k.sisa)} · batas ${jam(k.batas)}`;
}

function KepalaUrut({ kolom, urut, setUrut, children }) {
  const aktif = urut.kolom === kolom;
  const arah = aktif ? urut.arah : null;
  const ganti = () => setUrut(aktif ? { kolom, arah: arah === 'naik' ? 'turun' : 'naik' } : { kolom, arah: 'naik' });
  return (
    <th aria-sort={aktif ? (arah === 'naik' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-urut" onClick={ganti}>
        {children}
        <span className="urut-ikon" aria-hidden="true">{aktif ? (arah === 'naik' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );
}

function PanelDetail({ b, onTutup }) {
  const nilaiK = useKelayakan();
  const k = nilaiK(b);
  const { data: jejak, loading, error, reload } = useJejak(b.kode);
  return (
    <Overlay jenis="laci" onTutup={onTutup} label={`Detail pencatatan batch ${b.kode}`}>
      <div className="laci-head">
        <div className="grow">
          <div className="eyebrow">Detail pencatatan</div>
          <h2>Batch {b.kode}</h2>
        </div>
        {/* fokus awal diberikan Overlay dengan preventScroll, agar halaman tidak bergeser saat panel masuk */}
        <button type="button" className="icon-btn" aria-label="Tutup detail" onClick={onTutup} data-autofocus><Ikon n="x" /></button>
      </div>
      <div className="laci-isi">
        <Hero b={b} k={k} />
        {b.jumlahInsiden > 0 && <Pesan jenis="warn" ikon="flag">{b.jumlahInsiden} laporan insiden tercatat untuk batch ini.</Pesan>}
        <InfoBatch b={b} />
        <Riwayat b={b} />
        {loading && !jejak && <Skeleton n={1} teks="Membaca bukti transaksi dari blockchain…" />}
        {error && <Pesan>{error.message} <button type="button" className="inline-action" onClick={() => reload()}>Coba lagi</button></Pesan>}
        {jejak && <BuktiBlockchain jejak={jejak} />}
        <Link to={`/verifikasi/${b.kode}`} className="btn secondary block"><Ikon n="link" />Buka halaman verifikasi publik</Link>
      </div>
    </Overlay>
  );
}

export default function DasborBatch() {
  const { klien, sekarang, detak } = useSesi();
  const nilaiK = useKelayakan();
  const { data, loading, error, reload } = useMuat(() => klien.semuaBatch(), []);
  useEffect(() => { if (detak && detak % 2 === 0) reload(true); }, [detak]); // segarkan tiap 30 detik
  const [pilihFilter, setFilter] = useState(null); // null = otomatis: Berisiko bila ada, selain itu Semua
  const [cari, setCari] = useState('');
  const [urut, setUrut] = useState({ kolom: 'waktu', arah: 'naik' });
  const [pilih, setPilih] = useState(null); // id batch yang detailnya dibuka
  const pemicu = useRef(null);
  const cariTunda = useDeferredValue(cari.trim().toLocaleLowerCase('id-ID'));

  const now = sekarang();
  const semua = (data || []).map((b) => ({ b, k: nilaiK(b) }));
  const jalan = semua.filter((x) => x.b.status >= 1 && x.b.status <= 3);
  const berisiko = jalan.filter((x) => x.k.kode >= 2);
  const lewat = jalan.filter((x) => x.k.kode === 3);
  const selesai = semua.filter((x) => x.b.status >= 4);
  const disajikan = selesai.filter((x) => x.b.status === 4);
  const ditolak = selesai.filter((x) => x.b.status === 5);
  const insiden = semua.reduce((n, x) => n + x.b.jumlahInsiden, 0);
  const porsiSaji = disajikan.reduce((n, x) => n + x.b.porsiSelesai, 0);
  const kelompok = { risiko: berisiko, jalan, selesai, semua };
  const filter = pilihFilter || (berisiko.length || !data ? 'risiko' : 'semua');
  const tampil = kelompok[filter]
    .filter(({ b }) => !cariTunda || `${b.kode} ${b.sekolah} ${b.dapur} ${b.menu}`.toLocaleLowerCase('id-ID').includes(cariTunda))
    .sort((p, q) => URUT[urut.kolom](p, q) * (urut.arah === 'naik' ? 1 : -1));
  const dipilih = pilih && semua.find((x) => x.b.id === pilih)?.b;

  const buka = (e, b) => { pemicu.current = e.currentTarget; setPilih(b.id); };
  const tutup = () => { setPilih(null); setTimeout(() => pemicu.current?.focus(), 0); };
  const hapusSaring = () => { setCari(''); setFilter('semua'); };
  const gantiUrutMobile = (e) => {
    const [kolom, arah] = e.target.value.split('-');
    setUrut({ kolom, arah });
  };

  return (
    <>
      <section className="dashboard-intro monitor-intro" aria-labelledby="judul-pantau">
        <div><span className="section-kicker">Pemantauan operasional</span><h2 id="judul-pantau">Status distribusi batch</h2></div>
        <p>Prioritaskan batch yang mendekati atau melewati batas konsumsi empat jam. Klik kode batch untuk melihat riwayat dan bukti transaksinya.</p>
        <div className="date">
          <Ikon n="clock" />{tanggal(now)} · pukul {jam(now)} (jam blockchain)
          <span>Diperbarui otomatis tiap 30 detik</span>
          <button type="button" className="btn secondary sm" onClick={() => reload()} disabled={loading}><Ikon n="refresh" />{loading ? 'Memuat…' : 'Muat ulang'}</button>
        </div>
      </section>

      {data && (
        <div className="monitor-stats-wrap">
          <Statistik label="Ringkasan batch" items={[
            { label: 'Batch berjalan', nilai: jalan.length, nada: 'pend', ket: 'Dalam alur distribusi' },
            { label: 'Mendekati batas', nilai: berisiko.length - lewat.length, nada: 'warn', ket: 'Sisa ≤ 60 menit' },
            { label: 'Lewat batas', nilai: lewat.length, nada: 'bad', ket: 'Belum ditolak sekolah' },
            { label: 'Disajikan', nilai: disajikan.length, nada: 'ok', ket: `${angkaID(porsiSaji)} porsi tercatat` },
            { label: 'Ditolak sekolah', nilai: ditolak.length, ket: 'Tidak dibagikan' },
            { label: 'Laporan insiden', nilai: insiden, nada: insiden ? 'warn' : '', ket: 'Seluruh batch' },
          ]} />
        </div>
      )}
      {lewat.length > 0 && (
        <Pesan>{lewat.length} batch sudah lewat batas 4 jam tetapi belum ditolak sekolah. Hubungi sekolah tujuan agar batch tidak disajikan.</Pesan>
      )}

      <section className="panel data-panel monitor-panel" aria-labelledby="daftar-batch">
        <div className="panel-head">
          <div><h2 id="daftar-batch">Daftar batch</h2><p>Status, jumlah porsi, dan waktu dibaca dari smart contract.</p></div>
          <span className="record-count" aria-live="polite">{tampil.length} dari {semua.length} batch</span>
        </div>
        <div className="monitor-toolbar">
          <label className="search-field"><span className="sr-only">Cari batch</span><Ikon n="search" /><input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kode, sekolah, dapur, atau menu…" /></label>
          <div className="seg" role="group" aria-label="Saring batch">
            {FILTER.map((f) => (
              <button key={f.kode} type="button" aria-pressed={filter === f.kode} onClick={() => setFilter(f.kode)}>
                {f.teks} <span>{kelompok[f.kode].length}</span>
              </button>
            ))}
          </div>
          <label className="compact-field mobile-sort"><span>Urutkan</span><select value={`${urut.kolom}-${urut.arah}`} onChange={gantiUrutMobile}>
            <option value="waktu-naik">Paling mendesak</option><option value="waktu-turun">Paling akhir</option>
            <option value="kode-naik">Kode terkecil</option><option value="kode-turun">Kode terbesar</option>
            <option value="porsi-naik">Porsi terkecil</option><option value="porsi-turun">Porsi terbesar</option>
          </select></label>
        </div>
        {loading && !data && <div className="panel-pad"><Skeleton n={3} teks="Membaca semua batch dari blockchain…" /></div>}
        {error && <div className="panel-pad"><Pesan>{error.message} <button type="button" className="inline-action" onClick={() => reload()}>Coba lagi</button></Pesan></div>}
        {data && (tampil.length ? (
          <div className="tabel-wrap">
            <table className="tabel responsive monitor-table">
              <caption className="sr-only">Daftar status batch MBG dari blockchain. Kolom bertombol dapat diurutkan.</caption>
              <thead>
                <tr>
                  <KepalaUrut kolom="kode" urut={urut} setUrut={setUrut}>Batch</KepalaUrut>
                  <th>Sekolah & dapur</th>
                  <th>Status</th>
                  <KepalaUrut kolom="porsi" urut={urut} setUrut={setUrut}>Porsi</KepalaUrut>
                  <KepalaUrut kolom="waktu" urut={urut} setUrut={setUrut}>Waktu</KepalaUrut>
                  <th>Insiden</th>
                  <th><span className="sr-only">Tindakan</span></th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((x) => (
                  <tr key={x.b.id} aria-selected={pilih === x.b.id || undefined}>
                    <td data-label="Batch">
                      <span className="mobile-cell-label">Batch</span>
                      <button type="button" className="link-btn" aria-haspopup="dialog" onClick={(e) => buka(e, x.b)}><b>{x.b.kode}</b></button>
                      <span className="cell-sub">{x.b.menu}</span>
                    </td>
                    <td data-label="Sekolah & dapur"><span className="mobile-cell-label">Sekolah & dapur</span><b>{x.b.sekolah}</b><span className="cell-sub">{x.b.dapur}</span></td>
                    <td data-label="Status"><span className="mobile-cell-label">Status</span><ChipBatch b={x.b} k={x.k} /></td>
                    <td data-label="Porsi" className="num-cell"><span className="mobile-cell-label">Porsi</span><b>{porsiTampil(x.b)}</b><span className="cell-sub">{x.b.status >= 4 ? (x.b.status === 4 ? 'disajikan' : 'ditolak') : x.b.porsiDiterima ? 'diterima' : x.b.status >= 2 ? 'dikirim' : x.b.status === 1 ? 'selesai masak' : 'terdaftar'}</span></td>
                    <td data-label="Waktu" className={x.b.status < 4 && x.b.waktuMasak ? `t-${['netral', 'ok', 'warn', 'bad'][x.k.kode]}` : 'muted'} style={{ fontWeight: 700 }}><span className="mobile-cell-label">Waktu</span>{keterangan(x)}</td>
                    <td data-label="Insiden" className={`num-cell${x.b.jumlahInsiden ? '' : ' kosong-hp'}`}><span className="mobile-cell-label">Insiden</span>{x.b.jumlahInsiden || '—'}</td>
                    <td data-label="Bukti" className="table-action aksi-baris">
                      <span className="mobile-cell-label">Bukti</span>
                      <button type="button" className="mini" aria-haspopup="dialog" aria-label={`Lihat detail pencatatan ${x.b.kode}`} onClick={(e) => buka(e, x.b)}>Lihat detail</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel-pad">
            <Kosong ikon={cari ? 'search' : 'shield'} judul={cari ? 'Batch tidak ditemukan' : filter === 'risiko' ? 'Tidak ada batch berisiko' : 'Tidak ada batch'}>
              {cari ? 'Coba kata pencarian lain atau tampilkan semua batch.' : filter === 'risiko' ? 'Semua batch yang sedang berjalan masih jauh dari batas 4 jam.' : 'Belum ada batch pada kategori ini.'}
            </Kosong>
            {(cari || filter !== 'semua') && <button type="button" className="btn secondary block" onClick={hapusSaring} style={{ marginTop: 10 }}>Tampilkan semua batch</button>}
          </div>
        ))}
      </section>

      {dipilih && <PanelDetail b={dipilih} onTutup={tutup} />}
    </>
  );
}
