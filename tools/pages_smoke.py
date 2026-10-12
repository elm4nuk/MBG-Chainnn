"""Uji asap build GitHub Pages (mode demo browser: Ganache di browser) di Chromium.

  npm run pages:build, sajikan frontend/dist-pages di bawah /MBG-Chainnn/, lalu:
  python tools/pages_smoke.py http://127.0.0.1:8099/MBG-Chainnn/
  python tools/pages_smoke.py https://elm4nuk.github.io/MBG-Chainnn/     # setelah deploy

Data dibuat ulang di setiap tab, jadi uji ini tidak mengubah apa pun di luar browser.
"""
import asyncio, pathlib, sys, time
from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8099/MBG-Chainnn/').rstrip('/') + '/'
OUT = pathlib.Path(__file__).parent / 'shots' / 'pages'
OUT.mkdir(parents=True, exist_ok=True)
HASIL = []
DESK = {'width': 1440, 'height': 960}
HP = {'width': 375, 'height': 812}


def catat(langkah, ok=True, ket=''):
    HASIL.append((langkah, ok, ket))
    print(('LULUS  ' if ok else 'GAGAL  ') + langkah + (f' — {ket}' if ket else ''), flush=True)


async def siap(page, rute='masuk'):
    t0 = time.time()
    await page.goto(f'{BASE}#/{rute}')
    await page.get_by_role('heading', name='Masuk petugas').wait_for(timeout=120000) if rute == 'masuk' else None
    return time.time() - t0


async def masuk(page, idp):
    await page.fill('#pid', idp)
    await page.fill('#pw', 'mbgchain')
    await page.click('button[type=submit]')
    await page.wait_for_url(lambda u: '/masuk' not in u, timeout=20000)


async def konfirmasi(page, tombol, judul):
    await page.locator('[role=dialog]').get_by_role('button', name=tombol, exact=True).click()
    await page.get_by_role('heading', name=judul).wait_for(timeout=30000)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        galat = []

        def baru(ctx):
            async def buat():
                page = await ctx.new_page()
                page.on('pageerror', lambda e: galat.append(f'pageerror: {e}'))
                page.on('console', lambda m: m.type == 'error' and galat.append(f'console: {m.text}'))
                return page
            return buat()

        # --- PIC sekolah di desktop
        ctx = await browser.new_context(viewport=DESK)
        page = await baru(ctx)
        detik = await siap(page)
        demo = await page.get_by_text('Mode demo: blockchain berjalan di browser').count()
        catat('Blockchain demo siap di browser (deploy + seed)', demo == 1, f'{detik:.1f} detik')
        await page.screenshot(path=str(OUT / 'masuk_desktop.png'))
        await masuk(page, 'PIC-RI03-021')
        await page.get_by_role('heading', name='Batch diterima').wait_for(timeout=20000)
        sidebar = await page.locator('.sidebar').is_visible()
        banner = await page.locator('a.banner').count()
        catat('Desktop: sidebar tampil & peringatan B-0001/B-0002', sidebar and banner == 2, f'sidebar {sidebar}, {banner} banner')
        await page.screenshot(path=str(OUT / 'sekolah_beranda_desktop.png'))

        await page.locator('a.item', has_text='B-0002').click()
        await page.get_by_role('button', name='Sajikan', exact=True).click()
        await page.fill('#porsi', '118')
        await page.get_by_role('button', name='Tinjau penyajian').click()
        await konfirmasi(page, 'Konfirmasi', 'Penyajian tercatat')
        await page.get_by_role('button', name='Lihat detail pencatatan').click()
        blok = await page.get_by_text('Blok').count()
        catat('Sajikan B-0002 (118 porsi) tercatat di blockchain browser', blok > 0)
        await page.get_by_role('button', name='Kembali ke Beranda').click()

        await page.locator('a.item', has_text='B-0001').click()
        nonaktif = await page.get_by_role('button', name='Sajikan', exact=True).is_disabled()
        await page.get_by_role('button', name='Tolak batch').click()
        await page.get_by_role('button', name='Tinjau penolakan').click()
        await konfirmasi(page, 'Konfirmasi tolak', 'Batch ditolak')
        catat('B-0001 kedaluwarsa: Sajikan nonaktif, penolakan tercatat', nonaktif)
        await page.get_by_role('button', name='Kembali ke Beranda').click()

        await page.locator('.sidebar').get_by_role('link', name='Profil').click()
        await page.get_by_role('button', name='+1 jam').click()
        await page.get_by_text('Jam blockchain sekarang').wait_for(timeout=15000)
        catat('Alat demo +1 jam bekerja di chain browser')

        await page.goto(f'{BASE}#/verifikasi/B-0002')
        await page.get_by_role('heading', name='Bukti di blockchain').wait_for(timeout=20000)
        n = await page.locator('.bukti li').count()
        oleh = await page.locator('.bukti').get_by_text('Oleh Sinta').count()
        catat('Verifikasi publik B-0002: bukti transaksi + pelaku', n >= 5 and oleh >= 1, f'{n} event, pelaku tampil {oleh}x')
        await page.screenshot(path=str(OUT / 'verifikasi_desktop.png'), full_page=True)
        await page.goto(f'{BASE}#/verifikasi/B-0999')
        await page.get_by_text('Batch tidak ditemukan').wait_for(timeout=15000)
        catat('Kode batch tidak ada: "Batch tidak ditemukan"')

        await page.goto(f'{BASE}#/pantau')
        await page.get_by_role('heading', name='Status distribusi batch').wait_for(timeout=20000)
        await page.locator('button[aria-label^="Lihat detail pencatatan"]').first.click()
        await page.get_by_role('dialog').get_by_role('heading', name='Bukti di blockchain').wait_for(timeout=20000)
        await page.screenshot(path=str(OUT / 'pantau_detail_desktop.png'))
        catat('Pantau pengawas: tabel + panel detail bukti')
        await page.keyboard.press('Escape')

        # muat ulang = chain baru: data kembali ke skenario awal
        await page.goto(f'{BASE}#/verifikasi/B-0002')
        await page.reload()
        await page.get_by_role('heading', name='Bukti di blockchain').wait_for(timeout=120000)
        ulang = await page.get_by_text('118 porsi disajikan').count()
        catat('Muat ulang mengembalikan data demo ke awal', ulang == 0)
        await ctx.close()

        # --- Admin di desktop
        ctx = await browser.new_context(viewport=DESK)
        page = await baru(ctx)
        await siap(page)
        await masuk(page, 'ADM-BGN-001')
        await page.locator('table.tabel').wait_for(timeout=20000)
        await page.locator('.sidebar').get_by_role('link', name='Pantau').click()
        await page.get_by_role('heading', name='Status distribusi batch').wait_for(timeout=20000)
        await page.screenshot(path=str(OUT / 'admin_pantau_desktop.png'))
        catat('Admin BGN: organisasi & pantau batch')
        await ctx.close()

        # --- HP
        ctx = await browser.new_context(viewport=HP, device_scale_factor=2)
        page = await baru(ctx)
        await siap(page)
        await page.screenshot(path=str(OUT / 'masuk_hp.png'))
        await masuk(page, 'PIC-RI03-021')
        await page.get_by_role('heading', name='Batch diterima').wait_for(timeout=20000)
        lebar = await page.evaluate('document.documentElement.scrollWidth')
        tab = await page.locator('nav.tabs').is_visible()
        side = await page.locator('.sidebar').is_visible()
        await page.screenshot(path=str(OUT / 'sekolah_beranda_hp.png'))
        catat('HP: menu bawah, tanpa sidebar, tanpa scroll horizontal', tab and not side and lebar <= HP['width'], f'lebar {lebar}px')
        await ctx.close()

        await browser.close()
        catat('Tidak ada error di console browser', not galat, galat[0][:160] if galat else '')

    lulus = sum(1 for _, ok, _ in HASIL if ok)
    print(f'\n{lulus}/{len(HASIL)} pemeriksaan lulus · {BASE} · screenshot: {OUT}')
    if lulus != len(HASIL):
        raise SystemExit(1)

asyncio.run(main())
