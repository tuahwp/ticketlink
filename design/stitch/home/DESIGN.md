---
name: Field Operations Portal
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3f4850'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006398'
  primary: '#006194'
  on-primary: '#ffffff'
  primary-container: '#007bb9'
  on-primary-container: '#fdfcff'
  inverse-primary: '#93ccff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#a33900'
  on-tertiary: '#ffffff'
  tertiary-container: '#cc4900'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#93ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb599'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#7f2b00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-lg:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.03em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

Sistem reka bentuk ini dicipta khusus untuk jurutera lapangan (Field Engineers) yang memerlukan kepantasan, kejelasan maklumat, dan kebolehpercayaan tinggi di bawah persekitaran kerja mencabar seperti sinaran matahari terik atau situasi satu tangan (one-handed operation).

Personaliti reka bentuk menggabungkan pendekatan **Corporate Tech Modern** dengan utiliti **High-Legibility Functional**:
- **Pantas & Tepat**: Tiada visual tidak perlu; hierarki tiket, tahap SLA, dan lokasi mesti dapat dikesan dalam masa 1 saat.
- **Teguh & Ergonomik**: Kawasan sentuh minimum 48px pada setiap butang tindakan pantas (quick action buttons) bagi memudahkan interaksi di lapangan.
- **Status-Driven**: Penggunaan penunjuk visual status yang ketara dan tidak mengelirukan bagi mengelakkan pelanggaran masa penyelesaian masalah (SLA breach).

## Colors

Palet warna dibina berlandaskan kontras tinggi untuk memastikan kebolehbacaan optimum di luar bangunan:

- **Primary (`#0284c7` - Modern Corporate Sky)**: Digunakan untuk tindakan utama, pautan navigasi aktif, dan tajuk kad tiket utama.
- **Secondary (`#0d9488` - Deep Teal Green)**: Mewakili status penyelesaian ("Resolved", "Completed", "En Route") serta metrik prestasi positif jurutera.
- **Tertiary (`#ea580c` - Alert Amber/Orange)**: Bertindak sebagai warna amaran untuk tiket berkategori "Critical", amaran awal SLA, atau kerja berisiko tinggi. Padankan dengan `#dc2626` bagi status "SLA Breached".
- **Neutral (`#0f172a` - Slate Obsidian)**: Teks utama dan latar belakang elemen gelap berkepekatan tinggi. Menghasilkan kontras WCAG AAA pada latar belakang kanvas putih kelabu sejuk (`#f8fafc`).

## Typography

Pemilihan tipografi mengutamakan perbezaan bentuk glif yang sangat jelas bagi mengelakkan kekeliruan aksara penting seperti nombor tiket, kod nod rangkaian, atau nombor siri peralatan:

- **Body & Data Content (Atkinson Hyperlegible Next)**: Direka khusus untuk mengurangkan ralat bacaan; setiap nombor dan huruf mempunyai profil unik yang kekal jelas walaupun di bawah pantulan cahaya luar.
- **Headlines & Labels (Space Grotesk)**: Memberikan struktur teknikal moden, berketepatan tinggi, dan kemas pada tag status, kiraan masa SLA, dan pengenalan tapak (Site ID).

## Layout & Spacing

Reka letak dioptimumkan sepenuhnya untuk mod paparan peranti mudah alih (portret) dengan skema grid 4-kolum bendalir:

- **Margin & Padding**: Margin luar peranti ditetapkan pada `1rem` (16px) untuk memaksimumkan ruang paparan kad sambil mengekalkan zon selamat sentuhan tepi skrin.
- **Thumb-Zone Placement**: Semua butang tindakan kritikal ("Terima Tugas", "Daftar Masuk Tapak", "Lapor SLA") diletakkan di bahagian bawah 40% skrin telefon.
- **Struktur Aliran Menegak**: Antara muka mengutamakan susunan kad menegak berterusan (continuous vertical stream) dengan jurang seragam `1rem` bagi pemisahan tiket yang kemas.

## Elevation & Depth

Sistem kedalaman menggunakan gabungan **Low-Contrast Outlines** dan **Tonal Layers** bagi mengekalkan kejelasan tanpa menghasilkan bayang kabur yang sukar dilihat di bawah cahaya terik:

- **Level 0 (Surface Base)**: Latar belakang aplikasi menggunakan kelabu cerah bersih (`#f8fafc`).
- **Level 1 (Card Default)**: Permukaan putih tulen (`#ffffff`) dilapisi garisan sempadan nipis 1px (`#e2e8f0`). Bayang ambient sangat halus: `0 1px 3px rgba(15, 23, 42, 0.06)`.
- **Level 2 (Active/SLA Critical Card)**: Garisan tepi bertukar mengikut status amaran (contoh: sempadan kiri tebal 4px berwarna `#ea580c` atau `#dc2626`) dengan bayang sejuk berkepekatan sederhana `0 4px 12px rgba(2, 132, 199, 0.08)`.
- **Level 3 (Sticky Bottom Navigation & Modals)**: Menggunakan permukaan putih legap dengan bayang songsang menegak `0 -4px 16px rgba(15, 23, 42, 0.08)` bagi membezakan bar operasi daripada kandungan yang diskrol.

## Shapes

Bahasa bentuk menggunakan profil rounded moden yang kukuh:
- **Kad Tiket & Bekas Kandungan**: Sudut lengkung bersaiz `1rem` (16px) memberikan sentuhan kontemporari dan mesra pengguna.
- **Butang Tindakan & Medan Input**: Sudut bersaiz `0.5rem` (8px) mengekalkan bentuk utilitarian yang jelas untuk zon interaksi.
- **Badges Status & Chips**: Menggunakan gaya kontur pil penuh (pill-shaped) untuk membezakan status maklumat daripada butang tindakan bersegi.

## Components

### 1. Cards (Kad Tiket Lapangan)
- **Struktur**: Menampilkan pengepala status tiket, nombor tiket teknikal, nama tapak, jarak lokasi (GPS), dan pengira masa berundur SLA.
- **SLA Alert Strip**: Sempadan vertikal kiri 4px yang berubah mengikut kekritikalan: Jingga (`#ea580c`) untuk < 1 jam, Merah tebal (`#dc2626`) untuk SLA Breached.
- **Padding**: Ditetapkan pada `1.25rem` (20px) bagi memastikan zon teks tidak berhimpit.

### 2. Buttons & Action Targets
- **Ketinggian Minimum**: `48px` untuk butang standard; `54px` untuk butang tindakan utama (Primary CTA) di bawah skrin.
- **Butang Navigasi Bawah**: Bar navigasi bawah terapung atau berpaut (docked) dengan 4 ikon utama: Tiket, Peta Tapak, Inventori, dan Profil. Setiap sasaran tab berukuran minimum 48px × 48px.
- **Primary CTA**: Latar biru `#0284c7`, teks putih tebal `Space Grotesk`, tanpa bayang kompleks, dengan maklum balas penekanan segera (active state scale `0.98`).

### 3. Status Badges & Chips
- **SLA Urgent / Critical**: Latar lembut `#ffedd5` dengan teks tebal `#c2410c`.
- **Completed / Verified**: Latar lembut `#ccfbf1` dengan teks tebal `#0f766e`.
- **In Progress**: Latar lembut `#e0f2fe` dengan teks tebal `#0369a1`.
- **Format Teks**: Aksara besar (Uppercase), saiz font 11px, `letter-spacing: 0.05em`.

### 4. Input Fields (Borang Laporan Tapak)
- **Tinggi Input**: `48px` dengan garisan sempadan 1.5px `#cbd5e1`.
- **Fokus Input**: Sempadan bertukar kepada `#0284c7` dengan gegelung fokus luar (focus ring) 3px separa telus.
- **Teks Pemegang Tempat (Placeholder)**: Kontras minimum 4.5:1 menggunakan rona `#64748b` untuk kemudahan pembacaan.

### 5. Komponen Tambahan: SLA Countdown Pill & Quick Call Action
- **SLA Pill**: Penunjuk masa berundur beranimasi lembut yang terletak di sudut kanan atas kad dengan ikon jam bersaiz 16px.
- **Quick-Dial Floating Action**: Butang pintasan bulat 48px dengan ikon telefon untuk jurutera menghubungi pusat kawalan (NOC/Dispatch) secara terus tanpa meninggalkan skrin utama.