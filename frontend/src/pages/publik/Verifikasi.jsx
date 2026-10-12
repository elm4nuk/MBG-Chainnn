// Verifikasi publik tanpa login (UC-12): orang tua atau siapa pun memindai QR batch dan melihat riwayatnya
// langsung dari smart contract, lengkap dengan bukti transaksi di blockchain (UC-10).
import { useNavigate, useParams } from 'react-router-dom';
import { useMuat, useSesi } from '../../lib/sesi.jsx';
import { berandaUntuk, jam } from '../../lib/format.js';
import { AppBar, Halaman, Hero, Ikon, InfoBatch, Kosong, Pesan, Riwayat, Skeleton, useKelayakan } from '../../components/ui.jsx';
import { BuktiBlockchain } from '../../components/Bukti.jsx';
import { PemindaiQR } from '../../components/Qr.jsx';

function DetailPublik({ kode, kembali }) {
  const { klien } = useSesi();
  const nilaiK = useKelayakan();
  const { data, loading, error } = useMuat(async () => {
    const [b, jejak] = await Promise.all([klien.batch(kode), klien.jejakAudit(kode)]);
    return { b, jejak };
  }, [kode]);

  if (loading && !data) return <div className="content"><Skeleton n={3} teks={`Membaca batch ${kode} dari blockchain…`} /></div>;
  if (error || !data) {
    return (
      <div className="content">
        <Kosong ikon="search" judul="Batch tidak ditemukan">{error?.jenis === 'jaringan' ? error.message : `Tidak ada batch ${kode} di MBG-Chain. Periksa kembali kode QR.`}</Kosong>
        <button type="button" className="btn secondary block" onClick={kembali}><Ikon n="qr" />Pindai batch lain</button>
      </div>
    );
  }
  const { b, jejak } = data;
  const k = nilaiK(b);
  const aman = b.status === 4;
  return (
    <div className="content">
      <Pesan jenis={aman ? 'info' : b.status === 5 ? 'bad' : 'info'} ikon="shield">
        {aman && `Batch ini disajikan pukul ${jam(b.riwayat.at(-1)?.waktu)}, sebelum batas konsumsi ${jam(k.batas)}.`}
        {b.status === 5 && `Batch ini ditolak sekolah (${b.alasanTolak}) dan tidak dibagikan kepada siswa.`}
        {b.status < 4 && 'Batch ini masih dalam proses. Data di bawah dibaca langsung dari smart contract.'}
      </Pesan>
      <Hero b={b} k={k} />
      {b.jumlahInsiden > 0 && <Pesan jenis="warn" ikon="flag">{b.jumlahInsiden} laporan insiden tercatat untuk batch ini.</Pesan>}
      <InfoBatch b={b} />
      <Riwayat b={b} />
      <BuktiBlockchain jejak={jejak} />
    </div>
  );
}

export default function Verifikasi() {
  const { kode } = useParams();
  const { profil } = useSesi();
  const nav = useNavigate();
  const keluar = profil ? berandaUntuk(profil) : '/masuk';

  if (!kode) {
    return (
      <Halaman>
        <AppBar judul="Verifikasi batch" eyebrow="Tanpa login" kembali={keluar} kamera />
        <PemindaiQR onKode={(k) => nav(`/verifikasi/${k}`)} petunjuk="Arahkan kamera ke QR pada wadah makanan." />
      </Halaman>
    );
  }
  return (
    <Halaman>
      <AppBar judul={`Batch ${kode}`} eyebrow="Verifikasi publik" kembali="/verifikasi" />
      <DetailPublik kode={kode} kembali={() => nav('/verifikasi')} />
    </Halaman>
  );
}
