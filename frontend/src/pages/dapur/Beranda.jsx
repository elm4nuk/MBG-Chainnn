// Beranda petugas dapur SPPG: batch per tahap, dari belum dimasak sampai selesai di sekolah.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMuat, useSesi } from '../../lib/sesi.jsx';
import { jam, tanggal } from '../../lib/format.js';
import { AppBar, Halaman, Ikon, ItemBatch, Kosong, Pesan, Ringkasan, Skeleton, TabBar, useKelayakan } from '../../components/ui.jsx';
import { TABS_DAPUR } from '../tabs.js';

function Bagian({ judul, sub, isi, meta }) {
  if (!isi.length) return null;
  return (
    <>
      <div className="sec-h"><h2>{judul}</h2><span className="sec-sub">{sub || `${isi.length} batch`}</span></div>
      <div className="list">{isi.map(({ b, k }) => <ItemBatch key={b.id} b={b} k={k} ke={`/dapur/batch/${b.kode}`} meta={meta(b)} />)}</div>
    </>
  );
}

export default function BerandaDapur() {
  const { klien, profil, sekarang, detak } = useSesi();
  const nilaiK = useKelayakan();
  const { data, loading, error, reload } = useMuat(() => klien.daftarBatch({ dapurId: profil.organisasiId }), [profil.organisasiId]);
  useEffect(() => { if (detak && detak % 2 === 0) reload(true); }, [detak]);
  const now = sekarang();
  const semua = (data || []).map((b) => ({ b, k: nilaiK(b) })).sort((p, q) => q.b.id - p.b.id);
  const per = (s) => semua.filter((x) => s.includes(x.b.status));
  const waktu = (b, t) => jam(b.riwayat.find((r) => r.tahap === t)?.waktu);

  return (
    <Halaman>
      <AppBar judul={profil.organisasi} eyebrow="Petugas dapur" />
      <div className="content operational-content">
        <section className="dashboard-intro role-intro" aria-labelledby="judul-dapur">
          <div><span className="section-kicker">Operasional SPPG</span><h1 id="judul-dapur">Produksi dan pengiriman batch</h1></div>
          <p>Daftarkan batch, catat selesai masak tepat waktu, dan pantau perjalanan makanan sampai sekolah.</p>
          <div className="date"><Ikon n="clock" />{tanggal(now)} · pukul {jam(now)}</div>
        </section>
        {data && <Ringkasan items={[
          { label: 'Belum dimasak', value: per([0]).length, help: 'Perlu tindakan', nada: per([0]).length ? 'warn' : 'ok' },
          { label: 'Menunggu kurir', value: per([1]).length, help: 'Batas 4 jam berjalan', nada: 'pend' },
          { label: 'Dalam perjalanan', value: per([2]).length, help: 'Menuju sekolah' },
          { label: 'Selesai', value: per([4, 5]).length, help: 'Hasil akhir', nada: 'ok' },
        ]} />}
        <Link to="/dapur/baru" className="btn primary block"><Ikon n="plus" />Daftarkan batch baru</Link>
        <Pesan jenis="info" ikon="clock">Batas konsumsi empat jam dimulai saat selesai masak dicatat di blockchain.</Pesan>
        {loading && !data && <Skeleton n={3} teks="Memuat batch dapur dari blockchain…" />}
        {error && <Pesan>{error.message}</Pesan>}
        {data && !semua.length && <Kosong ikon="bowl" judul="Belum ada batch">Daftarkan batch untuk setiap sekolah tujuan, lalu tempel label QR pada wadahnya.</Kosong>}
        <Bagian judul="Perlu dicatat selesai masak" isi={per([0])} meta={(b) => `${b.porsi} porsi untuk ${b.sekolah} · didaftarkan ${waktu(b, 'Didaftarkan')}`} />
        <Bagian judul="Menunggu kurir" isi={per([1])} meta={(b) => `${b.porsi} porsi untuk ${b.sekolah} · selesai masak ${jam(b.waktuMasak)}`} />
        <Bagian judul="Dalam perjalanan" isi={per([2])} meta={(b) => `${b.sekolah} · diambil ${b.riwayat.find((r) => r.tahap === 'Diambil kurir')?.oleh} ${waktu(b, 'Diambil kurir')}`} />
        <Bagian judul="Di sekolah" isi={per([3])} meta={(b) => `${b.sekolah} · diterima ${b.porsiDiterima} porsi ${waktu(b, 'Diterima sekolah')}`} />
        <Bagian judul="Selesai" isi={per([4, 5])} meta={(b) => `${b.sekolah} · ${b.status === 4 ? `${b.porsiSelesai} porsi disajikan` : `ditolak: ${b.alasanTolak}`}`} />
      </div>
      <TabBar items={TABS_DAPUR} />
    </Halaman>
  );
}
