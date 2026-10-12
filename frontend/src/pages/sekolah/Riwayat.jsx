import { useMuat, useSesi } from '../../lib/sesi.jsx';
import { jam } from '../../lib/format.js';
import { AppBar, Halaman, ItemBatch, Kosong, Pesan, Skeleton, TabBar, useKelayakan } from '../../components/ui.jsx';
import { TABS_SEKOLAH } from '../tabs.js';

export default function RiwayatSekolah() {
  const { klien, profil } = useSesi();
  const nilaiK = useKelayakan();
  const { data, loading, error } = useMuat(() => klien.daftarBatch({ sekolahId: profil.organisasiId }), [profil.organisasiId]);
  const akhir = (b) => b.riwayat.at(-1)?.waktu || 0;
  const selesai = (data || []).filter((b) => b.status >= 4).sort((p, q) => akhir(q) - akhir(p));
  return (
    <Halaman>
      <AppBar judul="Riwayat batch" eyebrow={profil.organisasi} />
      <div className="content">
        {loading && <Skeleton n={3} />}
        {error && <Pesan>{error.message}</Pesan>}
        {data && (selesai.length ? (
          <div className="list">
            {selesai.map((b) => (
              <ItemBatch key={b.id} b={b} k={nilaiK(b)} ke={`/sekolah/batch/${b.kode}`}
                meta={b.status === 4
                  ? `${b.porsiSelesai} porsi disajikan · ${jam(akhir(b))} · ${b.riwayat.at(-1)?.oleh}`
                  : `${b.porsiSelesai} porsi ditolak · ${b.alasanTolak} · ${jam(akhir(b))}`} />
            ))}
          </div>
        ) : <Kosong ikon="history" judul="Belum ada batch selesai">Batch yang sudah disajikan atau ditolak tampil di sini.</Kosong>)}
      </div>
      <TabBar items={TABS_SEKOLAH} />
    </Halaman>
  );
}
