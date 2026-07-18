# Panduan BP Batam Ai

## Daftar Isi

- [1. Panduan Pengguna (UI Dashboard)](#1-panduan-pengguna-ui-dashboard)
  - [1.1 Dashboard Utama](#11-dashboard-utama)
  - [1.2 Manajemen Intent](#12-manajemen-intent)
- [2. Panduan API](#2-panduan-api)
  - [2.1 Autentikasi](#21-autentikasi)
  - [2.2 Endpoint API /api/query](#22-endpoint-api-apiquery)
  - [2.3 Endpoint API /api/query/stream (SSE)](#23-endpoint-api-apiquerystream-sse)
  - [2.4 Endpoint Webhook WhatsApp](#24-endpoint-webhook-whatsapp)
  - [2.5 Endpoint API /api/config](#25-endpoint-api-apiconfig)
  - [2.6 Endpoint API /api/intents](#26-endpoint-api-apiintents)

---

## 1. Panduan Pengguna (UI Dashboard)

### 1.1 Dashboard Utama

Dashboard utama diakses melalui `http://localhost:8000/`.

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

### 1.2 Manajemen Intent

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

## 2. Panduan API

**Base URL**: `http://localhost:8000`

### 2.1 Autentikasi

Jika `DASHBOARD_PASSWORD` diatur di `.env`, semua endpoint **kecuali `/webhook/*`** dilindungi HTTP Basic Auth.

- Header: `Authorization: Basic base64(username:password)`
- Default username: `admin` (bisa diubah via `DASHBOARD_USERNAME`)

**Endpoint yang dikecualikan dari auth:**
- `POST /webhook/whatsapp`
- `GET /webhook/health`

### 2.2 Endpoint API `/api/query`

Mengembalikan hasil query lengkap termasuk SQL, data mentah, dan insight.

#### Request

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
  "tgl_status": "",
  "staff": "",
  "action_time": "",
  "tgl_daftar": "",
  "jenis_reklame": "",
  "tgl_jatuh_tempo": "",
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
| *lainnya* | string | `""` | Parameter filter tambahan |

#### Response

```json
{
  "reply": "**Ringkasan KPI Permohonan Izin BP Batam**...",
  "sql": "SELECT ... FROM US_DWH.BI_T_ALL ...",
  "result": [
    {
      "TOTAL_DOKUMEN": 5000,
      "TOTAL_TERBIT": 3500,
      "TOTAL_TOLAK": 500,
      "TOTAL_DALAM_PROSES": 800,
      "TOTAL_LAINNYA": 200,
      "TOTAL_OVERDUE": 150
    }
  ],
  "intent": "bp_all_kpi_card",
  "ai_insight": "Total 5000 dokumen dengan 3500 terbit...",
  "deterministic_insight": "Total 5000 dokumen, 3500 terbit (70%), 500 ditolak (10%)...",
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

#### Contoh cURL

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

### 2.3 Endpoint API `/api/query/stream` (SSE)

Server-Sent Events endpoint untuk streaming progress real-time. Digunakan oleh dashboard utama.

#### Request

**Method**: `GET`
**URL**: `/api/query/stream`
**Parameter**: Semua field sama seperti `POST /api/query`, dikirim sebagai query parameter URL.

**Contoh**:
```
GET /api/query/stream?message=Total+masuk+izin+BP+Batam&intent_provider=local&insight_provider=deterministic&reply_provider=llm&reply_llm_provider=llamacpp
```

#### Response (SSE)

Setiap event adalah line `data: {json}`.

**Progress event**:
```
data: {"step": "Menganalisis pertanyaan...", "progress": 5}
```

**Done event** (ketika `done: true`):
```
data: {"done": true, "reply": "...", "sql": "...", "result": [...], "intent": "...", "ai_insight": "...", "deterministic_insight": "...", "elapsed": 1.23, "progress": 100}
```

**Step progression & progress values:**

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

#### Contoh JavaScript (Frontend)

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

### 2.4 Endpoint Webhook WhatsApp

Endpoint khusus untuk integrasi chatbot WhatsApp (tidak memerlukan autentikasi).

#### Request

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

#### Response

```json
{
  "reply": "**Ringkasan KPI Permohonan Izin BP Batam**...",
  "elapsed": 1.23
}
```

**Perbedaan dengan `/api/query`**: Webhook hanya mengembalikan `reply` dan `elapsed` — tanpa SQL, result, atau insight. Ini adalah response yang dikirim langsung ke pengguna WhatsApp.

**Fallback chain reply**: `llamacpp` → `local` (Ollama) → `deterministic`

#### cURL Contoh

```bash
curl -X POST "http://localhost:8000/webhook/whatsapp" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "628123456789",
    "message": "Total izin yang sudah terbit"
  }'
```

#### Health Check

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

### 2.5 Endpoint API `/api/config`

Mengembalikan konfigurasi publik yang digunakan frontend.

#### Request

**Method**: `GET`
**URL**: `/api/config`

#### Response

```json
{
  "local_model": "gemma3:1b",
  "local_host": "http://localhost:11434",
  "cloud_model": "gpt-4o-mini",
  "cloud_api_url": "https://openrouter.ai/api/v1",
  "cloud_configured": true,
  "cloud_referer": "http://localhost:8000",
  "llamacpp_model": "ornith-1.0-35b-Q6_K.gguf",
  "llamacpp_api_url": "http://172.18.32.172:8080/v1",
  "embedding_model": "paraphrase-multilingual-MiniLM-L12-v2",
  "db_type": "oracle",
  "sqlite_path": "data/biquery.db",
  "bp_host": "172.16.10.34:1521",
  "bp_service": "begs"
}
```

### 2.6 Endpoint API `/api/intents`

CRUD untuk mengelola intent definitions.

#### List All Intents

**Method**: `GET`
**URL**: `/api/intents`

Response: Array of intent objects (lihat struktur intent di bawah).

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
  "params": {
    "tgl_status_terakhir": "Filter tanggal status terakhir"
  },
  "examples": ["Contoh pertanyaan 1"],
  "active": true,
  "keyword_patterns": ["pola.*keyword"],
  "llm_label": "Label untuk LLM",
  "insight_template": {
    "judul": "Judul Insight",
    "insight": "Template insight dengan {variable}",
    "rekomendasi": "Template rekomendasi"
  },
  "intent_rules": {
    "insight_patterns": ["pattern1"],
    "bullet_patterns": ["bullet1"],
    "facts_to_use": ["fact1"]
  },
  "format_config": {
    "type": "custom",
    "title": "Judul Tabel",
    "columns": ["kolom1"],
    "value_column": "kolom1"
  }
}
```

Response: 201 Created dengan intent object.

#### Update Intent

**Method**: `PUT`
**URL**: `/api/intents/{intent_id}`
**Content-Type**: `application/json`

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
{
  "imported": 10,
  "skipped": 0,
  "errors": []
}
```

---

## Lampiran

### Intent Tersedia

| ID | Deskripsi |
|----|-----------|
| `bp_all_kpi_card` | KPI Card — ringkasan seluruh permohonan izin |
| `bp_flow_permohonan` | Alur/Sankey permohonan izin |
| `bp_tren_inflow_outflow` | Tren inflow vs outflow per hari |
| `bp_gauge_performa` | Gauge performa penyelesaian |
| `bp_kepatuhan_sla` | Kepatuhan SLA |
| `bp_funnel_kemacetan` | Analisis kemacetan/funnel |
| `bp_proporsi_kerja` | Proporsi kerja staf |
| `bp_rapor_staf` | Rapor evaluasi staf |

### Pipeline Pemrosesan

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

### Tabel Database

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

### Environment Variables

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
