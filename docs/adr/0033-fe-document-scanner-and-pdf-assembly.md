# ADR 0033: FE Mobile Document Scanner and Multi-Page PDF Assembly

## Status
Accepted

## Context
Dalam operasi harian Field Engineer (FE), borang Service Report fizikal sering ditandatangani oleh wakil pelanggan di tapak sebelum dimuat naik ke dalam sistem TicketLink. Sebelum ini, FE perlu mengambil gambar biasa menggunakan kamera peranti atau memuat naik fail PDF yang disediakan terlebih dahulu. Kaedah ini sering menghasilkan imej yang senget, berbayang, orientasi terbalik (isu EXIF kamera telefon pintar), atau kualiti yang tidak standard, selain menyukarkan muat naik laporan yang merangkumi lebih daripada satu halaman.

Bagi meningkatkan kualiti dokumen laporan perkhidmatan, sistem memerlukan modul pengimbas dokumen ala CamScanner yang bersepadu di dalam dashboard FE (kedua-dua versi Klasik `FEDashboard.tsx` dan versi `FEV2Dashboard.tsx`), dengan sokongan pengesanan penjuru dokumen automatik, pembetulan perspektif (*perspective crop & warp*), susunan berbilang halaman (*multi-page*), dan penggabungan ke dalam satu fail PDF piawai A4.

## Decision

### 1. OpenCV.js Versi Terpin & Pemuatan Malas (Lazy Loading)
- Menggunakan pustaka OpenCV.js yang dipin pada versi **`4.7.0-release.1`** dan disimpan secara statik pada laluan tempatan `/public/vendor/opencv.js` (~8.56MB).
- OpenCV.js **tidak** dimuatkan semasa inisialisasi awal dashboard. Ia dimuatkan secara malas (*lazy-load*) hanya apabila FE menekan butang pengimbas.
- Mekanisme pemuatan menggunakan Promise cache (`loadOpenCv()`) bagi memastikan fail bersaiz besar tersebut hanya dimuat turun sekali sahaja sepanjang sesi pelayar.
- Konfigurasi `next.config.mjs` dikemas kini untuk memastikan aset di bawah `/vendor/:path*` tidak disekat oleh middleware dan diberikan header caching jangka panjang (`Cache-Control: public, max-age=31536000, immutable`).
- Paparan status memuatkan berbahasa Melayu disediakan: *"Memuatkan pengimbas... Sila tunggu sebentar."*

### 2. Pengesanan Penjuru & Pembetulan Perspektif (Vendored jscanify)
- Logik pelanggan jscanify disalin secara terus (*vendored*) ke `src/lib/vendor/jscanify.js` (di bawah lesen MIT) dan diimport secara dinamik.
- Pakej npm `jscanify` dibuang daripada `package.json` dan `package-lock.json` kerana pakej npm tersebut menyertakan dependensi pelayan Node (`canvas` dan `jsdom`) yang memerlukan kompilasi C++ asli (`cairo`, `pango`, `pixman`) yang gagal dibina pada persekitaran kontena Alpine Linux (`node:22-alpine` di Coolify). Dengan vendoring fail pelanggan tulen ini, Dockerfile tidak perlu ditambah pakej cairo/pango.
- Kanvas interaktif pelarasan bucu menggunakan skala nisbah `getBoundingClientRect()` (`rect.width / raw.width`, `rect.height / raw.height`) bagi memastikan ketepatan koordinat apabila kanvas dikecilkan oleh gaya CSS `max-h-[62vh]`.
- Menggunakan standard Pointer Events (`onPointerDown`, `onPointerMove`, `onPointerUp` berserta `setPointerCapture`) agar pelarasan sudut lancar pada sentuhan telefon pintar dan tidak tersangkut pada persekitaran desktop.
- Butang pintas *"Auto-Kesan"* dan *"Penuh"* disediakan sekiranya pengesanan automatik memerlukan pembetulan semula atau menggunakan keseluruhan bingkai imej. Objek Mat OpenCV (`imgMat`) dipadamkan secara terjamin di dalam blok `finally`.

### 3. Tangkapan Kamera, Galeri, dan Orientasi EXIF
- Antara muka menyediakan dua saluran input tangkapan:
  1. **Kamera**: `<input type="file" accept="image/*" capture="environment">` untuk tangkapan terus melalui kamera belakang peranti.
  2. **Galeri**: `<input type="file" accept="image/*">` (tanpa atribut `capture`) untuk memilih fail gambar yang telah sedia ada dalam storan peranti.
- Menggunakan `createImageBitmap(file, { imageOrientation: "from-image" })` untuk membaca metadata EXIF secara tepat, menghalang isu gambar terbalik atau berputar 90/180 darjah yang lazim berlaku pada peranti Android dan iOS.

### 4. Pengoptimuman Prestasi & Pengurusan Memori Mudah Alih
- Bagi mengelakkan ranap pelayar (*browser tab crash*) akibat kehabisan memori RAM semasa memproses imej kamera beresolusi tinggi (12MP–48MP), sisi terpanjang imej dikecilkan (*downscaled*) kepada maksimum **1920px**.
- Selepas imej dipotong dan dibetulkan perspektifnya, kanvas dieksport sebagai Blob JPEG dengan faktor kualiti **0.7** bagi saiz fail yang seimbang.
- Memori dilepaskan secara aktif:
  - Pemanggilan `bitmap.close()` sebaik sahaja pemindahan ke kanvas selesai.
  - Pemadaman objek Mat OpenCV (`mat.delete()`, `contour.delete()`) di dalam blok `finally`.
  - Pembersihan saiz kanvas (`canvas.width = 1; canvas.height = 1`).
  - Pembebasan semua URL sementara menggunakan `URL.revokeObjectURL()` semasa penutupan mahupun unmount komponen.

### 5. Aliran Kerja Berbilang Halaman & Penanganan Ralat Pemuatan
- Pengguna boleh mengimbas sehingga had maksimum **10 halaman** bagi setiap tiket. Sekiranya had dicapai, amaran jelas berbahasa Melayu dipaparkan: *"Maksimum 10 halaman telah dicapai."*
- Setiap halaman diimbas dipaparkan dalam bentuk senarai thumbnail dengan sokongan:
  - Penukaran susunan halaman ke atas (`▲`) atau ke bawah (`▼`).
  - Imbas semula (*retake*) halaman tertentu.
  - Pemadaman halaman tertentu (*delete*).
- Sekiranya pemuatan OpenCV.js gagal atau mencapai had masa (*timeout*), antaramuka tidak tersekat pada pemutar muat turun (*spinner*), sebaliknya memaparkan skrin ralat khusus berbahasa Melayu: *"Scanner tak dapat dibuka. Sila guna Pilih Fail PDF / Gambar."* lengkap dengan butang tindakan yang menutup pengimbas dan membuka pemilih fail sistem peranti secara automatik.

### 6. Penggabungan Dokumen PDF (pdf-lib) & Pengoptimuman Bundle
- Pakej `pdf-lib` dimuatkan secara malas (*dynamic import* `await import("pdf-lib")`) hanya apabila proses penggabungan PDF dijalankan dalam `assemblePdfDocument`, menghalang pertambahan saiz muat turun awal bundle FE.
- Komponen `DocumentScanner` diimport menggunakan `next/dynamic` dengan `{ ssr: false }` pada kedua-dua dashboard (`FEDashboard.tsx` dan `FEV2Dashboard.tsx`).
- Menyusun semua halaman imej JPEG ke dalam satu dokumen PDF bersaiz piawai **A4** (595.28 x 841.89 mata) dengan orientasi portrait atau landscape mengikut nisbah imej.
- Format penamaan fail standard: `service_report_<ticketRefNo>_<YYYYMMDD>.pdf`.
- Had saiz ketat **10MB** disemak pada `onComplete`. Sekiranya saiz PDF melebihi 10MB, amaran toast dipaparkan: *"Fail terlalu besar (maks 10MB). Kurangkan halaman atau scan semula."* dan fail tidak akan ditetapkan ke dalam borang.

### 7. Susun Atur Antara Muka Pengguna (UI Layout)
- Susun atur butang berkembar selebar penuh pada paparan 360px:
  1. **Utama**: `"📸 Scan Service Report"` (membuka modal skrin penuh `DocumentScanner`).
  2. **Kedua**: `"📁 Pilih Fail PDF / Gambar"` (membuka pemilih fail peranti bagi pengguna yang ingin memuat naik fail PDF atau gambar secara terus).
- Petunjuk had saiz muat naik *"PDF, JPG atau PNG (Maks 10MB)"* dikekalkan di bawah butang muat naik di kedua-dua dashboard.
- Butang ini diintegrasikan secara konsisten pada:
  - Modal **Resolve** dan Modal **Follow-Up** dalam `src/app/components/FEDashboard.tsx`.
  - Modal **Resolve** dan Modal **Follow-Up** dalam `src/app/components/fe-v2/FEV2Dashboard.tsx`.

## Consequences

### Positif
- **Binaan CI/CD Alpine Bersih**: Pembuangan pakej npm `jscanify` dan pembersihan `package-lock.json` menghapuskan sepenuhnya dependensi asli Node `canvas` / `jsdom`, membolehkan `npm ci` berjaya di kontena Docker Alpine tanpa sebarang perpustakaan sistem tambahan.
- **Kualiti Dokumen Piawai**: Laporan perkhidmatan yang dimuat naik kini terpotong rapi, rata (*undistorted*), dan berada dalam satu fail PDF yang teratur.
- **Pengendalian Sentuhan & Tetikus Jitu**: Penggunaan Pointer Events berserta `getBoundingClientRect()` memastikan titik sudut dokumen tepat dan tidak tersangkut pada pelbagai peranti.
- **Pengekalan Keserasian Penuh**: Pengguna masih mempunyai pilihan untuk memilih fail PDF atau foto sedia ada melalui butang `"📁 Pilih Fail PDF / Gambar"` sekiranya pengimbas gagal dibuka.
- **Saiz Bundle Minimum**: Pemuatan malas `pdf-lib` dan pemisahan kod dinamik `DocumentScanner` menghalang peningkatan saiz bundle awal aplikasi.

### Pertimbangan
- Muat turun pertama OpenCV.js memerlukan ~8.5MB data mudah alih. Walau bagaimanapun, dengan konfigurasi `Cache-Control: immutable`, ia hanya dimuat turun sekali sahaja dan dicache oleh pelayar untuk lawatan seterusnya. Sekiranya muat turun gagal, sistem menyediakan jalan keluar pantas ke pemilih fail biasa.
