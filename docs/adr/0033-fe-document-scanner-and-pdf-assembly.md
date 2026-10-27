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

### 2. Pengesanan Penjuru & Pembetulan Perspektif (jscanify)
- Pakej npm `jscanify` (v1.4.3) digunakan untuk pengesanan kontur kertas (`findPaperContour`) dan pengiraan 4 titik bucu (`getCornerPoints`).
- Untuk keserasian pelayar web (React / Next.js Client Component), titik capaian modul yang digunakan ialah `jscanify/client` bagi mengelakkan bebanan modul pelayan Node.js (`canvas` dan `jsdom`).
- Kanvas interaktif disediakan dengan 4 pemegang sudut (*corner handles*) berdiameter minimum 40px–48px bagi memudahkan jari FE melaraskan sudut dokumen pada skrin sentuh telefon.
- Butang pintas *"Auto-Kesan"* dan *"Penuh"* disediakan sekiranya pengesanan automatik memerlukan pembetulan semula atau menggunakan keseluruhan bingkai imej.

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
  - Pemadaman objek Mat OpenCV (`mat.delete()`, `contour.delete()`).
  - Pembersihan saiz kanvas (`canvas.width = 1; canvas.height = 1`).
  - Pembebasan URL sementara menggunakan `URL.revokeObjectURL()`.

### 5. Aliran Kerja Berbilang Halaman (Multi-Page Workflow)
- Pengguna boleh mengimbas sehingga had maksimum **10 halaman** bagi setiap tiket. Sekiranya had dicapai, amaran jelas berbahasa Melayu dipaparkan: *"Maksimum 10 halaman telah dicapai."*
- Setiap halaman diimbas dipaparkan dalam bentuk senarai thumbnail dengan sokongan:
  - Penukaran susunan halaman ke atas (`▲`) atau ke bawah (`▼`).
  - Imbas semula (*retake*) halaman tertentu.
  - Pemadaman halaman tertentu (*delete*).

### 6. Penggabungan Dokumen PDF (pdf-lib)
- Pakej `pdf-lib` digunakan secara terus pada bahagian pelanggan (browser) untuk menyusun semua halaman imej JPEG ke dalam satu dokumen PDF bersaiz piawai **A4** (595.28 x 841.89 mata).
- Setiap halaman diselaraskan orientasinya mengikut nisbah imej (portrait atau landscape).
- Format penamaan fail standard: `service_report_<ticketRefNo>_<YYYYMMDD>.pdf`.
- Fail PDF yang dihasilkan memenuhi syarat pengesahan pelayan sedia ada (`src/lib/storage.ts`), termasuk magic bytes `%PDF-` dan had saiz storan 10MB.

### 7. Susun Atur Antara Muka Pengguna (UI Layout)
- Menggantikan input muat naik lama dengan susun atur butang berkembar selebar penuh pada paparan 360px:
  1. **Utama**: `"📸 Scan Service Report"` (membuka modal skrin penuh `DocumentScanner`).
  2. **Kedua**: `"📁 Pilih Fail PDF / Gambar"` (membuka pemilih fail peranti bagi pengguna yang ingin memuat naik fail PDF atau gambar secara terus).
- Butang ini diintegrasikan secara konsisten pada:
  - Modal **Resolve** dan Modal **Follow-Up** dalam `src/app/components/FEDashboard.tsx`.
  - Modal **Resolve** dan Modal **Follow-Up** dalam `src/app/components/fe-v2/FEV2Dashboard.tsx`.
- Pengimbas sentiasa dipaparkan dan sedia digunakan tanpa bergantung pada konfigurasi toggle System Settings.

## Consequences

### Positif
- **Kualiti Dokumen Piawai**: Laporan perkhidmatan yang dimuat naik kini terpotong rapi, rata (*undistorted*), dan berada dalam satu fail PDF yang teratur.
- **Pengalaman Pengguna FE Unggul**: Aliran kerja pantas ala CamScanner tanpa memerlukan aplikasi pihak ketiga tambahan.
- **Pengekalan Keserasian Penuh**: Pengguna masih mempunyai pilihan untuk memilih fail PDF atau foto sedia ada melalui butang `"📁 Pilih Fail PDF / Gambar"`.
- **Prestasi Stabil**: Pemuatan malas OpenCV.js dan had 1920px menghalang kelambatan papan pemuka dan kehabisan memori pada telefon pintar asas.

### Pertimbangan
- Muat turun pertama OpenCV.js memerlukan ~8.5MB data mudah alih. Walau bagaimanapun, dengan konfigurasi `Cache-Control: immutable`, ia hanya dimuat turun sekali sahaja dan dicache oleh pelayar untuk lawatan seterusnya.
