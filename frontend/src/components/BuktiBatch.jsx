// Bukti audit satu batch untuk halaman detail peran. Data tetap dibaca dari smart contract.
import { useMuat, useSesi } from '../lib/sesi.jsx';
import { Pesan, Skeleton } from './ui.jsx';
import { BuktiBlockchain } from './Bukti.jsx';

export default function BuktiBatch({ kode }) {
  const { klien } = useSesi();
  const { data, loading, error, reload } = useMuat(() => klien.jejakAudit(kode), [kode]);

  if (loading && !data) return <Skeleton n={1} teks="Membaca bukti transaksi dari blockchain…" />;
  if (error) return <Pesan>{error.message} <button type="button" className="inline-action" onClick={() => reload()}>Coba lagi</button></Pesan>;
  return data ? <BuktiBlockchain jejak={data} /> : null;
}
