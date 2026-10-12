// Menu bawah per peran
export const TABS_SEKOLAH = [
  { ke: '/sekolah', ikon: 'home', label: 'Beranda' },
  { ke: '/sekolah/riwayat', ikon: 'history', label: 'Riwayat' },
  { ke: '/sekolah/lapor', ikon: 'flag', label: 'Lapor' },
  { ke: '/sekolah/profil', ikon: 'user', label: 'Profil' },
];
export const TABS_DAPUR = [
  { ke: '/dapur', ikon: 'home', label: 'Beranda' },
  { ke: '/dapur/baru', ikon: 'plus', label: 'Batch baru' },
  { ke: '/dapur/profil', ikon: 'user', label: 'Profil' },
];
export const TABS_KURIR = [
  { ke: '/kurir', ikon: 'home', label: 'Beranda' },
  { ke: '/kurir/pindai', ikon: 'qr', label: 'Pindai' },
  { ke: '/kurir/profil', ikon: 'user', label: 'Profil' },
];
export const TABS_PUSKESMAS = [
  { ke: '/puskesmas', ikon: 'home', label: 'Beranda' },
  { ke: '/puskesmas/pindai', ikon: 'qr', label: 'Cari batch' },
  { ke: '/puskesmas/profil', ikon: 'user', label: 'Profil' },
];
export const TABS_ADMIN = [
  { ke: '/admin', ikon: 'building', label: 'Organisasi' },
  { ke: '/admin/petugas', ikon: 'users', label: 'Petugas' },
  { ke: '/admin/pantau', ikon: 'chart', label: 'Pantau' },
  { ke: '/admin/profil', ikon: 'user', label: 'Profil' },
];
// Halaman publik (tanpa login): pengawas BGN / Dinkes dan orang tua
export const NAV_PUBLIK = [
  { ke: '/pantau', ikon: 'chart', label: 'Pantau batch' },
  { ke: '/verifikasi', ikon: 'qr', label: 'Verifikasi batch' },
  { ke: '/masuk', ikon: 'user', label: 'Masuk petugas' },
];
