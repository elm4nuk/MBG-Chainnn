// Beranda PIC sekolah: batch yang perlu diterima, batch diterima urut sisa waktu, peringatan dini.
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMuat, useSesi } from '../../lib/sesi.jsx';
import { durasi, jam, tanggal } from '../../lib/format.js';
import { AppBar, Halaman, Ikon, ItemBatch, Kosong, Pesan, Skeleton, TabBar, useKelayakan } from '../../components/ui.jsx';
import { TABS_SEKOLAH } from '../tabs.js';

export default function BerandaSekolah() {
  const { klien, profil, sekarang, detak } = useSesi();
  const nilaiK = useKelayakan();
  const nav = useNavigate();
  const { data, loading, error, reload } = useMuat(() => klien.daftarBatch({ sekolahId: profil.organisasiId }), [profil.organisasiId]);
  useEffect(() => { if (detak && detak % 2 === 0) reload(true); }, [detak]); // segarkan diam-diam tiap 30 detik

  const now = sekarang();
  const semua = (data || []).map((b) => ({ b, k: nilaiK(b) }));
  const datang = semua.filter((x) => x.b.status === 2);
  const diterima = semua.filter((x) => x.b.status === 3).sort((p, q) => p.k.batas - q.k.batas);
  const disiapkan = semua.filter((x) => x.b.status <= 1);
  const selesai = semua.filter((x) => x.b.status >= 4);
  const lewat = diterima.find((x) => x.k.kode === 3);
  const mendesak = diterima.find((x) => x.k.kode === 2);
  const utama = lewat || mendesak;

  const bel = (
    <button type="button" className="icon-btn" aria-label={utama ? 'Peringatan dini, ada batch perlu tindakan' : 'Tidak ada peringatan'}
      onClick={() => utama && nav(`/sekolah/batch/${utama.b.kode}`)}>
      <Ikon n="bell" />{utama && <span className="dot" />}
    </button>
  );

  return (
    <Halaman>
      <AppBar judul={profil.organisasi} eyebrow="PIC Sekolah" kanan={bel} />
      <div className="content">
        <div className="date">{tanggal(now)} · pukul {jam(now)}</div>
        {lewat && (
          <Link to={`/sekolah/batch/${lewat.b.kode}`} className="banner bad">
            <Ikon n="alert" /><div><b>{lewat.b.kode} lewat batas {durasi(lewat.k.lewat)}</b><span>Jangan disajikan. Tolak batch agar tercatat.</span></div><span className="chev"><Ikon n="chev" /></span>
          </Link>
        )}
        {mendesak && (
          <Link to={`/sekolah/batch/${mendesak.b.kode}`} className="banner">
            <Ikon n="clock" /><div><b>{mendesak.b.kode} tersisa {durasi(mendesak.k.sisa)}</b><span>Sajikan sekarang atau tolak batch.</span></div><span className="chev"><Ikon n="chev" /></span>
          </Link>
        )}
        <Link to="/sekolah/pindai" className="btn primary block"><Ikon n="qr" />Pindai QR batch</Link>

        {loading && !data && <Skeleton n={3} teks="Memuat batch sekolah dari blockchain…" />}
        {error && <Pesan>Data batch gagal dimuat: {error.message} <button type="button" className="mini" onClick={() => reload()}>Coba lagi</button></Pesan>}

        {datang.length > 0 && (
          <>
            <div className="sec-h"><h2>Perlu diterima</h2><span className="sec-sub">kurir dalam perjalanan</span></div>
            <div className="list">
              {datang.map(({ b, k }) => (
                <ItemBatch key={b.id} b={b} k={k} ke={`/sekolah/batch/${b.kode}`}
                  meta={`${b.porsi} porsi · diambil ${b.riwayat.find((r) => r.tahap === 'Diambil kurir')?.oleh} ${jam(b.riwayat.find((r) => r.tahap === 'Diambil kurir')?.waktu)}`} />
              ))}
            </div>
          </>
        )}

        {data && (
          <>
            <div className="sec-h"><h2>Batch diterima</h2><span className="sec-sub">urut sisa waktu</span></div>
            {diterima.length ? (
              <div className="list">
                {diterima.map(({ b, k }) => (
                  <ItemBatch key={b.id} b={b} k={k} ke={`/sekolah/batch/${b.kode}`}
                    meta={`${b.porsiDiterima} porsi · diterima ${jam(b.riwayat.find((r) => r.tahap === 'Diterima sekolah')?.waktu)}`} />
                ))}
              </div>
            ) : (
              <Kosong judul="Belum ada batch diterima">Batch muncul di sini setelah kurir menyerahkannya dan Anda mengonfirmasi penerimaan.</Kosong>
            )}
          </>
        )}

        {disiapkan.length > 0 && (
          <>
            <div className="sec-h"><h2>Sedang disiapkan dapur</h2><span className="sec-sub">{disiapkan.length} batch</span></div>
            <div className="list">
              {disiapkan.map(({ b, k }) => (
                <ItemBatch key={b.id} b={b} k={k} ke={`/sekolah/batch/${b.kode}`} meta={`${b.porsi} porsi · ${b.dapur}`} />
              ))}
            </div>
          </>
        )}

        {selesai.length > 0 && (
          <Link to="/sekolah/riwayat" className="btn ghost block">Lihat {selesai.length} batch selesai di Riwayat</Link>
        )}
      </div>
      <TabBar items={TABS_SEKOLAH} />
    </Halaman>
  );
}
