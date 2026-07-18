# Panduan Lengkap Chatbot BP Batam

Sistem chatbot WhatsApp untuk layanan data warehouse perizinan BP Batam, didukung oleh AI (BiQuery AI) untuk menjawab pertanyaan seputar data perizinan secara natural dalam Bahasa Indonesia.

---

## Daftar Isi

1. [Arsitektur Sistem](#1-arsitektur-sistem)
2. [Prasyarat](#2-prasyarat)
3. [Instalasi & Menjalankan](#3-instalasi--menjalankan)
4. [Dashboard Web (Control Panel)](#4-dashboard-web-control-panel)
5. [Fitur Chatbot](#5-fitur-chatbot)
6. [Daftar Intent / Pertanyaan yang Didukung](#6-daftar-intent--pertanyaan-yang-didukung)
7. [Fitur AI BiQuery](#7-fitur-ai-biquery)
8. [Referensi Konfigurasi](#8-referensi-konfigurasi)
9. [Pemecahan Masalah](#9-pemecahan-masalah)
10. [Dashboard Web BiQuery AI](#10-dashboard-web-biquery-ai)
11. [Panduan API BiQuery AI](#11-panduan-api-biquery-ai)
12. [Lampiran](#12-lampiran)

---

## 1. Arsitektur Sistem

Sistem terdiri dari **dua komponen** yang berjalan bersamaan:

```
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│   WhatsApp Chatbot              │      │   BiQuery AI                  │
│   (chatbot-bp-batamv3)          │      │   (biquery-ai)                 │
│                                 │      │                                 │
│   Port: 3002                    │──────▶   Port: 8000                    │
│   Node.js + Baileys + Express   │      │   Python + FastAPI              │
│   Dashboard Web (Control Panel) │      │   Oracle DB + LLM               │
└─────────────────────────────────┘      └─────────────────────────────────┘
         │                                          │
         ▼                                          ▼
   WhatsApp (nomor bot)                      Oracle Database (US_DWH)
   6285168779389
```

**Alur percakapan:**

1. User mengirim pesan WhatsApp ke nomor bot
2. Chatbot menerima pesan, cek apakah user terdaftar sebagai **Subject Matter**
3. Jika AI diaktifkan, pesan dikirim ke BiQuery AI via webhook
4. BiQuery AI mengklasifikasikan intent, menjalankan SQL ke Oracle DB
5. Hasil data diproses oleh LLM menjadi jawaban natural
6. Jawaban dikirim kembali ke user via WhatsApp dengan efek mengetik

---

## 2. Prasyarat

### Minimum Hardware
- RAM: 4 GB (8 GB jika menggunakan LLM lokal)
- Storage: 10 GB free
- Koneksi internet untuk download dependencies

### Software
- Docker & Docker Compose (recommended)
- Atau: Node.js 20+ dan Python 3.12+ (manual)
- Akses ke Oracle Database `US_DWH` (server BP Batam)
- Nomor WhatsApp kedua untuk bot (nomor bot: `6285168779389`)

---

## 3. Instalasi & Menjalankan

### 3.1 Setup dengan Docker (Recommended)

#### Chatbot WhatsApp

```bash
cd chatbot-bp-batamv3
docker compose up --build -d
```

- Dashboard: http://localhost:3002
- Config & session tersimpan di folder `data/`

#### BiQuery AI

```bash
cd biquery-ai

# Copy environment file dan edit
cp .env.example .env
# Isi BP_DB_USER, BP_DB_PASSWORD, BP_DB_HOST, BP_DB_SERVICE_NAME

docker compose up --build -d
```

- Dashboard: http://localhost:8000
- Auth default: `admin` (password: lihat di `.env`)

#### Menghubungkan Keduanya

1. Buka dashboard chatbot: http://localhost:3002
2. Scan QR Code dengan WhatsApp nomor bot (6285168779389)
3. Di panel **AI BiQuery (Webhook)**:
   - Aktifkan toggle **"Aktifkan AI"**
   - Isi **API URL**: `http://biquery-ai-server:8000`
   - Catatan: endpoint webhook tidak perlu auth

### 3.2 Setup Manual (Development)

#### Chatbot WhatsApp

```bash
cd chatbot-bp-batamv3
npm install
node src/index.js          # tanpa auto-restart
# atau
npx nodemon src/index.js   # dengan auto-restart
```

#### BiQuery AI

```bash
cd biquery-ai
cp .env.example .env
# Edit .env
pip install uv
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 4. Dashboard Web (Control Panel)

Dashboard chatbot diakses di **http://localhost:3002** dengan 3 panel:

### Panel Kiri — Koneksi WhatsApp

| Elemen | Fungsi |
|--------|--------|
| **QR Code** | Scan dengan WhatsApp nomor bot untuk menghubungkan |
| **Status** | Menampilkan status koneksi (Terhubung / Scan QR / Menghubungkan / Terputus) |
| **Toggle Bot Aktif** | Menghidupkan/mematikan bot (ON = bot memproses pesan) |
| **Tombol Refresh QR** | Memaksa koneksi ulang dan menampilkan QR baru |
| **Tombol Logout** | Logout dari WhatsApp (harus scan QR lagi) |

### Panel Tengah — Konfigurasi & Subject Matter

| Elemen | Fungsi |
|--------|--------|
| **Pesan Penolakan** | Balasan otomatis untuk nomor yang tidak terdaftar |
| **Pesan Sambutan** | Balasan untuk Subject Matter (saat AI nonaktif) |
| **Aktifkan AI** | Toggle untuk mengaktifkan/mematikan integrasi AI |
| **API URL** | URL server BiQuery AI (default: `http://172.18.32.172:8000`) |
| **Kode Registrasi** | Kode untuk registrasi otomatis via WhatsApp (contoh: `daftar123`) |
| **Daftar Subject Matter** | Kelola nomor-nomor yang berhak mengakses bot |
| **Broadcast** | Kirim pesan ke semua Subject Matter sekaligus |

### Panel Kanan — Log Aktivitas

Menampilkan semua pesan masuk secara real-time:
- **ALLOWED** (hijau) — Pesan dari Subject Matter
- **BLOCKED** (merah) — Pesan dari nomor tidak terdaftar (ditolak)
- **BROADCAST** (kuning) — Pesan broadcast dari bot

---

## 5. Fitur Chatbot

### 5.1 Subject Matter (Pengguna Berhak Akses)

Hanya nomor yang terdaftar di daftar **Subject Matter** yang bisa bertanya ke bot.

**Cara mendaftarkan nomor:**
- Via dashboard: input nomor (format `6281234567890`) → klik **"+ Tambah"**
- Via registrasi otomatis (jika kode registrasi diatur)

### 5.2 Registrasi Otomatis via WhatsApp

Pengguna yang **belum terdaftar** bisa mendaftar sendiri dengan mengirimkan **kode registrasi** ke nomor bot.

**Cara setting:**
1. Di dashboard panel tengah, isi **"Kode Registrasi Subject Matter"** (misal: `daftar123`)
2. Simpan konfigurasi
3. User yang bukan Subject Matter tinggal kirim pesan `daftar123` ke bot
4. Bot akan membalas: *"Anda berhasil terdaftar sebagai Subject Matter!"*
5. Nomor user otomatis masuk ke daftar Subject Matter

> Kosongkan kode registrasi jika tidak ingin menggunakan fitur ini.

### 5.3 Tanya Jawab dengan AI

Subject Matter bisa bertanya seputar data perizinan BP Batam secara natural.

**Contoh pertanyaan:**
- "Berapa total permohonan izin bulan ini?"
- "Bagaimana performa penyelesaian permohonan?"
- "Tampilkan tren inflow outflow per hari"
- "Siapa staf dengan kinerja terbaik?"
- "Bagaimana kepatuhan SLA permohonan?"
- "Tolong tunjukkan data reklame yang kadaluarsa"
- "Berapa total pengaduan yang masuk?"

Bot akan menjawab dengan analisis natural yang mengandung **insight** dan **rekomendasi** berdasarkan data terkini.

### 5.4 Efek Mengetik (Typing Effect)

Bot mengirimkan jawaban dengan efek mengetik alami:
- Durasi mengetik proporsional dengan panjang jawaban
- Minimal 2 detik, maksimal 15 detik + variasi acak
- Status "sedang mengetik..." muncul di WhatsApp pengirim

### 5.5 Broadcasting

Fitur untuk mengirim pesan ke **semua Subject Matter** sekaligus.

**Cara:**
1. Tulis pesan di kolom **Broadcast** (panel tengah)
2. Klik **"Kirim Broadcast"**
3. Bot mengirim pesan ke setiap nomor dengan jeda 500ms
4. Hasil pengiriman (berhasil/gagal) ditampilkan per nomor

### 5.6 Toggle Bot (On/Off)

Tombol **Bot Aktif** (panel kiri) untuk menghidupkan/mematikan bot:
- **ON** — Semua pesan diproses
- **OFF** — Semua pesan masuk diabaikan (tidak ada balasan)

---

## 6. Daftar Intent / Pertanyaan yang Didukung

Sistem mendukung **35 jenis pertanyaan** yang dikelompokkan dalam sektor berikut:

### 6.1 Executive Summary

| Intent | Pertanyaan Contoh | Data yang Ditampilkan |
|--------|-------------------|----------------------|
| **Ringkasan KPI** | "KPI BP Batam", "Ringkasan permohonan izin" | Total, terbit, tolak, proses, overdue |
| **Diagram Sankey** | "Flow permohonan", "Alur izin" | Alur dari total → jenis izin → status |
| **Tren Inflow/Outflow** | "Tren inflow outflow", "Masuk dan terbit per hari" | Perbandingan harian dokumen masuk vs terbit |
| **Gauge Performa** | "Performa penyelesaian", "Gauge performa" | Persentase penyelesaian |
| **Kepatuhan SLA** | "SLA permohonan", "Kepatuhan SLA" | Persentase kepatuhan SLA |
| **Funnel Kemacetan** | "Funnel tahapan", "Bottleneck proses" | Analisis hambatan per tahapan |
| **Proporsi Jam Kerja** | "Proporsi kerja staf", "Jam kerja" | Dalam vs luar jam kerja |
| **Rapor Staf** | "Rapor staf", "Kinerja verifikator" | Skor akhir, performa, produktivitas, SLA |

### 6.2 Perizinan (PB dan PD)

| Intent | Pertanyaan Contoh | Data yang Ditampilkan |
|--------|-------------------|----------------------|
| **Scorecard PB/PD** | "Ringkasan PB", "Total permohonan PD" | Total, terbit, tolak, proses, overdue |
| **Gauge PB/PD** | "Performa PB", "Gauge PD" | Persentase penyelesaian PB/PD |
| **Komposisi Status PB/PD** | "Komposisi status PB", "Sebaran PD" | Distribusi status permohonan |
| **Sankey PB/PD** | "Alur PB", "Flow PD" | Alur permohonan PB/PD |
| **Tren PB/PD** | "Tren inflow outflow PB" | Perbandingan harian PB/PD |
| **Funnel PB/PD** | "Funnel PB", "Kemacetan PD" | Bottleneck per tahapan PB/PD |
| **SLA per Jenis Izin** | "SLA PB per bulan" | Kepatuhan SLA per jenis izin per bulan |
| **Leaderboard Verifikator** | "Leaderboard verifikator PB" | Beban kerja staf PB/PD |
| **Countdown SLA** | "Countdown SLA PB" | Permohonan mendekati deadline |
| **Jam Kerja PB/PD** | "Jam kerja verifikator PB" | Dalam vs luar jam kerja (PB/PD) |
| **Rapor Staf PB/PD** | "Rapor staf PB", "Evaluasi PD" | Skor kinerja staf PB/PD |
| **Detail PB/PD** | "Detail permohonan PB" | Tabel rinci permohonan |

### 6.3 Izin Keluar Masuk Barang

| Intent | Pertanyaan Contoh | Data yang Ditampilkan |
|--------|-------------------|----------------------|
| **Per Komoditas** | "Izin keluar masuk per komoditas" | Total per jenis komoditas |
| **Per Perusahaan** | "Total per perusahaan" | Jumlah izin per perusahaan |
| **Detail IKEL** | "Detail izin keluar masuk" | Tabel rinci izin keluar masuk barang |

### 6.4 Reklame

| Intent | Pertanyaan Contoh | Data yang Ditampilkan |
|--------|-------------------|----------------------|
| **Total Masuk** | "Total reklame masuk" | Rekap permohonan reklame |
| **Komposisi Status** | "Status reklame" | Distribusi status reklame |
| **Kadaluarsa** | "Reklame kadaluarsa" | Reklame lewat masa berlaku |
| **Tanggal Kosong** | "Reklame tanpa tanggal" | Data reklame tidak lengkap |
| **Rasio Masa Berlaku** | "Rasio masa berlaku reklame" | Rata-rata masa berlaku per jenis |
| **Tagihan Perpanjangan** | "Tagihan reklame" | Daftar tagihan perpanjangan |
| **Detail Reklame** | "Detail reklame" | Tabel data reklame |

### 6.5 Pengaduan

| Intent | Pertanyaan Contoh | Data yang Ditampilkan |
|--------|-------------------|----------------------|
| **Total Masuk** | "Total pengaduan" | Rekap pengaduan masuk |
| **Komposisi Status** | "Status pengaduan" | Distribusi status pengaduan |
| **Detail Pengaduan** | "Detail pengaduan" | Tabel data pengaduan |

### 6.6 Tracking & Profil Usaha

| Intent | Pertanyaan Contoh | Data yang Ditampilkan |
|--------|-------------------|----------------------|
| **Tracking** | "Tracking permohonan PB/2025/001" | Status terkini permohonan |
| **Profil Usaha** | "Profil PT ABC" | Riwayat perizinan perusahaan |

---

## 7. Fitur AI BiQuery

### 7.1 Klasifikasi Pertanyaan (3 Lapisan)

Sistem menggunakan **3 lapisan klasifikasi** untuk memahami pertanyaan user:

1. **Blacklist Check** — Blokir kata berbahaya (DROP, DELETE, dll.)
2. **Keyword Classifier** — Cocokkan dengan kata kunci cepat
3. **Embedding Classifier** — Kecocokan semantik dengan AI (threshold 0.45)

### 7.2 3 Provider LLM

| Provider | Model Default | Kecepatan | Kualitas |
|----------|--------------|-----------|----------|
| **llamacpp** (GPU Server) | `ornith-1.0-35b` | Cepat | Tinggi |
| **local** (Ollama) | `gemma3:1b` | Sedang | Sedang |
| **cloud** (OpenRouter) | `gpt-4o-mini` | Lambat | Tinggi |

Prioritas: `llamacpp` → `local` → fallback ke template biasa.

### 7.3 Jawaban dengan Insight + Rekomendasi

Setiap jawaban dari AI mengandung:
- **INTI** — 1-2 kalimat pertama menjawab langsung pertanyaan
- **ANGKA** — Data penting dengan analisis proporsi
- **INSIGHT** — Analisis pola dari data
- **SARAN** — 1-2 saran konkret untuk tindak lanjut

---

## 8. Referensi Konfigurasi

### 8.1 Chatbot (`data/config.json`)

| Key | Default | Deskripsi |
|-----|---------|-----------|
| `subjectMatters` | `[]` | Daftar nomor WhatsApp yang berhak mengakses bot |
| `rejectMessage` | Pesan penolakan default | Balasan untuk nomor tidak terdaftar |
| `welcomeMessage` | Pesan sambutan default | Balasan untuk Subject Matter (jika AI nonaktif) |
| `botActive` | `true` | Toggle bot aktif/nonaktif |
| `aiEnabled` | `true` | Toggle integrasi AI |
| `aiApiUrl` | `http://172.18.32.172:8000` | URL server BiQuery AI |
| `registrationCode` | `""` | Kode untuk registrasi otomatis (kosongkan untuk nonaktif) |

### 8.2 BiQuery AI (Environment Variables)

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `APP_PORT` | `8000` | Port server |
| `DASHBOARD_USERNAME` | `admin` | Username HTTP Basic Auth |
| `DASHBOARD_PASSWORD` | (empty) | Password auth (kosong = nonaktif) |
| `OLLAMA_HOST` | `http://localhost:11434` | Server Ollama |
| `OLLAMA_MODEL` | `gemma3:1b` | Model Ollama |
| `CLOUD_API_KEY` | (empty) | API key untuk cloud LLM |
| `LLAMACPP_API_URL` | `http://172.18.32.172:8080/v1` | Server llama.cpp GPU |
| `BP_DB_USER` | `us_dwh` | User Oracle DB |
| `BP_DB_PASSWORD` | (required) | Password Oracle DB |
| `BP_DB_HOST` | `bpdb-scan.bpbatam.go.id:1521` | Host:port Oracle DB |
| `BP_DB_SERVICE_NAME` | `begs` | Service name Oracle DB |

---

## 9. Pemecahan Masalah

### 9.1 QR Code Tidak Muncul

```bash
# Hapus sesi WhatsApp dan restart
cd chatbot-bp-batamv3
docker compose down
rm -rf data/auth
docker compose up -d
```

### 9.2 Bot Tidak Membalas Pesan

Periksa:
1. Apakah **Bot Aktif** = ON? (cek dashboard panel kiri)
2. Apakah nomor pengirim sudah terdaftar sebagai **Subject Matter**?
3. Cek log di panel kanan untuk melihat status pesan

### 9.3 AI Tidak Merespon / "Maaf, data belum tersedia"

Periksa:
1. Apakah **Aktifkan AI** = ON? (dashboard panel tengah)
2. Apakah **API URL** sudah benar? (default: `http://172.18.32.172:8000`)
3. Apakah server BiQuery AI berjalan? `docker compose ps`
4. Cek log BiQuery AI: `docker compose logs -f`
5. Pastikan koneksi Oracle DB berhasil (cek log startup)

### 9.4 Melihat Log Real-time

```bash
# Chatbot
cd chatbot-bp-batamv3
docker compose logs -f

# BiQuery AI
cd biquery-ai
docker compose logs -f
```

### 9.5 Restart Container

```bash
# Chatbot
cd chatbot-bp-batamv3
docker compose restart

# BiQuery AI
cd biquery-ai
docker compose restart
```

### 9.6 Update / Rebuild

```bash
# Pull latest & rebuild
docker compose down
docker compose up --build -d
```

### 9.7 Catatan Penting

- **Nomor bot**: HARUS `6285168779389` (hardcoded)
- **Session tersimpan** di `data/auth/` — jangan hapus kecuali ingin logout
- **Port chatbot**: 3002 (bisa diubah di `docker-compose.yml`)
- **Port BiQuery**: 8000 (bisa diubah di `.env`)
- **Webhook endpoint**: `/webhook/whatsapp` — tidak perlu autentikasi
- **Format nomor**: gunakan kode negara tanpa `+` atau `0` (contoh: `6281234567890`)

---

## 10. Dashboard Web BiQuery AI

Dashboard BiQuery AI diakses melalui **http://localhost:8000/**.

### 10.1 Dashboard Utama

#### Tampilan

Halaman terdiri dari dua panel utama:

**Panel Kiri — Executive Summary:**
- **Input Pertanyaan**: Kotak teks untuk mengetik pertanyaan seputar data perizinan BP Batam.
- **Tombol AI Insight**: Toggle untuk mengaktifkan/menonaktifkan analisis LLM pada hasil query.
- **Tombol Proses**: Mengirim pertanyaan untuk diproses.
- **Provider Selection Card**: Pengaturan penyedia layanan yang digunakan.
- **Contoh Pertanyaan**: Badge yang bisa diklik untuk mengisi pertanyaan contoh.
- **Panel Hasil**: Menampilkan jawaban, insight, SQL, dan tabel hasil query.
- **Panel Loading**: Progress bar dan indikator langkah pemrosesan.

**Panel Kanan — Riwayat Laporan:**
- Menyimpan riwayat pertanyaan (max 50) di localStorage browser.
- Klik item riwayat untuk mengulang query.
- Tombol hapus (X) untuk menghapus item tertentu.
- Tombol "Hapus Semua" untuk membersihkan riwayat.

#### Cara Menggunakan

1. **Filter (Opsional)**: Atur filter tanggal dan jenis izin di card pengaturan.
2. **Ketikan pertanyaan** di kotak input, misalnya: *"Total masuk izin BP Batam"*.
3. **Pilih provider** (jika perlu):
   - *LLM Fallback*: Ollama (lokal), Cloud (online), Ornith (server lokal).
   - *Insight Provider*: Det (deterministik), Ollama, Cloud, Ornith.
   - *Gaya Jawaban*: Ringkas (deterministik) atau Natural (LLM).
4. **Klik "Proses"** atau tekan `Enter`.
5. Tunggu proses selesai — lihat progress bar dan langkah-langkah pemrosesan.
6. Hasil ditampilkan di panel bawah:
   - **Jawaban**: Bubble hijau seperti chat WhatsApp.
   - **AI Insight** (jika diaktifkan): Analisis naratif dari LLM.
   - **Ringkasan Data**: Insight deterministik (angka-angka).
   - **SQL Query**: Query SQL yang dihasilkan (CodeMirror, read-only).
   - **Hasil**: Tab Tabel (tabular) dan JSON (mentah).

#### Provider Selection Card

| Kolom | Opsi | Keterangan |
|-------|------|------------|
| **LLM Fallback** | Ollama / Cloud / Ornith | Penyedia LLM untuk fallback intent classification |
| **Insight Provider** | Det / Ollama / Cloud / Ornith | Penyedia insight: Det = deterministik, lainnya = LLM |
| **Gaya Jawaban** | Ringkas / Natural + Ornith/Ollama/Cloud | Format jawaban + penyedia LLM untuk reply |
| **Filter** | Tanggal (Semua/2025+/2026+), Izin (Semua/PB/PL/dll.) | Filter hasil query |

#### Contoh Pertanyaan

| Pertanyaan | Intent |
|------------|--------|
| Total masuk izin BP Batam | KPI Card |
| Izin terbit BP Batam | KPI Card |
| Total backlog BP Batam | KPI Card |
| Izin dalam proses BP Batam | KPI Card |
| Sebaran izin BP Batam | Sebaran |
| Komposisi status perizinan BP Batam | Komposisi Status |

### 10.2 Manajemen Intent

Halaman manajemen intent diakses melalui `http://localhost:8000/intents` atau klik tombol **"Kelola Intent"** di navbar.

#### Fitur

- **Daftar Intent**: Tabel semua intent dengan status aktif/nonaktif.
- **Tambah Intent**: Form untuk menambahkan intent baru.
- **Edit Intent**: Mengubah intent yang sudah ada.
- **Hapus Intent**: Menghapus intent dengan konfirmasi.
- **Export CSV**: Mendownload semua intent sebagai file CSV.
- **Import CSV**: Mengupload intent dari file CSV.

#### Form Intent

Form intent terdiri dari 5 bagian (accordion):

1. **Informasi Dasar**
   - ID: Identifier unik intent (auto-generate jika dikosongkan).
   - Deskripsi: Penjelasan intent.
   - Label LLM: Label yang dikirim ke LLM.
   - Aktif: Centang untuk mengaktifkan intent.

2. **Kata Kunci**
   - Pattern regex, satu per baris.
   - Contoh: `total.*masuk`, `ringkasan.*permohonan`.

3. **SQL & Contoh**
   - SQL Template: Query SQL dengan parameter `{param}`.
   - Parameter: Daftar parameter yang digunakan.
   - Contoh Pertanyaan: Satu per baris.

4. **Template Insight**
   - Judul, insight, dan rekomendasi (bisa menggunakan template variables).

5. **Format Output**
   - Type: custom, single_value, table.
   - Title, kolom, value column (sesuai type).

---

## 11. Panduan API BiQuery AI

**Base URL**: `http://localhost:8000`

### 11.1 Autentikasi

Jika `DASHBOARD_PASSWORD` diatur di `.env`, semua endpoint **kecuali `/webhook/*`** dilindungi HTTP Basic Auth.

- Header: `Authorization: Basic base64(username:password)`
- Default username: `admin` (bisa diubah via `DASHBOARD_USERNAME`)

**Endpoint yang dikecualikan dari auth:**
- `POST /webhook/whatsapp`
- `GET /webhook/health`

### 11.2 Endpoint /api/query

Mengembalikan hasil query lengkap termasuk SQL, data mentah, dan insight.

**Method**: `POST`
**URL**: `/api/query`
**Content-Type**: `application/json`

**Body**:

```json
{
  "message": "Total masuk izin BP Batam",
  "intent_provider": "local",
  "insight_provider": "deterministic",
  "insight_llm_provider": "local",
  "tgl_status_terakhir": "",
  "perizinan": "",
  "kategori_status": "",
  "tahun": "",
  "bulan": "",
  "pilih_izin": "",
  "rentang_tgl_masuk": "",
  "filter_tahun": "",
  "filter_bulan": "",
  "reply_provider": "llm",
  "reply_llm_provider": "llamacpp"
}
```

**Parameter**:

| Field | Type | Default | Keterangan |
|-------|------|---------|------------|
| `message` | string | (required) | Pertanyaan user |
| `intent_provider` | string | `"local"` | Provider intent: `local`, `cloud`, `llamacpp` |
| `insight_provider` | string | `"deterministic"` | Provider insight: `deterministic`, `llm` |
| `insight_llm_provider` | string | `"local"` | LLM provider untuk insight: `local`, `cloud`, `llamacpp` |
| `reply_provider` | string | `"llm"` | Provider reply: `deterministic`, `llm` |
| `reply_llm_provider` | string | `"llamacpp"` | LLM provider untuk reply: `local`, `cloud`, `llamacpp` |
| `tgl_status_terakhir` | string | `""` | Filter tanggal status terakhir |
| `perizinan` | string | `""` | Filter jenis izin |
| `kategori_status` | string | `""` | Filter kategori status |
| `tahun` | string | `""` | Filter tahun |
| `bulan` | string | `""` | Filter bulan |

**Response**:

```json
{
  "reply": "**Ringkasan KPI Permohonan Izin BP Batam**...",
  "sql": "SELECT ... FROM US_DWH.BI_T_ALL ...",
  "result": [ { "TOTAL_DOKUMEN": 5000, "TOTAL_TERBIT": 3500 } ],
  "intent": "bp_all_kpi_card",
  "ai_insight": "Total 5000 dokumen dengan 3500 terbit...",
  "deterministic_insight": "Total 5000 dokumen, 3500 terbit (70%)...",
  "elapsed": 1.23
}
```

**Response Fields:**

| Field | Type | Keterangan |
|-------|------|------------|
| `reply` | string | Jawaban natural/bahasa alami (format WhatsApp) |
| `sql` | string | SQL query yang dihasilkan |
| `result` | array | Array of objects (hasil query database) |
| `intent` | string | ID intent yang terdeteksi |
| `ai_insight` | string | Analisis insight dari LLM (kosong jika insight_provider=deterministic) |
| `deterministic_insight` | string | Insight deterministik berbasis template |
| `elapsed` | float | Waktu pemrosesan dalam detik |

**Contoh cURL**:

```bash
curl -X POST "http://localhost:8000/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Total masuk izin BP Batam",
    "intent_provider": "local",
    "insight_provider": "deterministic",
    "reply_provider": "llm",
    "reply_llm_provider": "llamacpp"
  }'
```

### 11.3 Endpoint /api/query/stream (SSE)

Server-Sent Events endpoint untuk streaming progress real-time. Digunakan oleh dashboard utama.

**Method**: `GET`
**URL**: `/api/query/stream`
**Parameter**: Semua field sama seperti `POST /api/query`, dikirim sebagai query parameter URL.

**Contoh**:
```
GET /api/query/stream?message=Total+masuk+izin+BP+Batam&intent_provider=local&reply_llm_provider=llamacpp
```

**Response (SSE)**: Setiap event adalah line `data: {json}`.

**Progress event**:
```
data: {"step": "Menganalisis pertanyaan...", "progress": 5}
```

**Done event** (ketika `done: true`):
```
data: {"done": true, "reply": "...", "sql": "...", "result": [...], "intent": "...", "ai_insight": "...", "progress": 100}
```

**Step progression:**

| Progress | Step | Deskripsi |
|----------|------|-----------|
| 0-10% | Menganalisis pertanyaan | Blacklist + greeting check |
| 10-20% | Mencocokkan kata kunci | Keyword classifier |
| 20-30% | Mencocokkan semantik (embedding) | Embedding classifier |
| 30-40% | Menggunakan LLM | LLM fallback |
| 40-55% | Menyusun query SQL | Template SQL |
| 55-70% | Memvalidasi SQL | SQL validator |
| 70-85% | Menjalankan query ke database | Eksekusi query |
| 85-95% | Menganalisis insight | Insight generation |
| 95-100% | Menyusun jawaban | Reply formatting |

**Contoh JavaScript**:

```javascript
const eventSource = new EventSource(
  `/api/query/stream?message=${encodeURIComponent("Total masuk izin")}&intent_provider=local`
);
eventSource.onmessage = function (event) {
  const data = JSON.parse(event.data);
  if (data.step) console.log("Step:", data.step);
  if (data.progress != null) console.log("Progress:", data.progress, "%");
  if (data.done) {
    console.log("Reply:", data.reply);
    eventSource.close();
  }
};
```

### 11.4 Endpoint Webhook WhatsApp

Endpoint khusus untuk integrasi chatbot WhatsApp (tidak memerlukan autentikasi).

**Method**: `POST`
**URL**: `/webhook/whatsapp`
**Content-Type**: `application/json`

**Body**:
```json
{
  "sender": "628123456789",
  "message": "Jumlah izin yang sudah terbit"
}
```

**Parameter**:

| Field | Type | Keterangan |
|-------|------|------------|
| `sender` | string | Nomor WhatsApp pengirim |
| `message` | string | Pesan/pertanyaan dari pengguna |

**Response**:
```json
{
  "reply": "**Ringkasan KPI Permohonan Izin BP Batam**...",
  "elapsed": 1.23
}
```

**Perbedaan dengan `/api/query`**: Webhook hanya mengembalikan `reply` dan `elapsed` — tanpa SQL, result, atau insight. Ini adalah response yang dikirim langsung ke pengguna WhatsApp.

**Fallback chain reply**: `llamacpp` → `local` (Ollama) → `deterministic`

**cURL Contoh**:
```bash
curl -X POST "http://localhost:8000/webhook/whatsapp" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "628123456789",
    "message": "Total izin yang sudah terbit"
  }'
```

**Health Check**:

**Method**: `GET`
**URL**: `/webhook/health`

Mengecek konektivitas ke server LLM (llama.cpp / Ornith).

```bash
curl "http://localhost:8000/webhook/health"
```

Response:
```json
{
  "ornith_api_url": "http://172.18.32.172:8080/v1",
  "ornith_model": "ornith-1.0-35b-Q6_K.gguf",
  "http_models": { "status": 200, "ok": true },
  "chat_test": { "status": "ok", "reply": "Halo" }
}
```

### 11.5 Endpoint /api/config

Mengembalikan konfigurasi publik yang digunakan frontend.

**Method**: `GET`
**URL**: `/api/config`

**Response**:
```json
{
  "local_model": "gemma3:1b",
  "local_host": "http://localhost:11434",
  "cloud_model": "gpt-4o-mini",
  "cloud_api_url": "https://openrouter.ai/api/v1",
  "cloud_configured": true,
  "llamacpp_model": "ornith-1.0-35b-Q6_K.gguf",
  "llamacpp_api_url": "http://172.18.32.172:8080/v1",
  "bp_host": "172.16.10.34:1521",
  "bp_service": "begs"
}
```

### 11.6 Endpoint /api/intents

CRUD untuk mengelola intent definitions.

#### List All Intents

**Method**: `GET`
**URL**: `/api/intents`

Response: Array of intent objects.

#### Get Single Intent

**Method**: `GET`
**URL**: `/api/intents/{intent_id}`

Response: Single intent object atau 404 jika tidak ditemukan.

#### Create Intent

**Method**: `POST`
**URL**: `/api/intents`
**Content-Type**: `application/json`

**Body**:
```json
{
  "id": "my_new_intent",
  "description": "Deskripsi intent baru",
  "sql_template": "SELECT COUNT(*) AS TOTAL FROM US_DWH.BI_T_ALL WHERE {tgl_status_terakhir}",
  "params": { "tgl_status_terakhir": "Filter tanggal status terakhir" },
  "examples": ["Contoh pertanyaan 1"],
  "active": true,
  "keyword_patterns": ["pola.*keyword"],
  "llm_label": "Label untuk LLM",
  "insight_template": {
    "judul": "Judul Insight",
    "insight": "Template insight",
    "rekomendasi": "Template rekomendasi"
  },
  "intent_rules": {
    "insight_patterns": ["pattern1"],
    "bullet_patterns": ["bullet1"],
    "facts_to_use": ["fact1"]
  },
  "format_config": {
    "type": "custom",
    "title": "Judul",
    "columns": ["kolom1"],
    "value_column": "kolom1"
  }
}
```

Response: 201 Created dengan intent object.

#### Update Intent

**Method**: `PUT`
**URL**: `/api/intents/{intent_id}`
**Body**: Sama seperti create, semua field opsional.

#### Delete Intent

**Method**: `DELETE`
**URL**: `/api/intents/{intent_id}`

Response: `{"ok": true}` atau 404.

#### Export CSV

**Method**: `GET`
**URL**: `/api/intents/export/csv`

Response: File CSV download.

#### Import CSV

**Method**: `POST`
**URL**: `/api/intents/import/csv`
**Content-Type**: `multipart/form-data`
**Body**: File field `file`

Response:
```json
{ "imported": 10, "skipped": 0, "errors": [] }
```

---

## 12. Lampiran

### 12.1 Pipeline Pemrosesan

```
User Question
  → Blacklist Check (tolak DDL/DML)
  → Keyword Classifier (regex, fast path)
  → Greeting Detection (sapaan → langsung balas)
  → Embedding Classifier (sentence-transformers)
  → LLM Fallback (Ollama/Cloud/llama.cpp)
  → Filter Application
  → SQL Generation (template → filled SQL)
  → SQL Validation (SELECT-only, whitelist table)
  → SQL Execution (Oracle atau SQLite)
  → Deterministic Insight (angka, fakta, ranking)
  → LLM Insight Narration (opsional)
  → Reply Formatting (LLM atau deterministik)
  → Response (JSON atau SSE stream)
```

### 12.2 Tabel Database

**Tabel utama**: `US_DWH.BI_T_ALL`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| NO_PERMOHONAN | string | Nomor permohonan |
| JENIS_IZIN | string | Jenis izin (PB, PL, PBUMKU, PKKPRL, PPKH, LALIN) |
| KATEGORI_STATUS | string | Kategori status (TERBIT, TOLAK, DALAM PROSES, dll.) |
| STATUS_TERAKHIR | string | Status terakhir detail |
| TGL_STATUS_TERAKHIR | date | Tanggal status terakhir |
| TGL_MASUK | date | Tanggal masuk permohonan |
| STATUS_PENCAPAIAN_SLA | string | Status SLA (SESUAI SLA / LEWAT SLA) |
| VERIFIKATOR | string | Staf verifikator |
| JABATAN_VERIFIKATOR | string | Jabatan verifikator |

**Tabel history**: `US_DWH.BI_H_ALL`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| NO_PERMOHONAN | string | Nomor permohonan |
| VERIFIKATOR_LOG | string | Staf yang melakukan log |
| TGL_LOG | date | Timestamp log |
| ROLE_ID_LALIN | string | Role ID Lalin |

### 12.3 Referensi Environment Variables

| Variabel | Wajib | Default | Deskripsi |
|----------|-------|---------|-----------|
| `APP_HOST` | Tidak | `0.0.0.0` | Bind address |
| `APP_PORT` | Tidak | `8000` | Port |
| `DASHBOARD_USERNAME` | Tidak | `admin` | Username HTTP Basic Auth |
| `DASHBOARD_PASSWORD` | Tidak | (kosong) | Password HTTP Basic Auth |
| `OLLAMA_HOST` | Tidak | `http://localhost:11434` | URL server Ollama |
| `OLLAMA_MODEL` | Tidak | `gemma3:1b` | Model Ollama |
| `OLLAMA_TIMEOUT` | Tidak | `60` | Timeout Ollama (detik) |
| `CLOUD_API_KEY` | Tidak | (kosong) | API key OpenRouter/OpenAI |
| `CLOUD_API_URL` | Tidak | `https://openrouter.ai/api/v1` | Base URL cloud LLM |
| `CLOUD_MODEL` | Tidak | `gpt-4o-mini` | Model cloud LLM |
| `CLOUD_REFERER` | Tidak | `http://localhost:8000` | HTTP Referer header |
| `CLOUD_TITLE` | Tidak | `BP Batam Ai` | X-Title header |
| `LLAMACPP_API_URL` | Tidak | `http://172.18.32.172:8080/v1` | URL server llama.cpp |
| `LLAMACPP_MODEL` | Tidak | `ornith-1.0-35b-Q6_K.gguf` | Model llama.cpp |
| `LLAMACPP_TIMEOUT` | Tidak | `120` | Timeout llama.cpp (detik) |
| `EMBEDDING_MODEL` | Tidak | `paraphrase-multilingual-MiniLM-L12-v2` | Model embedding |
| `DB_TYPE` | Tidak | `oracle` | Tipe database: `oracle` / `sqlite` |
| `SQLITE_DB_PATH` | Tidak | `data/biquery.db` | Path file SQLite |
| `BP_DB_USER` | Ya | `us_dwh` | Username Oracle |
| `BP_DB_PASSWORD` | Ya | (kosong) | Password Oracle |
| `BP_DB_HOST` | Ya | `bpdb-scan.bpbatam.go.id:1521` | Host:port Oracle |
| `BP_DB_SERVICE_NAME` | Ya | `begs` | Service name Oracle |
