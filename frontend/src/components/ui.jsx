// Komponen bersama, mengikuti komponen UI design Session 10.
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useSesi } from '../lib/sesi.jsx';
import { KELAYAKAN, NADA_KELAYAKAN, durasi, durasiBesar, jam, kelayakan, statusBatch } from '../lib/format.js';

const PATH = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  chev: '<path d="M9 18l6-6-6-6"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h3v-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7.5c0-1.5 1-2 1-3.5M12 7.5c0-1.5 1-2 1-3.5M16 7.5c0-1.5 1-2 1-3.5"/>',
  tray: '<path d="M3 13l3-8h12l3 8"/><path d="M3 13v6h18v-6h-5l-1.5 2h-5L8 13z"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
};

export function Ikon({ n, ...p }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p} dangerouslySetInnerHTML={{ __html: PATH[n] }} />;
}

export function Halaman({ lebar, children }) {
  return <div className={`shell${lebar ? ' lebar' : ''}`}>{children}</div>;
}

export function AppBar({ judul, eyebrow, kembali, kanan, kamera }) {
  const nav = useNavigate();
  return (
    <header className={`bar${kamera ? ' cam-bar' : ''}`}>
      {kembali && (
        <button type="button" className="icon-btn" aria-label="Kembali" onClick={() => (typeof kembali === 'function' ? kembali() : nav(kembali))}>
          <Ikon n="back" />
        </button>
      )}
      <div className="grow">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <div className="title">{judul}</div>
      </div>
      {kanan}
    </header>
  );
}

export function TabBar({ items, brand }) {
  return (
    <nav className="tabs" style={{ '--n': items.length }} aria-label="Menu utama">
      {brand && (
        <div className="nav-brand" aria-hidden="true">
          <span className="nav-mark"><Ikon n="shield" /></span>
          <span><b>{brand}</b><small>Portal pengelolaan</small></span>
        </div>
      )}
      {items.map((t) => (
        <NavLink key={t.ke} to={t.ke} end className="tab">
          <Ikon n={t.ikon} />{t.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Chip({ nada = 'netral', ikon, children }) {
  return <span className={`chip ${nada}`}>{ikon && <Ikon n={ikon} />}{children}</span>;
}

const IKON_NADA = { ok: 'check', warn: 'clock', bad: 'x', pend: 'truck', netral: 'clock' };

export function ChipKelayakan({ kode }) {
  return <Chip nada={NADA_KELAYAKAN[kode]} ikon={IKON_NADA[NADA_KELAYAKAN[kode]]}>{KELAYAKAN[kode]}</Chip>;
}

export function ChipStatus({ b }) {
  const s = statusBatch(b);
  return <Chip nada={s.nada} ikon={b.status === 4 ? 'check' : b.status === 5 ? 'x' : b.status === 0 ? 'clock' : 'truck'}>{s.teks}</Chip>;
}

/** Chip yang paling berguna untuk batch: kelayakan selama batch masih berjalan, status bila sudah selesai. */
export function ChipBatch({ b, k }) {
  if (b.status >= 4 || b.status === 0) return <ChipStatus b={b} />;
  return <ChipKelayakan kode={k.kode} />;
}

export function Hero({ b, k }) {
  if (b.status === 4 || b.status === 5) {
    const ok = b.status === 4;
    return (
      <section className={`hero ${ok ? 'ok' : 'bad'}`}>
        <div><ChipStatus b={b} /></div>
        <div className="big teks">{ok ? `${b.porsiSelesai} porsi disajikan` : `${b.porsiSelesai} porsi ditolak`}</div>
        <p>{ok ? `Dicatat pukul ${jam(b.riwayat.at(-1)?.waktu)} · ${b.riwayat.at(-1)?.oleh}` : `Alasan: ${b.alasanTolak} · ${jam(b.riwayat.at(-1)?.waktu)}`}</p>
      </section>
    );
  }
  if (!b.waktuMasak) {
    return (
      <section className="hero netral">
        <div><ChipStatus b={b} /></div>
        <div className="big teks">Belum dimasak</div>
        <p>Hitungan batas 4 jam dimulai saat dapur mencatat selesai masak.</p>
      </section>
    );
  }
  const nada = NADA_KELAYAKAN[k.kode];
  const d = durasiBesar(k.kode === 3 ? k.lewat : k.sisa, k.kode === 3);
  return (
    <section className={`hero ${nada}`}>
      <div><ChipKelayakan kode={k.kode} /></div>
      <div className="big">{d.besar}<small>{d.satuan}</small></div>
      <p>Batas konsumsi <b>{jam(k.batas)}</b> · 4 jam setelah selesai masak {jam(b.waktuMasak)}</p>
      <div className="meter" aria-hidden="true"><i style={{ width: `${k.persen}%` }} /></div>
      <div className="meter-lbl"><span>{jam(b.waktuMasak)}</span><span>{jam(k.batas)}</span></div>
    </section>
  );
}

export function InfoBatch({ b }) {
  const terima = b.riwayat.find((r) => r.tahap === 'Diterima sekolah');
  return (
    <section className="card">
      <dl className="kv">
        <dt>Menu</dt><dd>{b.menu}</dd>
        <dt>{b.porsiDiterima ? 'Porsi diterima' : 'Porsi'}</dt><dd>{b.porsiDiterima || b.porsi} porsi{b.porsiDiterima && b.porsiDiterima !== b.porsi ? ` (dikirim ${b.porsi})` : ''}</dd>
        <dt>Dapur</dt><dd>{b.dapur}</dd>
        <dt>Sekolah tujuan</dt><dd>{b.sekolah}</dd>
        {terima && (<><dt>Diterima</dt><dd>{jam(terima.waktu)} · {terima.oleh}</dd></>)}
      </dl>
    </section>
  );
}

const TAHAP = ['Didaftarkan', 'Selesai masak', 'Diambil kurir', 'Diterima sekolah'];

export function Riwayat({ b }) {
  const sudah = Object.fromEntries(b.riwayat.map((r) => [r.tahap, r]));
  const baris = TAHAP.map((t) => sudah[t] || { tahap: t });
  const akhir = b.riwayat.find((r) => r.tahap === 'Disajikan' || r.tahap === 'Ditolak') || { tahap: 'Disajikan' };
  baris.push(akhir);
  return (
    <section className="card">
      <h3>Riwayat batch</h3>
      <ol className="tl">
        {baris.map((r) => (
          <li key={r.tahap}>
            {r.waktu
              ? <span className={`ic${r.tahap === 'Ditolak' ? ' bad' : ''}`}><Ikon n={r.tahap === 'Ditolak' ? 'x' : 'check'} /></span>
              : <span className="ic todo" />}
            <div>
              <b>{r.tahap}{r.waktu ? ` · ${jam(r.waktu)}` : ''}</b>
              <span>{r.waktu ? `${r.oleh}${r.porsi ? ` · ${r.porsi} porsi` : ''}` : 'Belum dicatat'}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Satu baris batch di daftar. */
export function ItemBatch({ b, k, ke, meta }) {
  const aktif = b.status > 0 && b.status < 4 && b.waktuMasak;
  const nada = aktif ? NADA_KELAYAKAN[k.kode] : 'netral';
  return (
    <Link to={ke} className="item">
      <span className="code">{b.kode} <ChipBatch b={b} k={k} /></span>
      <span className={`time t-${nada}`}>
        {aktif ? (k.kode === 3 ? `Lewat ${durasi(k.lewat)}` : durasi(k.sisa)) : ''}
        {aktif && <small>batas {jam(k.batas)}</small>}
      </span>
      <span className="menu">{b.menu}</span>
      {meta && <span className="meta">{meta}</span>}
    </Link>
  );
}

export function Kosong({ ikon = 'tray', judul, children }) {
  return (
    <div className="empty">
      <div className="ill"><Ikon n={ikon} /></div>
      <h2>{judul}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Skeleton({ n = 3, teks = 'Memuat data dari blockchain…' }) {
  return (
    <>
      <p className="muted" role="status" style={{ margin: 0 }}>{teks}</p>
      {Array.from({ length: n }, (_, i) => (
        <div className="sk" aria-hidden="true" key={i}><i style={{ width: '40%' }} /><i style={{ width: '85%' }} /><i style={{ width: '60%' }} /></div>
      ))}
    </>
  );
}

export function Overlay({ jenis = 'sheet', onTutup, label, children }) {
  const ref = useRef(null);
  const tutupRef = useRef(onTutup);
  tutupRef.current = onTutup;
  useEffect(() => {
    const sebelumnya = document.activeElement;
    const daftar = () => [...(ref.current?.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])') || [])];
    (ref.current?.querySelector('[data-autofocus]') || daftar()[0])?.focus({ preventScroll: true });
    const tombol = (e) => {
      if (e.key === 'Escape' && tutupRef.current) { e.preventDefault(); tutupRef.current(); return; }
      if (e.key !== 'Tab') return;
      const fokus = daftar();
      if (!fokus.length) { e.preventDefault(); return; }
      const pertama = fokus[0];
      const terakhir = fokus.at(-1);
      if (e.shiftKey && (document.activeElement === pertama || !ref.current?.contains(document.activeElement))) { e.preventDefault(); terakhir.focus(); }
      else if (!e.shiftKey && document.activeElement === terakhir) { e.preventDefault(); pertama.focus(); }
    };
    window.addEventListener('keydown', tombol);
    return () => {
      window.removeEventListener('keydown', tombol);
      if (sebelumnya?.isConnected) sebelumnya.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className="overlay">
      {onTutup
        ? <button type="button" className="scrim" aria-label="Tutup" onClick={onTutup} tabIndex={-1} />
        : <div className="scrim" aria-hidden="true" />}
      <div className="frame">
        <div ref={ref} className={jenis} role="dialog" aria-modal="true" aria-label={label}>
          {jenis === 'sheet' && <div className="grab" />}
          {children}
        </div>
      </div>
    </div>
  );
}

export function Stepper({ id, value, onChange, invalid, describedBy, label }) {
  const angka = (v) => Math.max(0, parseInt(String(v).replace(/\D/g, ''), 10) || 0);
  return (
    <div className="stepper">
      <button type="button" className="btn secondary" aria-label={`Kurangi ${label}`} onClick={() => onChange(Math.max(0, angka(value) - 1))}><Ikon n="minus" /></button>
      <input id={id} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className={invalid ? 'invalid' : undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy} />
      <button type="button" className="btn secondary" aria-label={`Tambah ${label}`} onClick={() => onChange(angka(value) + 1)}><Ikon n="plus" /></button>
    </div>
  );
}

export function Pesan({ jenis = 'bad', ikon = 'alert', children }) {
  return <div className={`note ${jenis}`} role={jenis === 'bad' ? 'alert' : undefined}><Ikon n={ikon} /><span>{children}</span></div>;
}

export function Galat({ children }) {
  return <p className="err"><Ikon n="alert" /><span>{children}</span></p>;
}

export function useToast() {
  const [teks, setTeks] = useState(null);
  const t = useRef(0);
  const tampil = (msg) => {
    setTeks(msg);
    clearTimeout(t.current);
    t.current = setTimeout(() => setTeks(null), 2600);
  };
  return [teks ? <div className="toast" role="status">{teks}</div> : null, tampil];
}

/** Hook kecil: kelayakan batch yang ikut berdetak bersama jam chain. */
export function useKelayakan() {
  const { sekarang, detak } = useSesi();
  void detak; // re-render tiap detak
  return (b) => kelayakan(b, sekarang());
}

export function InfoJaringan() {
  const { kontrak } = useSesi();
  if (!kontrak) return null;
  return <p className="net">MBG-Chain {kontrak.jaringan} · chainId {kontrak.chainId} · kontrak {kontrak.address.slice(0, 6)}…{kontrak.address.slice(-4)}</p>;
}
