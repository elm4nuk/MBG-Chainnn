// Detail batch untuk PIC sekolah: terima, sajikan, atau tolak (UC-04, UC-05, UC-06, UC-07).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMuat, useSesi, useTx } from '../../lib/sesi.jsx';
import { ALASAN, jam } from '../../lib/format.js';
import { AppBar, Galat, Halaman, Hero, Ikon, InfoBatch, Kosong, Overlay, Pesan, Riwayat, Skeleton, Stepper, useKelayakan } from '../../components/ui.jsx';
import TxLayar from '../../components/TxLayar.jsx';

const angka = (v) => parseInt(String(v), 10) || 0;

export default function DetailSekolah() {
  const { kode } = useParams();
  const { klien, profil, sekarang } = useSesi();
  const nav = useNavigate();
  const nilaiK = useKelayakan();
  const { data: b, loading, error, reload } = useMuat(() => klien.batch(kode), [kode]);
  const { tx, jalankan, ulangi, tutup } = useTx();
  const [lapisan, setLapisan] = useState(null); // terima | sajikan | tolak | tinjau
  const [alur, setAlur] = useState(null);
  const [porsi, setPorsi] = useState('');
  const [alasan, setAlasan] = useState(2);
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState('');

  const kembali = '/sekolah';
  if (loading && !b) return <Halaman><AppBar judul={`Batch ${kode}`} kembali={kembali} /><div className="content"><Skeleton n={3} teks="Memuat data batch…" /></div></Halaman>;
  if (error || !b) {
    return (
      <Halaman><AppBar judul={`Batch ${kode}`} kembali={kembali} />
        <div className="content"><Kosong ikon="search" judul="Batch tidak ditemukan">{error?.message || 'Periksa kembali kode QR.'}</Kosong></div>
      </Halaman>
    );
  }
  if (b.sekolahId !== profil.organisasiId) {
    return (
      <Halaman><AppBar judul={`Batch ${b.kode}`} kembali={kembali} />
        <div className="content"><Pesan>Batch ini untuk {b.sekolah}, bukan untuk sekolah Anda. Pastikan QR berasal dari wadah yang benar.</Pesan>
          <Link to="/sekolah" className="btn secondary block">Kembali ke Beranda</Link></div>
      </Halaman>
    );
  }

  const k = nilaiK(b);
  const lewat = k.kode === 3;
  const kurir = b.riwayat.find((r) => r.tahap === 'Diambil kurir');

  // ---------------------------------------------------------------- transaksi
  if (tx) {
    const n = angka(porsi);
    const teks = {
      terima: { menunggu: 'Mencatat penerimaan…', tercatat: 'Batch diterima', ditolak: 'Penerimaan ditolak sistem',
        pesan: (x) => `${n} porsi batch ${b.kode} diterima pukul ${jam(x.waktu)}. Hitung mundur batas konsumsi tetap berjalan.` },
      sajikan: { menunggu: 'Mencatat penyajian…', tercatat: 'Penyajian tercatat', ditolak: 'Penyajian ditolak sistem',
        pesan: (x) => `${n} porsi batch ${b.kode} disajikan pukul ${jam(x.waktu)}.` },
      tolak: { menunggu: 'Mencatat penolakan…', tercatat: 'Batch ditolak', ditolak: 'Penolakan ditolak sistem',
        pesan: (x) => `Penolakan batch ${b.kode} tercatat pukul ${jam(x.waktu)}. Pengawas BGN/Dinkes dapat melihatnya.` },
    }[alur];
    return (
      <Halaman>
        <TxLayar tx={tx} teks={teks}
          onSelesai={() => nav('/sekolah')}
          onKembali={() => { tutup(); setLapisan(null); reload(); }}
          onUlang={ulangi}
          aksiDitolak={{ kode: 'BatasWaktuTerlewati', label: 'Catat penolakan', onClick: () => { tutup(); reload(); bukaTolak(1); } }} />
      </Halaman>
    );
  }

  // ---------------------------------------------------------------- aksi
  function bukaTerima() { setAlur('terima'); setPorsi(String(b.porsi)); setGalat(''); setLapisan('terima'); }
  function bukaSajikan() { setAlur('sajikan'); setPorsi(String(b.porsiDiterima)); setGalat(''); setLapisan('sajikan'); }
  function bukaTolak(a) { setAlur('tolak'); setAlasan(a ?? (lewat ? 1 : 2)); setPorsi(String(b.porsiDiterima)); setCatatan(''); setGalat(''); setLapisan('tolak'); }

  function tinjau() {
    const n = angka(porsi);
    const maks = alur === 'terima' ? b.porsi : b.porsiDiterima;
    if (n < 1) { setGalat(`Isi jumlah porsi ${alur === 'tolak' ? 'yang ditahan' : alur === 'terima' ? 'yang diterima' : 'yang disajikan'} (minimal 1).`); return; }
    if (n > maks) { setGalat(alur === 'terima' ? `Jumlah melebihi porsi yang dikirim (${maks} porsi).` : `Jumlah melebihi porsi yang diterima (${maks} porsi).`); return; }
    if (alur === 'tolak' && alasan === 1 && !lewat) { setGalat('Batch belum melewati batas 4 jam. Pilih alasan lain.'); return; }
    setGalat('');
    setLapisan('tinjau');
  }

  function konfirmasi() {
    const n = angka(porsi);
    setLapisan(null);
    if (alur === 'terima') jalankan((onStatus) => klien.terimaBatch(b.id, n, { onStatus }));
    if (alur === 'sajikan') jalankan((onStatus) => klien.catatPenyajian(b.id, n, { onStatus }));
    if (alur === 'tolak') jalankan((onStatus) => klien.tolakBatch(b.id, alasan, n, catatan.trim(), { onStatus }));
  }

  let aksi = null;
  if (b.status === 2) {
    aksi = <div className="actions"><button type="button" className="btn primary" onClick={bukaTerima}><Ikon n="check" />Terima batch</button></div>;
  } else if (b.status === 3) {
    aksi = lewat
      ? <div className="actions"><button type="button" className="btn" disabled>Sajikan</button><button type="button" className="btn primary" onClick={() => bukaTolak(1)}>Tolak batch</button></div>
      : <div className="actions"><button type="button" className="btn danger" onClick={() => bukaTolak()}>Tolak batch</button><button type="button" className="btn primary" onClick={bukaSajikan}>Sajikan</button></div>;
  } else if (b.status >= 4) {
    aksi = <div className="actions"><Link to={`/sekolah/lapor?kode=${b.kode}`} className="btn secondary"><Ikon n="flag" />Laporkan insiden</Link></div>;
  }

  const idBantu = 'porsi-bantu';
  return (
    <Halaman>
      <AppBar judul={`Batch ${b.kode}`} kembali={kembali} />
      <div className="content">
        <Hero b={b} k={k} />
        {b.status === 3 && lewat && <Pesan>Batch ini melewati batas 4 jam dan tidak boleh disajikan. Tolak batch agar tercatat dan pengawas dapat melihatnya.</Pesan>}
        {b.status === 2 && <Pesan jenis="info" ikon="truck">Batch sedang diantar {kurir?.oleh}. Hitung porsi yang tiba, lalu catat penerimaan.</Pesan>}
        {b.status <= 1 && <Pesan jenis="info" ikon="clock">Batch masih di dapur {b.dapur}. Penerimaan dicatat saat kurir tiba.</Pesan>}
        {b.jumlahInsiden > 0 && <Pesan jenis="warn" ikon="flag">{b.jumlahInsiden} laporan insiden tercatat untuk batch ini.</Pesan>}
        <InfoBatch b={b} />
        <Riwayat b={b} />
      </div>
      {aksi}

      {(lapisan === 'terima' || lapisan === 'sajikan') && (
        <Overlay onTutup={() => setLapisan(null)} label={lapisan === 'terima' ? 'Terima batch' : 'Sajikan batch'}>
          <h2>{lapisan === 'terima' ? `Terima batch ${b.kode}` : `Sajikan batch ${b.kode}`}</h2>
          <p className="sub">{b.menu}</p>
          <label htmlFor="porsi">{lapisan === 'terima' ? 'Jumlah porsi yang tiba *' : 'Jumlah porsi disajikan *'}</label>
          <Stepper id="porsi" label="satu porsi" value={porsi} onChange={(v) => { setPorsi(String(v)); setGalat(''); }} invalid={!!galat} describedBy={idBantu} />
          {galat ? <div id={idBantu}><Galat>{galat}</Galat></div>
            : <p className="help" id={idBantu}>{lapisan === 'terima' ? `Dikirim ${b.porsi} porsi oleh ${b.dapur}.` : `Maksimal ${b.porsiDiterima} porsi, sesuai jumlah yang diterima.`}</p>}
          <button type="button" className="btn primary block" onClick={tinjau}>{lapisan === 'terima' ? 'Tinjau penerimaan' : 'Tinjau penyajian'}</button>
          <button type="button" className="btn ghost block" onClick={() => setLapisan(null)}>Batal</button>
        </Overlay>
      )}

      {lapisan === 'tolak' && (
        <Overlay onTutup={() => setLapisan(null)} label="Tolak batch">
          <h2>Tolak batch {b.kode}</h2>
          <p className="sub">Batch yang ditolak tidak dibagikan kepada siswa.</p>
          <fieldset className="opts">
            <legend>Alasan penolakan *</legend>
            {ALASAN.map((a) => (
              <label key={a.kode} className="opt" style={a.kode === 1 && !lewat ? { opacity: 0.55 } : undefined}>
                <input type="radio" name="alasan" value={a.kode} checked={alasan === a.kode} disabled={a.kode === 1 && !lewat}
                  onChange={() => { setAlasan(a.kode); setGalat(''); }} />
                <span>{a.teks}{a.kode === 1 && !lewat ? <span className="muted" style={{ display: 'block', fontSize: 12.5, fontWeight: 500 }}>Tersedia setelah batas {jam(k.batas)}</span> : null}</span>
              </label>
            ))}
          </fieldset>
          <label htmlFor="porsi-tolak">Porsi yang ditahan *</label>
          <input id="porsi-tolak" inputMode="numeric" value={porsi} onChange={(e) => { setPorsi(e.target.value.replace(/\D/g, '')); setGalat(''); }} className={galat ? 'invalid' : undefined} aria-describedby={idBantu} />
          {galat ? <div id={idBantu}><Galat>{galat}</Galat></div> : <p className="help" id={idBantu}>Maksimal {b.porsiDiterima} porsi.</p>}
          <label htmlFor="catatan">Catatan (opsional)</label>
          <textarea id="catatan" placeholder="Contoh: nasi berbau asam" value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={200} />
          <button type="button" className="btn primary block" onClick={tinjau}>Tinjau penolakan</button>
          <button type="button" className="btn ghost block" onClick={() => setLapisan(null)}>Batal</button>
        </Overlay>
      )}

      {lapisan === 'tinjau' && (
        <Overlay jenis="dialog" label="Tinjau pencatatan">
          <h2>{alur === 'tolak' ? 'Tinjau penolakan' : alur === 'terima' ? 'Tinjau penerimaan' : 'Tinjau sebelum mencatat'}</h2>
          <dl className="kv">
            <dt>Batch</dt><dd>{b.kode}</dd>
            {alur !== 'tolak' && (<><dt>Menu</dt><dd>{b.menu}</dd></>)}
            {alur === 'terima' && (<><dt>Porsi diterima</dt><dd>{angka(porsi)} porsi</dd><dt>Kurir</dt><dd>{kurir?.oleh}</dd></>)}
            {alur === 'sajikan' && (<><dt>Porsi disajikan</dt><dd>{angka(porsi)} porsi</dd></>)}
            {alur === 'tolak' && (<><dt>Alasan</dt><dd>{ALASAN.find((a) => a.kode === alasan)?.teks}</dd><dt>Porsi ditahan</dt><dd>{angka(porsi)} porsi</dd>{catatan.trim() && (<><dt>Catatan</dt><dd>{catatan.trim()}</dd></>)}</>)}
            <dt>Waktu</dt><dd>{jam(sekarang())}</dd>
            <dt>Dicatat oleh</dt><dd>{profil.nama}</dd>
          </dl>
          <p className="warn-line">{alur === 'tolak' ? 'Pengawas BGN/Dinkes dapat melihat penolakan ini.' : 'Catatan tidak bisa diubah setelah tercatat di blockchain.'}</p>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setLapisan(alur)}>Ubah</button>
            <button type="button" className="btn primary" onClick={konfirmasi}>{alur === 'tolak' ? 'Konfirmasi tolak' : 'Konfirmasi'}</button>
          </div>
        </Overlay>
      )}
    </Halaman>
  );
}
