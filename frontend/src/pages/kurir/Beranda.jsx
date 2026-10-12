// Beranda kurir: batch siap diambil di dapur, batch yang sedang diantar, dan yang sudah diserahkan.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMuat, useSesi } from '../../lib/sesi.jsx';
import { jam, tanggal } from '../../lib/format.js';
import { AppBar, Halaman, Ikon, ItemBatch, Kosong, Pesan, Skeleton, TabBar, useKelayakan } from '../../components/ui.jsx';
import { TABS_KURIR } from '../tabs.js';

export default function BerandaKurir() {
  const { klien, profil, sekarang, detak } = useSesi();
  const nilaiK = useKelayakan();
  const { data, loading, error, reload } = useMuat(() => klien.semuaBatch(), []);
  useEffect(() => { if (detak && detak % 2 === 0) reload(true); }, [detak]);
  const now = sekarang();
  const saya = (b) => b.akun.kurir.toLowerCase() === profil.akun.toLowerCase();
  const semua = (data || []).map((b) => ({ b, k: nilaiK(b) }));
  const siap = semua.filter((x) => x.b.status === 1).sort((p, q) => p.k.batas - q.k.batas);
  const antar = semua.filter((x) => x.b.status === 2 && saya(x.b)).sort((p, q) => p.k.batas - q.k.batas);
  const sudah = semua.filter((x) => x.b.status >= 3 && saya(x.b)).sort((p, q) => q.b.id - p.b.id).slice(0, 5);

  return (
    <Halaman>
      <AppBar judul={profil.nama} eyebrow={`Kurir · ${profil.organisasi}`} />
      <div className="content">
        <div className="date">{tanggal(now)} · pukul {jam(now)}</div>
        <Link to="/kurir/pindai" className="btn primary block"><Ikon n="qr" />Pindai QR untuk mengambil</Link>
        {loading && !data && <Skeleton n={3} teks="Memuat batch dari blockchain…" />}
        {error && <Pesan>{error.message}</Pesan>}
        {data && (
          <>
            <div className="sec-h"><h2>Sedang Anda antar</h2><span className="sec-sub">{antar.length} batch</span></div>
            {antar.length ? (
              <div className="list">{antar.map(({ b, k }) => <ItemBatch key={b.id} b={b} k={k} ke={`/kurir/batch/${b.kode}`} meta={`Antar ke ${b.sekolah} · ${b.porsi} porsi`} />)}</div>
            ) : <Kosong ikon="truck" judul="Tidak ada batch di perjalanan">Pindai QR di dapur untuk mencatat pengambilan.</Kosong>}

            <div className="sec-h"><h2>Siap diambil di dapur</h2><span className="sec-sub">urut batas waktu</span></div>
            {siap.length ? (
              <div className="list">{siap.map(({ b, k }) => <ItemBatch key={b.id} b={b} k={k} ke={`/kurir/batch/${b.kode}`} meta={`${b.dapur} → ${b.sekolah} · ${b.porsi} porsi`} />)}</div>
            ) : <p className="muted" style={{ margin: 0 }}>Belum ada batch yang selesai dimasak.</p>}

            {sudah.length > 0 && (
              <>
                <div className="sec-h"><h2>Sudah diserahkan</h2></div>
                <div className="list">{sudah.map(({ b, k }) => <ItemBatch key={b.id} b={b} k={k} ke={`/kurir/batch/${b.kode}`} meta={`${b.sekolah} · diterima ${jam(b.riwayat.find((r) => r.tahap === 'Diterima sekolah')?.waktu)}`} />)}</div>
              </>
            )}
          </>
        )}
      </div>
      <TabBar items={TABS_KURIR} />
    </Halaman>
  );
}
