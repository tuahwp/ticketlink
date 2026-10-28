# ADR 0034: FE Document Scanner Live Camera Mode and Auto-Snap

## Status
Accepted

## Context
Dalam ADR 0033, pengimbas dokumen mudah alih telah diperkenalkan dengan sokongan pengesanan sudut, pembetulan perspektif, susunan berbilang halaman, dan penggabungan PDF. Walau bagaimanapun, aliran kerja tangkapan awal masih bergantung sepenuhnya kepada input fail kamera native sistem operasi peranti (`<input type="file" capture="environment">`).

Kaedah kamera native ini mempunyai beberapa kekangan operasi bagi Field Engineer (FE) di tapak pelanggan:
1. **Peralihan Aplikasi Terputus**: Menekan butang membuka aplikasi kamera luaran telefon, menyebabkan pelayar web diminimumkan dan berisiko ditamatkan oleh pengurus memori OS (Android LMK / iOS background termination) pada telefon ber-RAM terhad.
2. **Tiada Panduan Langsung (No Real-Time Feedback)**: FE tidak dapat melihat sama ada keseluruhan dokumen berada dalam bingkai yang optimum atau condong sehingga foto selesai diambil dan dimuat masuk ke skrin pelarasan.
3. **Aliran Berbilang Halaman Lambat**: Untuk borang 3–5 muka surat, FE terpaksa berulang-alik antara kamera native dan web sebanyak 3–5 kali secara manual.

Bagi mempercepatkan aliran kerja FE setaraf aplikasi CamScanner, sistem memerlukan **Mod Live Kamera Sebenar** yang beroperasi terus di dalam komponen pelayar web (`<video>` berserta `getUserMedia`), dilengkapi bingkai panduan kontur masa nyata (*live green bounding overlay*), pengesanan kestabilan 4 penjuru, dan ciri tangkapan automatik (*auto-snap*).

## Decision

### 1. Aliran Kerja & Skrin Live Utama
- Menjadikan mod `live` sebagai langkah utama (`ScannerStep: "live"`) sebaik sahaja OpenCV sedia, menggantikan pembukaan terus pemilih fail native.
- Skrin Live memaparkan suapan video kamera belakang peranti (`facingMode: "environment"`) bersaiz penuh dengan atribut penting iOS WebKit: `playsInline`, `muted`, dan `autoPlay`.
- Kekangan resolusi kamera meminta resolusi ideal HD:
  `{ width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "environment" }` tanpa memaksakan orientasi menegak/melintang, sebaliknya membaca `videoWidth` dan `videoHeight` sebenar penderia.
- Antaramuka menyediakan butang tindakan pantas di skrin Live:
  1. **✕ Tutup**: Menghentikan semua trek kamera serta-merta dan menutup modal.
  2. **🖼️ Galeri**: Input fail tanpa atribut capture untuk memilih fail sedia ada.
  3. **📷 Kamera Telefon**: Pilihan sandaran pantas menggunakan pemilih native lama.
  4. **Thumbnail & Kaunter**: Memaparkan pratonton halaman terakhir dan bilangan `"N halaman"`.
  5. **Butang "Selesai →"**: Membawa FE ke skrin semakan (`review`) untuk menyusun, memadam, atau menyemak halaman sebelum menjana PDF. Semasa mod ambil semula (*retake*), butang ini dan thumbnail disembunyikan dan digantikan dengan butang **"Batal"** sahaja.

### 2. Pengesanan Kertas Masa Nyata & Pengoptimuman Prestasi
- Suapan video diproses pada kanvas pemprosesan luar skrin (*offscreen canvas*) yang **dikecilkan** (sisi terpanjang dihadkan kepada **480px**). Kanvas overlay langsung diskalakan mengikut `devicePixelRatio` untuk ketajaman optimum pada skrin resolusi tinggi.
- Loop pengesanan dikawal melalui `requestAnimationFrame` dengan kekerapan dihadkan (*throttled*) ke sekitar **5–8 FPS** (~150ms setiap kitaran).
- Memori WebAssembly diuruskan dengan ketat: objek `imgMat` dan `contour` dipadamkan (`.delete()`) pada setiap kitaran pemprosesan di dalam blok `finally`, termasuk pembebasan Mat kontur individu di dalam loop `findPaperContour`.
- **Penurunan Kadar Bingkai Adaptif (*Adaptive Throttling*)**:
  - Masa pemprosesan (`performance.now()`) dipantau pada setiap frame.
  - Sekiranya kitaran melebihi 100ms, sela masa throttle ditingkatkan automatik kepada 300ms (~3.3 FPS). Sela masa kembali ke ~150ms apabila masa pemprosesan $< 40$ms.
  - Sekiranya masa pemprosesan berterusan $> 250$ms berturut-turut, auto-snap dimatikan secara senyap dan sistem hanya mengekalkan bingkai hijau panduan untuk tangkapan manual (kaunter kitaran perlahan di-reset semula apabila Auto diaktifkan kembali).

### 3. Pengesahan Geometri Kertas Sah
Sebelum sesuatu kontur diterima sebagai kertas borang Service Report:
1. **Nisbah Luas**: Luas poligon mestilah merangkumi antara **15% hingga 95%** daripada jumlah luas kanvas pemprosesan (menghalang salah-kesan pada objek kecil atau bingkai penuh skrin palsu).
2. **Kecembungan (Convexity)**: Poligon 4 sudut mestilah cembung (*strictly convex*), di mana hasil darab silang (*cross-products*) bagi sisi-sisi bersebelahan mempunyai tanda arah yang seragam.
3. **Sudut Dalaman**: Setiap sudut dalaman antara 4 sisi mestilah berada dalam julat wajar iaitu antara **45° hingga 135°**.

### 4. Heuristik Kestabilan & Auto-Snap
- Status teks masa nyata berbahasa Melayu santai dipaparkan di bahagian atas skrin:
  - *"Halakan kamera ke borang"* (apabila tiada kertas sah dikesan).
  - *"Pegang stabil..."* (apabila 4 sudut sah dikesan).
  - *"✓ Snap!"* (apabila auto-snap tercetus).
- **Kestabilan Koordinat**: Sistem membandingkan pergerakan koordinat 4 penjuru menggunakan penampan bergerak (*rolling buffer* 3 frame, mengukur anjakan maksimum antara 2 frame terakhir). Jika anjakan maksimum $\Delta \le 0.02 \times \text{lebar\_bingkai}$ (kurang 2%) selama sekurang-kurangnya **1 saat**, tangkapan automatik (*auto-snap*) dicetuskan (selagi had 10 halaman belum dicapai).
- **Kawalan Pengguna**:
  - Butang togol *"⚡ Auto"* (lalai: **ON**) disediakan pada skrin Live untuk mematikan auto-snap sekiranya FE ingin merakam secara manual sahaja.
  - Butang bulat besar tengah (72px luar, 52px dalam) disediakan untuk tangkapan manual pada bila-bila masa.
  - Getaran ringkas haptik (`navigator.vibrate(50)`) dicetuskan apabila tangkapan berjaya (pada peranti yang menyokong).
  - Tempoh bertenang (*cooldown*) selama **1.5 saat** dikenakan selepas setiap tangkapan untuk menghalang tangkapan berganda (*double snap*) pada halaman yang sama.

### 5. Tangkapan Resolusi Tinggi (High-Res Snap) & Pembetulan Sudut
- Mekanisme tangkapan menggunakan pengesanan ciri bertingkat (*tiered feature detection*):
  1. Menggunakan API resolusi penderia penuh `new ImageCapture(track).takePhoto()` dengan batas masa 3 saat (*3s timeout* yang dibersihkan sejurus selesai).
  2. Sekiranya tidak disokong (cth. iOS Safari) atau melebihi 3 saat, sistem melukis bingkai video penuh resolusi terus ke kanvas memori.
- Fail imej diproses melalui `processImageFile`: membaca orientasi EXIF tepat (`imageOrientation: "from-image"`) dan mengecilkan sisi terpanjang kepada maksimum **1920px**.
- **Padanan Nisbah Aspek**: Koordinat bucu live hanya diskalakan terus ke foto jika perbezaan nisbah aspek foto dan suapan video $< 0.02$ ($|w/h - vW/vH| < 0.02$). Sekiranya foto mempunyai nisbah aspek berbeza (cth. sensor Android 4:3 berbanding video 16:9), algoritma `detectDocumentCorners` dijalankan semula terus pada kanvas foto.
- Perlumbaan permulaan kamera dicegah melalui kaunter sesi `liveSessionRef` yang disahkan sebelum dan selepas setiap operasi `await`.
- Selepas tangkapan, antaramuka beralih terus ke skrin pelarasan sudut (`adjust`) sedia ada.
- Selepas mengesahkan potongan halaman, sistem kembali semula secara lancar ke mod `live` untuk imbasan halaman seterusnya (sehingga had 10 halaman).

### 6. Sandaran Automatik (Fallback to Native Camera)
- Sekiranya kamera live gagal dimulakan akibat:
  - API `navigator.mediaDevices.getUserMedia` tiada.
  - Protokol tidak selamat (bukan HTTPS).
  - Kebenaran kamera ditolak oleh pengguna (`NotAllowedError`).
  - Ralat penderia kamera atau sedang digunakan aplikasi lain.
- Sistem memaparkan mesej ringkas BM: *"Kamera live tak dapat dibuka, guna kamera telefon."* dan beralih automatik ke langkah `capture` (kamera native).
- Pilihan sandaran ini diingati sepanjang sesi modal (`fallbackToNativeCapture = true`), mengelakkan percubaan berulang yang mengecewakan pengguna.

### 7. Pengurusan Kitaran Hayat & Memori Bersih
- Semua trek kamera (`track.stop()`) dihentikan secara aktif dan rAF loop dibatalkan apabila:
  1. Pengguna menekan butang ✕ Tutup atau modal ditutup.
  2. Pengguna berpindah ke skrin pelarasan (`adjust`) atau semakan (`review`).
  3. Tab pelayar tersembunyi atau diminimumkan (`visibilitychange`).
  4. Komponen `DocumentScanner` di-unmount daripada DOM.
- Suapan kamera disambung semula secara bersih sebaik sahaja pengguna kembali ke langkah `live`.

## Consequences

### Positif
- **Peningkatan Kelajuan Operasi**: FE dapat mengimbas dokumen pelbagai halaman dalam masa beberapa saat tanpa meninggalkan antaramuka web atau membuka aplikasi kamera pihak ketiga.
- **Kualiti Tangkapan Maksimum**: Bingkai panduan hijau dan kestabilan auto-snap memastikan gambar diambil tepat ketika borang berada dalam keadaan pegun dan fokus.
- **Ketahanan Penuh (High Resilience)**: Sandaran automatik yang lancar ke pemilih native sekiranya peranti atau pelayar tidak membenarkan akses strim live.
- **Kadar Bingkai Selamat**: Pengecilan frame ke 480px, sela masa 150ms–300ms adaptif, dan pembatalan gelung semasa tab tersembunyi menghalang kepanasan peranti dan kehabisan bateri di tapak operasi.

### Pertimbangan
- Memerlukan capaian HTTPS pada persekitaran produksi untuk membolehkan kebenaran `getUserMedia`. Pada persekitaran bukan HTTPS, pengimbas akan beralih kepada kamera native secara automatik.
