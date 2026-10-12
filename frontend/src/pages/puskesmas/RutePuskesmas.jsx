// Petugas Puskesmas: cari batch, lihat riwayat & laporan insiden, laporkan insiden (UC-08).
import { useEffect } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import Profil from '../Profil.jsx';
import Lapor from '../sekolah/Lapor.jsx';
import { TABS_PUSKESMAS } from '../tabs.js';
import { useMuat, useSesi } from '../../lib/sesi.jsx';
import { jam, tanggal } from '../../lib/format.js';
import { AppBar, Halaman, Hero, Ikon, InfoBatch, ItemBatch, Kosong, Pesan, Riwayat, Skeleton, Statistik, TabBar, TataDetail, useKelayakan } from '../../components/ui.jsx';
import { BuktiBatch } from '../../components/Bukti.jsx';
import { PemindaiQR } from '../../components/Qr.jsx';

function Beranda() {
  const { klien, profil, sekarang, detak } = useSesi();
  const nilaiK = useKelayakan();
  const { data, loading, error, reload } = useMuat(() => klien.semuaBatch(), []);
  useEffect(() => { if (detak && detak % 2 === 0) reload(true); }, [detak]);
  const now = sekarang();
  const semua = (data || []).map((b) => ({ b, k: nilaiK(b) })).sort((p, q) => q.b.id - p.b.id);
  const insiden = semua.filter((x) => x.b.jumlahInsiden > 0);
  const disajikan = semua.filter((x) => x.b.status === 4 && !x.b.jumlahInsiden);
  return (
    <Halaman>
      <AppBar judul={profil.organisasi} eyebrow="Petugas Puskesmas" />
      <div className="content">
        <div className="date">{tanggal(now)} · pukul {jam(now)}</div>
        {data && (
          <Statistik label="Ringkasan insiden" items={[
            { label: 'Batch dengan insiden', nilai: insiden.length, nada: insiden.length ? 'bad' : 'netral', ket: 'Perlu ditelusuri' },
            { label: 'Total laporan', nilai: insiden.reduce((n, x) => n + x.b.jumlahInsiden, 0), nada: 'warn', ket: 'Dari sekolah & Puskesmas' },
            { label: 'Disajikan tanpa laporan', nilai: disajikan.length, nada: 'ok', ket: 'Belum ada keluhan' },
          ]} />
        )}
        <div className="aksi-utama">
          <Link to="/puskesmas/pindai" className="btn primary block"><Ikon n="search" />Cari batch (QR atau kode)</Link>
          <p className="help">Telusuri riwayat dan jejak audit batch yang dikeluhkan.</p>
        </div>
        {loading && !data && <Skeleton n={2} />}
        {error && <Pesan>{error.message}</Pesan>}
        {data && (
          <>
            <div className="sec-h"><h2>Batch dengan laporan insiden</h2><span className="sec-sub">{insiden.length} batch</span></div>
            {insiden.length ? (
              <div className="list">{insiden.map(({ b, k }) => <ItemBatch key={b.id} b={b} k={k} ke={`/puskesmas/batch/${b.kode}`} meta={`${b.jumlahInsiden} laporan · ${b.sekolah} · ${b.dapur}`} />)}</div>
            ) : <Kosong ikon="flag" judul="Belum ada laporan insiden">Laporan dari sekolah atau Puskesmas akan tampil di sini.</Kosong>}
            {disajikan.length > 0 && (
              <>
                <div className="sec-h"><h2>Batch sudah disajikan</h2></div>
                <div className="list">{disajikan.map(({ b, k }) => <ItemBatch key={b.id} b={b} k={k} ke={`/puskesmas/batch/${b.kode}`} meta={`${b.sekolah} · ${b.porsiSelesai} porsi · ${jam(b.riwayat.at(-1)?.waktu)}`} />)}</div>
              </>
            )}
          </>
        )}
      </div>
      <TabBar items={TABS_PUSKESMAS} />
    </Halaman>
  );
}

function Detail() {
  const { kode } = useParams();
  const { klien } = useSesi();
  const nilaiK = useKelayakan();
  const { data, loading, error } = useMuat(async () => {
    const b = await klien.batch(kode);
    const jejak = (await klien.jejakAudit(kode)).filter((e) => e.event === 'InsidenDilaporkan');
    const laporan = await Promise.all(jejak.map(async (e) => ({ ...e, pelapor: await klien.profil(e.data.pelapor) })));
    return { b, laporan };
  }, [kode]);
  if (loading && !data) return <Halaman><AppBar judul={`Batch ${kode}`} kembali="/puskesmas" /><div className="content"><Skeleton n={3} /></div></Halaman>;
  if (error || !data) return <Halaman><AppBar judul={`Batch ${kode}`} kembali="/puskesmas" /><div className="content"><Kosong ikon="search" judul="Batch tidak ditemukan">{error?.message}</Kosong></div></Halaman>;
  const { b, laporan } = data;
  return (
    <Halaman>
      <AppBar judul={`Batch ${b.kode}`} eyebrow={b.sekolah} kembali="/puskesmas" />
      <div className="content">
        <TataDetail
          utama={<>
            <Hero b={b} k={nilaiK(b)} />
            <section className="card">
              <h3>Laporan insiden ({laporan.length})</h3>
              {laporan.length ? (
                <ol className="tl">
                  {laporan.map((l) => (
                    <li key={l.txHash}><span className="ic bad"><Ikon n="flag" /></span>
                      <div><b>{jam(l.waktu)} · {l.pelapor.nama} ({l.pelapor.organisasi})</b><span>{l.data.keterangan}</span></div></li>
                  ))}
                </ol>
              ) : <p className="muted" style={{ margin: 0 }}>Belum ada laporan untuk batch ini.</p>}
            </section>
            <InfoBatch b={b} />
          </>}
          samping={<>
            <Riwayat b={b} />
            <BuktiBatch kode={b.kode} />
          </>} />
      </div>
      {b.status >= 3 && <div className="actions"><Link to={`/puskesmas/lapor?kode=${b.kode}`} className="btn primary"><Ikon n="flag" />Laporkan insiden</Link></div>}
    </Halaman>
  );
}

function Cari() {
  const nav = useNavigate();
  return (
    <Halaman>
      <AppBar judul="Cari batch" kembali="/puskesmas" kamera />
      <PemindaiQR onKode={(kode) => nav(`/puskesmas/batch/${kode}`)} petunjuk="Pindai QR pada wadah atau label batch." />
      <TabBar items={TABS_PUSKESMAS} />
    </Halaman>
  );
}

export default function RutePuskesmas() {
  return (
    <Routes>
      <Route index element={<Beranda />} />
      <Route path="pindai" element={<Cari />} />
      <Route path="batch/:kode" element={<Detail />} />
      <Route path="lapor" element={<Lapor puskesmas />} />
      <Route path="profil" element={<Profil tabs={TABS_PUSKESMAS} />} />
    </Routes>
  );
}
