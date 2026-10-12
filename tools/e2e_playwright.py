"""Uji end-to-end aplikasi MBG-Chain (React + Web3.js) di Chromium, terhadap blockchain Ganache lokal.
Menjalankan alur semua peran dan menyimpan screenshot ke tools/shots/.

Persiapan (data harus segar):
  npm run chain            # terminal 1
  npm run deploy && npm run seed
  npm run app:build && (cd frontend && npx vite preview)   # http://127.0.0.1:4173
  pip install playwright && playwright install chromium
  python tools/e2e_playwright.py [URL_APLIKASI]
"""
import asyncio, json, os, pathlib, sys, time, urllib.request
from playwright.async_api import async_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
OUT = pathlib.Path(__file__).parent / 'shots'
OUT.mkdir(exist_ok=True)
RPC = os.environ.get('MBG_RPC', 'http://127.0.0.1:8545')
HASIL = []
PHONE = dict(viewport={'width': 402, 'height': 874}, device_scale_factor=2)
DESK = dict(viewport={'width': 1180, 'height': 1040}, device_scale_factor=2)


def rpc(method, params=None):
    req = urllib.request.Request(RPC, data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params or []}).encode(),
                                 headers={'content-type': 'application/json'})
    return json.loads(urllib.request.urlopen(req).read())['result']


def catat(langkah, ok=True, ket=''):
    HASIL.append((langkah, ok, ket))
    print(('LULUS  ' if ok else 'GAGAL  ') + langkah + (f' — {ket}' if ket else ''), flush=True)


async def shot(page, nama, full=False):
    await page.wait_for_timeout(250)
    await page.screenshot(path=str(OUT / f'{nama}.png'), full_page=full)


async def masuk(browser, id_petugas, opsi=PHONE):
    ctx = await browser.new_context(**opsi)
    page = await ctx.new_page()
    page.on('pageerror', lambda e: print('PAGEERROR', e))
    await page.goto(BASE + '/#/masuk')
    await page.fill('#pid', id_petugas)
    await page.fill('#pw', 'mbgchain')
    await page.click('button[type=submit]')
    await page.wait_for_url(lambda u: '/masuk' not in u, timeout=15000)
    return ctx, page


async def konfirmasi_dan_tunggu(page, tombol, teks_tunggu, teks_hasil, nama_pending=None):
    await page.locator('[role=dialog]').get_by_role('button', name=tombol, exact=True).click()
    if nama_pending:
        await page.get_by_text(teks_tunggu).wait_for(timeout=8000)
        await shot(page, nama_pending)
    await page.get_by_role('heading', name=teks_hasil).wait_for(timeout=20000)


async def sekolah(browser):
    ctx = await browser.new_context(**PHONE)
    page = await ctx.new_page()
    await page.goto(BASE + '/#/masuk')
    await page.get_by_text('Akun demo').click()
    await shot(page, 'masuk')
    await page.fill('#pid', 'PIC-RI03-021'); await page.fill('#pw', 'salah')
    await page.click('button[type=submit]')
    await page.get_by_text('Kata sandi salah.').wait_for()
    catat('Masuk: kata sandi salah ditolak')
    await page.fill('#pw', 'mbgchain'); await page.click('button[type=submit]')
    await page.get_by_role('heading', name='Batch diterima').wait_for(timeout=15000)
    await shot(page, 'sekolah_beranda')
    banner = await page.locator('a.banner').count()
    catat('Beranda PIC: peringatan batch lewat batas & mendekati batas tampil', banner == 2, f'{banner} banner')

    # --- alur kritis: sajikan B-0002
    await page.locator('a.item', has_text='B-0002').click()
    await page.get_by_role('button', name='Sajikan').wait_for()
    await shot(page, 'sekolah_detail_mendekati')
    await page.get_by_role('button', name='Sajikan').click()
    await page.fill('#porsi', '130')
    await page.get_by_role('button', name='Tinjau penyajian').click()
    await page.get_by_text('Jumlah melebihi porsi yang diterima').wait_for()
    await shot(page, 'sekolah_form_salah')
    catat('Form penyajian: porsi melebihi yang diterima ditolak di form')
    await page.fill('#porsi', '118')
    await shot(page, 'sekolah_form_sajikan')
    await page.get_by_role('button', name='Tinjau penyajian').click()
    await page.get_by_role('heading', name='Tinjau sebelum mencatat').wait_for()
    await shot(page, 'sekolah_tinjau')
    await konfirmasi_dan_tunggu(page, 'Konfirmasi', 'Mencatat penyajian…', 'Penyajian tercatat', 'sekolah_pending')
    await page.get_by_role('button', name='Lihat detail pencatatan').click()
    await shot(page, 'sekolah_tercatat')
    catat('Sajikan B-0002 (118 porsi): Pending → Confirmed, hash & blok tampil')
    await page.get_by_role('button', name='Kembali ke Beranda').click()

    # --- batch kedaluwarsa: tombol Sajikan nonaktif, tolak
    await page.locator('a.item', has_text='B-0001').click()
    await page.get_by_role('button', name='Tolak batch').wait_for()
    await shot(page, 'sekolah_detail_kedaluwarsa')
    dis = await page.get_by_role('button', name='Sajikan').is_disabled()
    catat('Detail B-0001 kedaluwarsa: tombol Sajikan nonaktif', dis)
    await page.get_by_role('button', name='Tolak batch').click()
    await page.fill('#catatan', 'Tiba setelah batas konsumsi')
    await shot(page, 'sekolah_form_tolak')
    await page.get_by_role('button', name='Tinjau penolakan').click()
    await konfirmasi_dan_tunggu(page, 'Konfirmasi tolak', 'Mencatat penolakan…', 'Batch ditolak')
    await shot(page, 'sekolah_ditolak')
    catat('Tolak B-0001 (lewat batas 4 jam): tercatat')
    await page.get_by_role('button', name='Kembali ke Beranda').click()

    # --- terima B-0004 dari kurir
    await page.locator('a.item', has_text='B-0004').click()
    await page.get_by_role('button', name='Terima batch').click()
    await page.fill('#porsi', '120')
    await page.get_by_role('button', name='Tinjau penerimaan').click()
    # gagal jaringan: putuskan /rpc sesaat
    await page.route('**/rpc', lambda r: r.abort())
    await page.get_by_role('button', name='Konfirmasi', exact=True).click()
    await page.get_by_role('heading', name='Pencatatan gagal').wait_for(timeout=15000)
    await shot(page, 'sekolah_gagal_jaringan')
    catat('Jaringan terputus saat konfirmasi: layar "Pencatatan gagal"')
    await page.unroute('**/rpc')
    await page.get_by_role('button', name='Coba lagi').click()
    await page.get_by_role('heading', name='Batch diterima').wait_for(timeout=20000)
    catat('Coba lagi setelah jaringan pulih: penerimaan B-0004 tercatat')
    await page.get_by_role('button', name='Kembali ke Beranda').click()

    # --- pindai QR: kamera tidak ada di headless → kode manual
    await page.get_by_role('link', name='Pindai QR batch').click()
    await page.fill('#kode-manual', 'B-0005')
    await page.get_by_role('button', name='Buka').click()
    await page.get_by_text('QR tidak dikenali').wait_for()
    await shot(page, 'sekolah_qr_salah')
    catat('Pindai batch sekolah lain (B-0005): ditolak di layar pindai')
    await page.get_by_role('button', name='Pindai ulang').click()
    await page.fill('#kode-manual', 'b3')
    await shot(page, 'sekolah_pindai')
    await page.get_by_role('button', name='Buka').click()
    await page.get_by_role('button', name='Sajikan').wait_for()
    catat('Kode manual "b3" dikenali sebagai B-0003')

    # --- ditolak sistem: batas lewat di antara tinjau dan konfirmasi
    await page.get_by_role('button', name='Sajikan').click()
    await page.get_by_role('button', name='Tinjau penyajian').click()
    rpc('evm_increaseTime', [2 * 3600]); rpc('evm_mine')
    await konfirmasi_dan_tunggu(page, 'Konfirmasi', '', 'Penyajian ditolak sistem')
    await shot(page, 'sekolah_ditolak_sistem')
    catat('Jam chain dimajukan 2 jam sebelum konfirmasi: kontrak menolak (BatasWaktuTerlewati)')
    await page.get_by_role('button', name='Catat penolakan').click()
    await page.get_by_role('button', name='Tinjau penolakan').click()
    await konfirmasi_dan_tunggu(page, 'Konfirmasi tolak', '', 'Batch ditolak')
    catat('Lanjut "Catat penolakan" dari layar ditolak sistem: B-0003 ditolak')
    await page.get_by_role('button', name='Kembali ke Beranda').click()

    # --- riwayat & lapor insiden
    await page.get_by_role('link', name='Riwayat').click()
    await page.locator('a.item').first.wait_for()
    await shot(page, 'sekolah_riwayat')
    await page.get_by_role('link', name='Lapor').click()
    await page.select_option('#batch', 'B-0002')
    await page.fill('#ket', '3 siswa kelas 2 mual 30 menit setelah makan')
    await page.get_by_role('button', name='Tinjau laporan').click()
    await konfirmasi_dan_tunggu(page, 'Kirim laporan', '', 'Laporan insiden tercatat')
    catat('Lapor insiden B-0002 oleh PIC: tercatat')
    await page.get_by_role('button', name='Kembali ke Beranda').click()
    await page.get_by_role('link', name='Profil').click()
    await page.get_by_role('heading', name='Alat demo · jaringan lokal').wait_for()
    await shot(page, 'sekolah_profil')
    await ctx.close()


async def dapur_kurir(browser):
    ctx, page = await masuk(browser, 'SPPG-CB-007')
    await page.get_by_role('link', name='Daftarkan batch baru').wait_for()
    await page.wait_for_timeout(800)
    await shot(page, 'dapur_beranda')
    await page.get_by_role('link', name='Daftarkan batch baru').click()
    await page.select_option('#sekolah', label='SDN Rawa Indah 03')
    await page.fill('#menu', 'Nasi, ayam bakar, sayur bening, jeruk')
    await page.fill('#porsi', '110')
    await shot(page, 'dapur_batch_baru')
    await page.get_by_role('button', name='Tinjau batch').click()
    await konfirmasi_dan_tunggu(page, 'Daftarkan', '', 'Batch B-0007 terdaftar')
    catat('Dapur mendaftarkan batch baru: B-0007 terdaftar')
    await page.get_by_role('button', name='Lihat label QR').click()
    await page.get_by_role('button', name='Catat selesai masak').wait_for()
    await page.locator('.label-qr img').wait_for()
    await shot(page, 'dapur_label_qr')
    await page.get_by_role('button', name='Catat selesai masak').click()
    await page.get_by_role('heading', name='Catat selesai masak?').wait_for()
    await shot(page, 'dapur_konfirmasi_masak')
    await konfirmasi_dan_tunggu(page, 'Catat sekarang', '', 'Selesai masak tercatat')
    await shot(page, 'dapur_masak_tercatat')
    catat('Dapur mencatat selesai masak B-0007: hitungan 4 jam dimulai')
    await ctx.close()

    ctx, page = await masuk(browser, 'KUR-MLC-012')
    await page.locator('a.item', has_text='B-0007').wait_for(timeout=15000)
    await shot(page, 'kurir_beranda')
    await page.locator('a.item', has_text='B-0007').click()
    await page.get_by_role('button', name='Ambil batch').click()
    await page.get_by_role('heading', name='Ambil batch B-0007?').wait_for()
    await shot(page, 'kurir_konfirmasi')
    await konfirmasi_dan_tunggu(page, 'Konfirmasi ambil', '', 'Batch diambil')
    catat('Kurir mengambil B-0007: serah terima ditandatangani kurir')
    await ctx.close()


async def puskesmas(browser):
    ctx, page = await masuk(browser, 'PKM-CKG-002')
    await page.locator('a.item', has_text='B-0002').wait_for(timeout=15000)
    await shot(page, 'puskesmas_beranda')
    await page.locator('a.item', has_text='B-0002').first.click()
    await page.get_by_text('Laporan insiden (1)').wait_for(timeout=15000)
    await shot(page, 'puskesmas_detail')
    await page.get_by_role('link', name='Laporkan insiden').click()
    await page.fill('#ket', 'Sampel nasi diambil untuk uji laboratorium')
    await page.get_by_role('button', name='Tinjau laporan').click()
    await konfirmasi_dan_tunggu(page, 'Kirim laporan', '', 'Laporan insiden tercatat')
    catat('Petugas Puskesmas melaporkan insiden B-0002')
    await ctx.close()


async def admin(browser):
    ctx, page = await masuk(browser, 'ADM-BGN-001', DESK)
    await page.locator('table.tabel').wait_for(timeout=15000)
    await page.select_option('#jenis', '3')
    await page.fill('#nama-org', 'SDN Pulo Gebang 06')
    await shot(page, 'admin_organisasi')
    await page.get_by_role('button', name='Tinjau organisasi').click()
    await konfirmasi_dan_tunggu(page, 'Daftarkan', '', 'Organisasi terdaftar')
    catat('Admin BGN mendaftarkan organisasi baru (ID 7)')
    await page.get_by_role('button', name='Kembali ke daftar').click()
    await page.get_by_role('link', name='Petugas').click()
    await page.locator('table.tabel').wait_for(timeout=15000)
    akun = await page.locator('#akun option').nth(1).get_attribute('value')
    await page.select_option('#akun', akun)
    await page.select_option('#org', label='SDN Pulo Gebang 06 · Sekolah')
    await page.fill('#nama-p', 'Wulan')
    await page.get_by_role('button', name='Tinjau petugas').click()
    await konfirmasi_dan_tunggu(page, 'Daftarkan', '', 'Petugas terdaftar')
    catat('Admin BGN mendaftarkan petugas baru (Wulan, SDN Pulo Gebang 06)')
    await page.get_by_role('button', name='Kembali ke daftar').click()
    await page.locator('tr', has_text='Yusuf').get_by_role('button', name='Nonaktifkan').click()
    await page.get_by_role('dialog').wait_for()
    fokus = await page.evaluate('document.activeElement.textContent.trim()')
    catat('Dialog destruktif memfokuskan aksi aman lebih dulu', fokus == 'Batal', f'fokus: {fokus}')
    await konfirmasi_dan_tunggu(page, 'Nonaktifkan', '', 'Petugas dinonaktifkan')
    await page.get_by_role('button', name='Kembali ke daftar').click()
    await page.locator('tr', has_text='Wulan').wait_for()
    await page.set_viewport_size({'width': 1180, 'height': 1240})
    await shot(page, 'admin_petugas')
    catat('Admin BGN menonaktifkan petugas (Yusuf)')
    await page.set_viewport_size(PHONE['viewport'])
    await shot(page, 'admin_petugas_mobile')
    lebar = await page.evaluate('document.documentElement.scrollWidth')
    catat('Dashboard Admin responsif tanpa scroll horizontal', lebar <= PHONE['viewport']['width'], f'lebar dokumen {lebar}px')
    await page.get_by_role('link', name='Pantau').click()
    await page.get_by_role('heading', name='Status distribusi batch').wait_for(timeout=15000)
    catat('Navigasi Admin membuka dashboard pantau dari data blockchain')
    await ctx.close()
    # petugas nonaktif tidak bisa masuk
    ctx = await browser.new_context(**PHONE); page = await ctx.new_page()
    await page.goto(BASE + '/#/masuk')
    await page.fill('#pid', 'SPPG-PG-003'); await page.fill('#pw', 'mbgchain'); await page.click('button[type=submit]')
    await page.get_by_text('sudah dinonaktifkan').wait_for(timeout=10000)
    catat('Petugas nonaktif ditolak saat masuk (dibaca dari kontrak)')
    await ctx.close()


async def publik(browser):
    ctx = await browser.new_context(**PHONE); page = await ctx.new_page()
    await page.goto(BASE + '/#/masuk')
    await page.get_by_role('link', name='Verifikasi batch tanpa login').click()
    await page.fill('#kode-manual', 'B-0002')
    await page.get_by_role('button', name='Buka').click()
    await page.get_by_role('heading', name='Bukti di blockchain').wait_for(timeout=20000)
    await shot(page, 'publik_verifikasi')
    await shot(page, 'publik_verifikasi_full', full=True)
    n = await page.locator('.card:has(h3:text("Bukti di blockchain")) li').count()
    catat('Verifikasi publik B-0002 tanpa login: riwayat + bukti transaksi tampil', n >= 6, f'{n} event')
    await page.goto(BASE + '/#/verifikasi/B-0999')
    await page.get_by_text('Batch tidak ditemukan').wait_for(timeout=15000)
    catat('Verifikasi kode yang tidak ada: pesan "Batch tidak ditemukan"')
    await ctx.close()
    ctx = await browser.new_context(**DESK); page = await ctx.new_page()
    await page.goto(BASE + '/#/pantau')
    await page.locator('.stats').wait_for(timeout=15000)
    await page.wait_for_timeout(1500)
    await page.locator('.seg').get_by_role('button', name='Semua', exact=False).click()
    await shot(page, 'publik_pantau')
    catat('Pantau pengawas: ringkasan & daftar semua batch tampil')
    await page.locator('button[aria-label^="Lihat detail pencatatan"]').first.click()
    dialog = page.get_by_role('dialog')
    await dialog.get_by_role('heading', name='Bukti di blockchain').wait_for(timeout=15000)
    await shot(page, 'publik_pantau_detail')
    catat('Pantau pengawas: panel detail menampilkan riwayat & bukti transaksi')
    await page.keyboard.press('Shift+Tab')
    fokus_akhir = await page.evaluate('document.activeElement.textContent.trim()')
    await page.keyboard.press('Tab')
    fokus_awal = await page.evaluate('document.activeElement.getAttribute("aria-label")')
    catat('Panel detail menahan fokus keyboard di dalam dialog', 'verifikasi publik' in fokus_akhir.lower() and fokus_awal == 'Tutup detail')
    await dialog.get_by_role('button', name='Tutup detail').click()
    await page.set_viewport_size(PHONE['viewport'])
    await page.wait_for_timeout(100)
    await page.evaluate('window.scrollTo(0, 0)')
    await shot(page, 'publik_pantau_mobile')
    lebar = await page.evaluate('document.documentElement.scrollWidth')
    catat('Pantau pengawas responsif tanpa scroll horizontal', lebar <= PHONE['viewport']['width'], f'lebar dokumen {lebar}px')
    await ctx.close()


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        t0 = time.time()
        for f in (sekolah, dapur_kurir, puskesmas, admin, publik):
            try:
                await f(b)
            except Exception as e:  # noqa: BLE001
                catat(f'{f.__name__}: berhenti karena error', False, str(e).splitlines()[0][:200])
        await b.close()
    lulus = sum(1 for _, ok, _ in HASIL if ok)
    print(f'\n{lulus}/{len(HASIL)} langkah lulus dalam {time.time() - t0:.0f} detik')
    (OUT / 'hasil.json').write_text(json.dumps(HASIL, ensure_ascii=False, indent=1))
    if lulus != len(HASIL):
        raise SystemExit(1)

asyncio.run(main())
